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

  static async getInstance() {
    if (!this.instancePromise) {
      this.instancePromise = pipeline(this.task as any, this.model, { quantized: true });
    }
    return this.instancePromise;
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
        updatedAt: r.updated_at,
      }))
      .slice(0, 3); // CONSTRAINT FOR TESTING
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

// Out-of-band memory channel to prevent LLM tool-response token explosions.
const tempWritesMap = new Map<string, DbDirective[]>();

const processRepoTool = tool(
  async ({ repoUrl, repoName, index, total, updatedAt }, config) => {
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos");
    const repoPath = path.join(tmpDir, repoName);
    let exists = false;
    try {
      await fs.access(repoPath);
      exists = true;
    } catch { }

    const tag = index !== undefined && total !== undefined ? `[Repo ${index}/${total}] ` : "";

    if (updatedAt) {
      try {
        const { rows } = await pool.query(`SELECT repo_updated_at FROM projects_raw_text WHERE repo_name = $1`, [repoName]);
        if (rows.length > 0 && rows[0].repo_updated_at === updatedAt) {
          await dispatchCustomEvent("progress", { msg: `${tag}Skipping ${repoName}, already ingested and up-to-date!` }, config);
          return "[]";
        }
      } catch (e) {
        // ignore DB error on check
      }
    }

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

    await dispatchCustomEvent(
      "progress",
      { msg: `${tag}Chunking and embedding architecture locally...` },
      config
    );
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });
    // Keep embeddings up to 800k chars for practical reasons
    const docs = await splitter.createDocuments([textContent.slice(0, 800000)]);
    const embedder = await EmbedderPipeline.getInstance();

    const BATCH_SIZE = 16;
    const dbWrites: DbDirective[] = [];
    const contextChunks: { text: string; score: number }[] = [];

    // Embed a query for summarization context
    const queryStr = "architecture tech stack logical structure main dependencies";
    const queryEmbedResp = await embedder([queryStr], { pooling: "mean", normalize: true });
    // Assuming normalized embeddings
    const queryEmbedding = queryEmbedResp.tolist()[0];

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batchDocs = docs.slice(i, i + BATCH_SIZE);
      const batchTexts = batchDocs.map((d) => d.pageContent);
      try {
        const response = await embedder(batchTexts, { pooling: "mean", normalize: true });
        const embeddingsList = response.tolist();
        for (let j = 0; j < embeddingsList.length; j++) {
          const emb = embeddingsList[j];
          let score = 0;
          for (let k = 0; k < emb.length; k++) score += queryEmbedding[k] * emb[k];
          contextChunks.push({ text: batchTexts[j], score });

          dbWrites.push({
            targetTable: "project_embeddings",
            action: "insert",
            data: {
              chunk_index: i + j,
              chunk_text: batchTexts[j],
              embedding: `[${emb.join(",")}]`,
              _repoNameRef: repoName,
            },
          });
        }
      } catch { }
    }

    await dispatchCustomEvent("progress", { msg: `${tag}Summarizing flat source over vector-retrieved context...` }, config);
    // Sort descending by score, take top chunks
    contextChunks.sort((a, b) => b.score - a.score);
    const topChunks = contextChunks.slice(0, 4).map(c => c.text).join("\n\n---\n\n");

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-flash-latest",
      temperature: 0.1,
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Run summarization over the top related architecture/logic chunks instead of full repo
    const summaryResponse = await llm.invoke([
      { role: "system", content: "You are a tech analyst. Summarize the logic, architecture, and tech stack from this repository excerpt concisely." },
      { role: "user", content: "Top relevant snippets:\n" + topChunks }
    ]);
    const summary = summaryResponse.content.toString();

    // Store the repomix dump AND summary directly in DB BEFORE embeddings
    dbWrites.unshift({
      targetTable: "projects_raw_text",
      action: "upsert",
      data: { repo_name: repoName, raw_text: `SUMMARY:\n${summary}\n\nRAW TEXT:\n${textContent}`, file_count: 1, repo_updated_at: updatedAt } // Treat as 1 flattened file
    });

    await dispatchCustomEvent("progress", { msg: `${tag}Repo ingestion complete.` }, config);

    const threadId = config.configurable?.thread_id || "default";
    if (!tempWritesMap.has(threadId)) tempWritesMap.set(threadId, []);
    tempWritesMap.get(threadId)!.push(...dbWrites);

    return `[x] Successfully completed ingestion and stored DB directives out-of-band for ${repoName}.`;
  },
  {
    name: "process_repo",
    description: "Clones repository, flattens via repomix, performs local embeddings and logical synthesis, returning DB directives.",
    schema: z.object({
      repoName: z.string(),
      repoUrl: z.string(),
      index: z.number().optional(),
      total: z.number().optional(),
      updatedAt: z.string().optional(),
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
    model: "gemini-flash-latest",
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

  // 2. Extract directives from the out-of-band channel instead of making the LLM write 30MB of text.
  const threadId = config?.configurable?.thread_id || "default";
  let parsedDirectives: DbDirective[] = tempWritesMap.get(threadId) || [];
  tempWritesMap.delete(threadId); // Clean up memory

  return { pendingDbWrites: parsedDirectives, currentPhase: "Build Ontology" };
}
