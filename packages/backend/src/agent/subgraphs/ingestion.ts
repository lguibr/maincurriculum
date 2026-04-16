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
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
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

const fetchGithubTool = tool(async ({ handle }, config) => {
    await dispatchCustomEvent("progress", { msg: `Fetching GitHub repos for ${handle}` }, config);
    const fetchHeaders: any = {};
    if (process.env.GITHUB_TOKEN) fetchHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    let repos: any[] = [];
    let page = 1;
    while (true) {
        const response = await fetch(`https://api.github.com/users/${handle}/repos?type=owner&sort=updated&per_page=100&page=${page}`, { headers: fetchHeaders });
        const batch = await response.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        repos = repos.concat(batch);
        page++;
    }
    return JSON.stringify(repos.filter((r: any) => !r.fork).map((r: any) => ({
        name: r.name, url: r.html_url, description: r.description
    })));
}, { name: "fetch_github_repos", description: "Fetch public non-fork repos for a given github handle", schema: z.object({ handle: z.string() }) });

const cloneRepoTool = tool(async ({ repoUrl, repoName }, config) => {
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos");
    const repoPath = path.join(tmpDir, repoName);
    let exists = false;
    try { await fs.access(repoPath); exists = true; } catch { }

    if (!exists) {
        await dispatchCustomEvent("progress", { msg: `Cloning ${repoName}` }, config);
        await execAsync(`git clone --depth 1 ${repoUrl} ${repoPath}`);
    } else {
        await dispatchCustomEvent("progress", { msg: `Pulling latest for ${repoName}` }, config);
        try { await execAsync(`git -C ${repoPath} pull`); } catch { }
    }
    return `Repository ${repoName} is securely sandbox mounted at ${repoPath}`;
}, { name: "clone_repo", description: "Clones a git repo to the local filesystem for the underlying deepagent backend to access", schema: z.object({ repoName: z.string(), repoUrl: z.string() }) });

const embedProjectTool = tool(async ({ repoName, textContent, userProfileId }, config) => {
    await dispatchCustomEvent("progress", { msg: `Embedding ${repoName} logic...` }, config);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments([textContent.slice(0, 16000)]);
    const embedder = await EmbedderPipeline.getInstance();

    const BATCH_SIZE = 16;
    const dbWrites: DbDirective[] = [];
    dbWrites.push({
        targetTable: 'projects_raw_text', action: 'upsert',
        data: { repo_name: repoName, raw_text: textContent, user_profile_id: userProfileId }
    });

    // We mock project_id as undefined for upsert logic simplicity in the Persister
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batchDocs = docs.slice(i, i + BATCH_SIZE);
        const batchTexts = batchDocs.map(d => d.pageContent);
        try {
            const response = await embedder(batchTexts, { pooling: 'mean', normalize: true });
            const embeddingsList = response.tolist();
            for (let j = 0; j < embeddingsList.length; j++) {
                dbWrites.push({
                    targetTable: 'project_embeddings', action: 'insert',
                    data: { chunk_index: i + j, chunk_text: batchTexts[j], embedding: `[${embeddingsList[j].join(",")}]`, _repoNameRef: repoName } // mock ref for persister
                });
            }
        } catch { }
    }
    return JSON.stringify(dbWrites);
}, { name: "embed_project", description: "Generate vector embeddings for repository text and return DB directives", schema: z.object({ repoName: z.string(), textContent: z.string(), userProfileId: z.number().optional() }) });

// ---------------- DeepAgent Setup ------------------ //

const fsBackend = new FilesystemBackend({ rootDir: path.resolve(process.cwd(), "../../temp_repos") });

const deeperIngestionAgent = createDeepAgent({
    name: "ingestion",
    model: new ChatGoogleGenerativeAI({
        model: "gemini-3.1-pro-preview",
        temperature: 1,
        apiKey: process.env.GEMINI_API_KEY,
    }),
    backend: fsBackend,
    systemPrompt: `You are a Repository Processing deepagent. 
1. Use fetch_github_repos to get the list.
2. Use clone_repo to clone them.
3. Access their local files using your built-in sandboxed file system tools. Summarize the logic.
4. Finally, use embed_project on the analyzed repos to return database directives.
Wrap up your findings and append the actual Database directives to your final message output in JSON format surrounded by <directives> tags.`,
    tools: [fetchGithubTool, cloneRepoTool, embedProjectTool]
});

// ---------------- StateGraph Node ------------------ //

export async function ingestionSubGraph(state: typeof StateAnnotation.State, config?: RunnableConfig) {
    // 1. We execute the deepagent once using the current handle.
    const runResult = await deeperIngestionAgent.invoke({
        messages: [{ role: "user", content: `Please ingest github handle: ${state.githubHandle} and output DB directives.` }]
    } as any, config);

    const lastMsg = runResult.messages[runResult.messages.length - 1].content.toString();

    // 2. Parse out directives from the deepagent's final output
    const directivesMatch = lastMsg.match(/<directives>([\s\S]*?)<\/directives>/);
    let parsedDirectives: DbDirective[] = [];
    if (directivesMatch && directivesMatch[1]) {
        try { parsedDirectives = JSON.parse(directivesMatch[1]); } catch { }
    }

    return { pendingDbWrites: parsedDirectives, currentPhase: "Build Ontology" };
}
