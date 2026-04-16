import { ProfileGraphState, StateAnnotation, DbDirective } from "../state";
import { pool } from "../../db/client";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { GoogleGenAI } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { env, pipeline } from "@xenova/transformers";
import { StateGraph, START, END } from "@langchain/langgraph";

const execAsync = promisify(exec);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
env.allowLocalModels = true; 

class PipelineSingleton {
    static task = '';
    static model = '';
    static instance: any = null;
    static instancePromise: Promise<any> | null = null;

    static async getInstance(progress_callback: any = null) {
        if (this.instancePromise === null || this.instance === null) {
            let retries = 3;
            for (let i = 0; i < retries; i++) {
                try {
                    this.instancePromise = pipeline(this.task, this.model, { quantized: true, progress_callback });
                    this.instance = await this.instancePromise;
                    break;
                } catch (e: any) {
                    console.warn(`HuggingFace connection failed. Retrying ${i + 1}/${retries}... (${e.message})`);
                    this.instancePromise = null;
                    if (i === retries - 1) throw e;
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }
        return this.instance;
    }
}

class EmbedderPipeline extends PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
}

async function fetchGithub(state: typeof StateAnnotation.State, config?: RunnableConfig) {
    const safeHandle = state.githubHandle || "unknown_user";
    const safeCv = state.baseCv || "";
    const writes: DbDirective[] = [];

    await dispatchCustomEvent("progress", { msg: `Fetching GitHub handle: ${safeHandle}` }, config);

    // Read only: check if exists
    const existing = await pool.query("SELECT id FROM user_profiles WHERE github_handle = $1", [safeHandle]);
    
    if (existing.rows.length > 0) {
        // UserProfileId exists but we do not mutate DB here natively. We send a directive.
        writes.push({
            targetTable: 'user_profiles', action: 'update',
            data: { base_cv: safeCv }
        });
    } else {
        // Since we need an ID for relations immediately, this is the ONE acceptable read/write cycle, 
        // OR we use abstract logic. We'll delegate to Persister, but immediately return directive.
        writes.push({
            targetTable: 'user_profiles', action: 'insert',
            data: { github_handle: safeHandle, base_cv: safeCv }
        });
    }

    if (safeHandle === "unknown_user") throw new Error("No GitHub Handle provided.");

    const fetchHeaders: any = {};
    if (process.env.GITHUB_TOKEN) fetchHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    
    let repos: any[] = [];
    let page = 1;
    while (true) {
        const response = await fetch(`https://api.github.com/users/${safeHandle}/repos?type=owner&sort=updated&per_page=100&page=${page}`, { headers: fetchHeaders });
        const batch = await response.json();
        if (!Array.isArray(batch)) { if (page === 1) throw new Error("Invalid GitHub response."); break; }
        if (batch.length === 0) break;
        repos = repos.concat(batch);
        page++;
    }

    const originalRepos = repos.filter((r: any) => !r.fork);
    await dispatchCustomEvent("progress", { msg: `Found ${originalRepos.length} original repos. Fetching native languages & topics...` }, config);

    const enrichedRepos = await Promise.all(originalRepos.map(async (r: any) => {
        let inferred_skills: string[] = [];
        try {
            const langRes = await fetch(r.languages_url, { headers: fetchHeaders });
            const langs = await langRes.json();
            inferred_skills = Object.keys(langs);
        } catch (e) { /* silent */ }
        return {
            name: r.name, url: r.html_url, description: r.description,
            topics: r.topics || [], inferred_skills
        };
    }));

    return { repositories: enrichedRepos, pendingDbWrites: writes, userProfileId: existing.rows[0]?.id || null };
}

async function cloneAndConcat(state: typeof StateAnnotation.State, config?: RunnableConfig) {
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos", state.githubHandle || "unknown");
    await fs.mkdir(tmpDir, { recursive: true });
    let ingestedCount = 0;
    const pendingDbWrites: DbDirective[] = [];

    for (let i = 0; i < state.repositories.length; i++) {
        const repoCtx = state.repositories[i];
        const repoName = repoCtx.name || `repo_${i}`;
        const repoUrl = repoCtx.url;
        const repoPath = path.join(tmpDir, repoName);
        const outputPath = path.join(tmpDir, `${repoName}_concat.txt`);

        try {
            let repoExists = false;
            try { await fs.access(repoPath); repoExists = true; } catch { }

            let isUpToDate = false;
            if (!repoExists) {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Native Git Transport resolving default branch...` }, config);
                await execAsync(`git clone --depth 1 ${repoUrl} ${repoPath}`);
            } else {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Pulling latest AST changes...` }, config);
                try {
                    const { stdout } = await execAsync(`git -C ${repoPath} pull`);
                    if (stdout.includes("Already up to date.")) isUpToDate = true;
                } catch (e) { /* ignore */ }
            }

            let txtExists = false;
            try { await fs.access(outputPath); txtExists = true; } catch { }

            if (isUpToDate && txtExists && state.userProfileId) {
                const cacheCheck = await pool.query(
                    "SELECT id, raw_text FROM projects_raw_text WHERE user_profile_id = $1 AND repo_name = $2 LIMIT 1",
                    [state.userProfileId, repoName]
                );
                if (cacheCheck.rows.length > 0) {
                    await dispatchCustomEvent("progress", { msg: `[${repoName}] Already up-to-date. Skipping chunking.` }, config);
                    ingestedCount++;
                    continue;
                }
            }

            if (!txtExists) {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Parsing and filtering logical node bounds...` }, config);
                const includes = ["*.py", "*.md", "*.rs", "*.c", "*.cpp", "*.hpp", "*.h", "*.ts", "*.js", "*.tsx", "*.jsx"].map(p => `-w "${p}"`).join(" ");
                const excludes = ["*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "node_modules/", "dist/", "build/", "releases/", "out/", ".next/", ".nuxt/", "*.min.js"].map(p => `-e "${p}"`).join(" ");
                await execAsync(`codeconcat ${includes} ${excludes} ${repoPath} ${outputPath}`);
            }

            let text = await fs.readFile(outputPath, "utf-8");
            text = text.replace(/\0/g, "");

            let readmeText = "";
            try {
                const possibleReadmes = ["README.md", "readme.md", "README.MD", "Readme.md"];
                for (const rm of possibleReadmes) {
                    try { readmeText = await fs.readFile(path.join(repoPath, rm), "utf-8"); break; } catch { }
                }
            } catch (e) { }

            await dispatchCustomEvent("progress", { msg: `[${repoName}] Injecting Graph Node onto main Ontology Context...` }, config);

            let summaryText = "";
            try {
                if (text.length > 5000) {
                     await dispatchCustomEvent("progress", { msg: `[${repoName}] Using Gemini 3.1 Flash Lite to summarize AST...` }, config);
                     const prompt = `Provide a concise 1-2 paragraph technical summary of this repository codebase:\n\n${text.slice(0, 100000)}`;
                     const result = await ai.models.generateContent({ model: 'gemini-3.1-flash-lite-preview', contents: prompt });
                     summaryText = result.text || "Codebase summarized efficiently via LLM.";
                } else {
                     summaryText = "Codebase too compact for summarization. Ast passed natively.";
                }
            } catch (e) { summaryText = "Summarization threshold exceeded."; }

            // DB Updates migrated to Pure Directives
            const dRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
            const dJson = dRes.rows[0]?.demographics_json || {};
            if (!Array.isArray(dJson.projects)) dJson.projects = [];
            dJson.projects.push({
                name: repoName, url: repoUrl, description: repoCtx.description || "",
                tags: repoCtx.topics || [], inferred_skills: repoCtx.inferred_skills || [],
                readme: readmeText.slice(0, 5000), ast_summary: summaryText
            });

            pendingDbWrites.push({
                targetTable: 'user_profiles', action: 'update',
                data: { demographics_json: dJson }
            });
            pendingDbWrites.push({
                targetTable: 'projects_raw_text', action: 'insert',
                data: { repo_name: repoName, raw_text: text }
            });

            ingestedCount++;
        } catch (e: any) {
            console.error(`Failed to load ${repoName}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    return { ingestedProjects: ingestedCount, pendingDbWrites };
}

async function generateEmbeddings(state: typeof StateAnnotation.State, config?: RunnableConfig) {
    if (!state.userProfileId) return {};
    await dispatchCustomEvent("progress", { msg: "Generating project vector embeddings via local inference..." }, config);
    const writes: DbDirective[] = [];

    const projects = await pool.query("SELECT id, repo_name, raw_text FROM projects_raw_text WHERE user_profile_id = $1", [state.userProfileId]);
    for (const project of projects.rows) {
        const verifyEmbed = await pool.query("SELECT id FROM project_embeddings WHERE project_id = $1 LIMIT 1", [project.id]);
        if (verifyEmbed.rows.length > 0) continue;

        const text = project.raw_text.slice(0, 16000);
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });
        const docs = await splitter.createDocuments([text]);
        const embedder = await EmbedderPipeline.getInstance();

        const BATCH_SIZE = 16;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batchDocs = docs.slice(i, i + BATCH_SIZE);
            const batchTexts = batchDocs.map(d => d.pageContent);
            await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Embedding chunk ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}...` }, config);
            try {
                const response = await embedder(batchTexts, { pooling: 'mean', normalize: true });
                const embeddingsList = response.tolist();
                for (let j = 0; j < embeddingsList.length; j++) {
                    writes.push({
                        targetTable: 'project_embeddings', action: 'insert',
                        data: { project_id: project.id, chunk_index: i + j, chunk_text: batchTexts[j], embedding: `[${embeddingsList[j].join(",")}]` }
                    });
                }
            } catch (err: any) { console.error(`Embedding failed for ${project.repo_name}:`, err.message); }
        }
    }
    return { pendingDbWrites: writes, currentPhase: "Build Ontology" };
}

// Map it as a formal subgraph that the Supervisor orchestrator can call
const workflow = new StateGraph(StateAnnotation)
  .addNode("Fetch_Github", fetchGithub)
  .addNode("Clone_And_Concat", cloneAndConcat)
  .addNode("Generate_Embeddings", generateEmbeddings)
  .addEdge(START, "Fetch_Github")
  .addEdge("Fetch_Github", "Clone_And_Concat")
  .addEdge("Clone_And_Concat", "Generate_Embeddings")
  .addEdge("Generate_Embeddings", END);

export const ingestionSubGraph = workflow.compile();
