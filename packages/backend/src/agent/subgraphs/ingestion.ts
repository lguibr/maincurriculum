import { StateAnnotation, DbDirective } from "../state";
import { pool } from "../../db/client";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { env, pipeline } from "@xenova/transformers";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createDeepAgent, FilesystemBackend } from "deepagents";

const execAsync = promisify(exec);
env.allowLocalModels = true;

export class EmbedderPipeline {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instancePromise: Promise<any> | null = null;
  static instance: any = null;

  static async getInstance() {
    if (!this.instancePromise) {
      this.instancePromise = pipeline(this.task as any, this.model, { quantized: true });
      this.instance = await this.instancePromise;
    }
    return this.instance;
  }
}

// ---------------- Tools ------------------ //

const fetchGithubTool = tool(
  async ({ handle }, config) => {
    await dispatchCustomEvent("progress", { msg: `Fetching GitHub repos for ${handle}` }, config);
    const fetchHeaders: any = {};
    if (process.env.GITHUB_TOKEN)
      fetchHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    let repos: any[] = [];
    let page = 1;
    while (true) {
      const response = await fetch(
        `https://api.github.com/users/${handle}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
        { headers: fetchHeaders }
      );
      const batch = await response.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      repos = repos.concat(batch);
      page++;
    }
    const finalRepos = repos
      .filter((r: any) => !r.fork)
      .map((r: any) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
      }));
    await dispatchCustomEvent(
      "progress",
      { msg: `Found ${finalRepos.length} target repositories.` },
      config
    );
    return JSON.stringify(finalRepos);
  },
  {
    name: "fetch_github_repos",
    description: "Fetch public non-fork repos for a given github handle",
    schema: z.object({ handle: z.string() }),
  }
);

const processRepoTool = tool(
  async ({ repoUrl, repoName, index, total }, config) => {
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos");
    const repoPath = path.join(tmpDir, repoName);
    let exists = false;
    try {
      await fs.access(repoPath);
      exists = true;
    } catch { }

    const tag = index !== undefined && total !== undefined ? `[Repo ${index}/${total}] ` : "";

    if (!exists) {
      await dispatchCustomEvent("progress", { msg: `${tag}Cloning ${repoName}...` }, config);
      await execAsync(`git clone --depth 1 ${repoUrl} ${repoPath}`);
    } else {
      await dispatchCustomEvent(
        "progress",
        { msg: `${tag}Pulling latest for ${repoName}...` },
        config
      );
      try {
        await execAsync(`git -C ${repoPath} pull`);
      } catch { }
    }

    await dispatchCustomEvent("progress", { msg: `${tag}Executing Repomix flattening...` }, config);
    try {
      await execAsync(`npx -y repomix -o output.txt`, { cwd: repoPath });
    } catch (e: any) { }

    let textContent = "";
    try {
      textContent = await fs.readFile(path.join(repoPath, "output.txt"), "utf-8");
    } catch (e) {
      return `[]`; // Return empty directives if fail
    }

    await dispatchCustomEvent("progress", { msg: `${tag}Summarizing flat source over mega-context...` }, config);
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-3-flash",
      temperature: 0.1,
      apiKey: process.env.GEMINI_API_KEY,
    });
    // Run summarization over the raw flattened repo
    const summaryResponse = await llm.invoke([
      { role: "system", content: "You are a tech analyst. Summarize the logic, architecture, and tech stack from this repository dump concisely." },
      { role: "user", content: textContent.slice(0, 1000000) } // Provide up to 1M chars
    ]);
    const summary = summaryResponse.content.toString();

    await dispatchCustomEvent(
      "progress",
      { msg: `${tag}Chunking and embedding architecture locally...` },
      config
    );
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });
    // To ensure it doesn't run forever on giant repos, we embed up to 200 chunks (800k chars)
    const docs = await splitter.createDocuments([textContent.slice(0, 800000)]);
    const embedder = await EmbedderPipeline.getInstance();

    const BATCH_SIZE = 16;
    const dbWrites: DbDirective[] = [];
    
    // Store the repomix dump directly in DB
    dbWrites.push({
      targetTable: "projects_raw_text",
      action: "upsert",
      data: { repo_name: repoName, raw_text: textContent, file_count: 1 } // Treat as 1 flattened file
    });

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batchDocs = docs.slice(i, i + BATCH_SIZE);
      const batchTexts = batchDocs.map((d) => d.pageContent);
      try {
        const response = await embedder(batchTexts, { pooling: "mean", normalize: true });
        const embeddingsList = response.tolist();
        for (let j = 0; j < embeddingsList.length; j++) {
          dbWrites.push({
            targetTable: "project_embeddings",
            action: "insert",
            data: {
              chunk_index: i + j,
              chunk_text: batchTexts[j],
              embedding: `[${embeddingsList[j].join(",")}]`,
              _repoNameRef: repoName,
            },
          });
        }
      } catch { }
    }
    
    await dispatchCustomEvent("progress", { msg: `${tag}Repo ingestion complete.` }, config);
    return JSON.stringify(dbWrites);
  },
  {
    name: "process_repo",
    description: "Clones repository, flattens via repomix, performs local embeddings and logical synthesis, returning DB directives.",
    schema: z.object({
      repoName: z.string(),
      repoUrl: z.string(),
      index: z.number().optional(),
      total: z.number().optional(),
    }),
  }
);

// ---------------- DeepAgent Setup ------------------ //

import { INGESTION_SYSTEM_PROMPT } from "../prompts/ingestion.prompt";

const fsBackend = new FilesystemBackend({
  rootDir: path.resolve(process.cwd(), "../../temp_repos"),
});

const deeperIngestionAgent = createDeepAgent({
  name: "ingestion",
  model: new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 1,
    apiKey: process.env.GEMINI_API_KEY,
  }),
  backend: fsBackend,
  systemPrompt: INGESTION_SYSTEM_PROMPT,
  tools: [fetchGithubTool, processRepoTool],
});

// ---------------- StateGraph Node ------------------ //

export async function ingestionSubGraph(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  // 1. We execute the deepagent once using the current handle.
  const runResult = await deeperIngestionAgent.invoke(
    {
      messages: [
        {
          role: "user",
          content: `Please ingest github handle: ${state.githubHandle} and output DB directives.`,
        },
      ],
    } as any,
    config
  );

  const lastMsg = runResult.messages[runResult.messages.length - 1].content.toString();

  // 2. Parse out directives from the deepagent's final output
  const directivesMatch = lastMsg.match(/<directives>([\s\S]*?)<\/directives>/);
  let parsedDirectives: DbDirective[] = [];
  if (directivesMatch && directivesMatch[1]) {
    try {
      parsedDirectives = JSON.parse(directivesMatch[1]);
    } catch { }
  }

  return { pendingDbWrites: parsedDirectives, currentPhase: "Build Ontology" };
}
