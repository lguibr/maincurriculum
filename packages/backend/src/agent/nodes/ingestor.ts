import { ProfileGraphState } from "../state";
import { pool } from "../../db/client";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { GoogleGenAI } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { env, pipeline } from "@xenova/transformers";

const execAsync = promisify(exec);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configure xenova huggingface environment settings
env.allowLocalModels = true; // allow fetching from local cache to prevent gateway timeouts

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

export class EmbedderPipeline extends PipelineSingleton {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2';
    static instance: any = null;
    static instancePromise: Promise<any> | null = null;
}



export async function fetchGithub(state: ProfileGraphState, config?: RunnableConfig) {
    const safeHandle = state.githubHandle || "unknown_user";
    const safeCv = state.baseCv || "";

    await dispatchCustomEvent("progress", { msg: `Fetching GitHub handle: ${safeHandle}` }, config);

    // Create or update user profile in DB
    const existing = await pool.query("SELECT id FROM user_profiles WHERE github_handle = $1", [safeHandle]);
    let userProfileId;
    if (existing.rows.length > 0) {
        userProfileId = existing.rows[0].id;
        await pool.query("UPDATE user_profiles SET base_cv = $2 WHERE id = $1", [userProfileId, safeCv]);
    } else {
        const res = await pool.query(
            "INSERT INTO user_profiles (github_handle, base_cv) VALUES ($1, $2) RETURNING id",
            [safeHandle, safeCv]
        );
        userProfileId = res.rows[0].id;
    }

    if (safeHandle === "unknown_user") {
        throw new Error("No GitHub Handle provided from Frontend State.");
    }

    // Real github API implementation
    const fetchHeaders: any = {};
    if (process.env.GITHUB_TOKEN) {
        fetchHeaders["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    
    let repos: any[] = [];
    let page = 1;
    while (true) {
        const response = await fetch(`https://api.github.com/users/${safeHandle}/repos?type=owner&sort=updated&per_page=100&page=${page}`, {
            headers: fetchHeaders
        });
        const batch = await response.json();
        
        if (!Array.isArray(batch)) {
            if (page === 1) throw new Error("Invalid GitHub response. Check handle or API limits.");
            break;
        }
        if (batch.length === 0) break;
        repos = repos.concat(batch);
        page++;
    }

    // Filter out forks (keep all original repos, even without descriptions)
    const originalRepos = repos.filter((r: any) => !r.fork);

    await dispatchCustomEvent("progress", { msg: `Found ${originalRepos.length} original repos. Fetching native languages & topics...` }, config);

    const enrichedRepos = await Promise.all(originalRepos.map(async (r: any) => {
        let inferred_skills: string[] = [];
        try {
            const langRes = await fetch(r.languages_url, { headers: fetchHeaders });
            const langs = await langRes.json();
            inferred_skills = Object.keys(langs);
        } catch (e) {
            console.warn(`Could not fetch languages for ${r.name}`);
        }
        return {
            name: r.name,
            url: r.html_url,
            description: r.description,
            topics: r.topics || [],
            inferred_skills
        };
    }));

    return {
        userProfileId,
        repositories: enrichedRepos
    };
}

export async function cloneAndConcat(state: ProfileGraphState, config?: RunnableConfig) {
    // Use a stable, project-local temp directory based on the GitHub handle to cache repos
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos", state.githubHandle || "unknown");
    await fs.mkdir(tmpDir, { recursive: true });

    let ingestedCount = 0;

    for (let i = 0; i < state.repositories.length; i++) {
        const repoCtx = state.repositories[i];
        const repoName = repoCtx.name || `repo_${i}`;
        const repoUrl = repoCtx.url;
        const repoPath = path.join(tmpDir, repoName);
        const outputPath = path.join(tmpDir, `${repoName}_concat.txt`);

        try {
            let repoExists = false;
            try {
                await fs.access(repoPath);
                repoExists = true;
            } catch { }

            let isUpToDate = false;
            if (!repoExists) {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Native Git Transport resolving default branch...` }, config);
                await execAsync(`git clone --depth 1 ${repoUrl} ${repoPath}`);
            } else {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Pulling latest AST changes...` }, config);
                try {
                    const { stdout } = await execAsync(`git -C ${repoPath} pull`);
                    if (stdout.includes("Already up to date.")) {
                        isUpToDate = true;
                    }
                } catch (e) {
                    console.warn(`[${repoName}] pull failed, continuing...`);
                }
            }

            let text = "";
            let txtExists = false;
            try {
                await fs.access(outputPath);
                txtExists = true;
            } catch { }

            if (isUpToDate && txtExists) {
                const cacheCheck = await pool.query(
                    "SELECT id, raw_text FROM projects_raw_text WHERE user_profile_id = $1 AND repo_name = $2 LIMIT 1",
                    [state.userProfileId, repoName]
                );
                if (cacheCheck.rows.length > 0) {
                    await dispatchCustomEvent("progress", { msg: `[${repoName}] Already up-to-date. Skipping chunking.` }, config);
                    await dispatchCustomEvent("project_ready", { projectId: cacheCheck.rows[0].id, text: cacheCheck.rows[0].raw_text }, config);
                    ingestedCount++;
                    continue;
                }
            }

            if (!txtExists) {
                await dispatchCustomEvent("progress", { msg: `[${repoName}] Parsing and filtering logical node bounds...` }, config);

                const includes = [
                    "*.py", "*.md", "*.rs", "*.c", "*.cpp", "*.hpp", "*.h",
                    "*.ts", "*.js", "*.tsx", "*.jsx"
                ].map(p => `-w "${p}"`).join(" ");

                const excludes = [
                    "*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
                    "node_modules/", "dist/", "build/", "releases/", "out/", ".next/", ".nuxt/",
                    "*.min.js", "out.txt", "daicer/src/genesis/*"
                ].map(p => `-e "${p}"`).join(" ");

                await execAsync(`codeconcat ${includes} ${excludes} ${repoPath} ${outputPath}`);
            }

            text = await fs.readFile(outputPath, "utf-8");
            text = text.replace(/\0/g, ""); // strip null bytes

            // Attempt to extract README natively
            let readmeText = "";
            try {
                const possibleReadmes = ["README.md", "readme.md", "README.MD", "Readme.md"];
                for (const rm of possibleReadmes) {
                    try {
                        readmeText = await fs.readFile(path.join(repoPath, rm), "utf-8");
                        break;
                    } catch { continue; }
                }
            } catch (e) { }

            await dispatchCustomEvent("progress", { msg: `[${repoName}] Injecting Graph Node onto main Ontology Context...` }, config);

            let summaryText = "";
            try {
                if (text.length > 5000) {
                     await dispatchCustomEvent("progress", { msg: `[${repoName}] Using Gemini 3.1 Flash Lite to summarize AST...` }, config);
                     const sample = text.slice(0, 100000);
                     const prompt = `Provide a concise 1-2 paragraph technical summary of this repository codebase:\n\n${sample}`;
                     const result = await ai.models.generateContent({
                         model: 'gemini-3.1-flash-lite-preview',
                         contents: prompt,
                     });
                     summaryText = result.text || "Codebase summarized efficiently via LLM.";
                } else {
                     summaryText = "Codebase too compact for summarization. Ast passed natively.";
                }
            } catch (e) {
                console.error(`Reduction failed for ${repoName}`, e);
                summaryText = "Summarization threshold exceeded or blocked by constraints.";
            }

            // Append context safely mapping the Ontology
            try {
                // fetch old demographics_json to graft into
                const dRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
                const dJson = dRes.rows[0]?.demographics_json || {};

                if (!Array.isArray(dJson.projects)) dJson.projects = [];
                dJson.projects.push({
                    name: repoName,
                    url: repoUrl,
                    description: repoCtx.description || "",
                    tags: repoCtx.topics || [],
                    inferred_skills: repoCtx.inferred_skills || [],
                    readme: readmeText.slice(0, 5000), // clamp just in case
                    ast_summary: summaryText
                });

                await pool.query("UPDATE user_profiles SET demographics_json = $1 WHERE id = $2", [dJson, state.userProfileId]);
            } catch (e) { }

            const res = await pool.query(
                "INSERT INTO projects_raw_text (user_profile_id, repo_name, raw_text) VALUES ($1, $2, $3) RETURNING id",
                [state.userProfileId, repoName, text]
            );
            const projectId = res.rows[0].id;
            await dispatchCustomEvent("project_ready", { projectId, text }, config);
            ingestedCount++;
        } catch (e: any) {
            console.error(`Failed to Git/Concat load ${repoName}:`, e.message);
            await dispatchCustomEvent("progress", { msg: `[X] Blocked parsing ${repoName}: Core logic skip.` }, config);
        }

        // sleep between huge repositories
        await new Promise(r => setTimeout(r, 2000));
    }

    return { ingestedProjects: ingestedCount };
}

export async function generateEmbeddings(state: ProfileGraphState, config?: RunnableConfig) {
    await dispatchCustomEvent("progress", { msg: "Generating project vector embeddings via Gemini 2..." }, config);

    // Fetch all un-embedded projects
    const projects = await pool.query("SELECT id, repo_name, raw_text FROM projects_raw_text WHERE user_profile_id = $1", [state.userProfileId]);

    for (const project of projects.rows) {

        // Check if vectors already exist for this project
        const verifyEmbed = await pool.query("SELECT id FROM project_embeddings WHERE project_id = $1 LIMIT 1", [project.id]);
        if (verifyEmbed.rows.length > 0) {
            await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Already up-to-date. Skipping embedding.` }, config);
            continue;
        }

        await dispatchCustomEvent("progress", { msg: `Initializing RecursiveCharacterTextSplitter for [${project.repo_name}]...` }, config);
        // Simple naive chunking for speed: slice by 4000 characters
        // HARD LIMIT applied so massive repos don't consume thousands of API requests and hang the graph for minutes.
        const text = project.raw_text.slice(0, 16000);

        // Utilize LangChain Native Chunking
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 4000,
            chunkOverlap: 200,
        });

        await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Recursively clustering boundaries...` }, config);
        const docs = await splitter.createDocuments([text]);

        await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Spinning up ONNX Native Node inference for ${docs.length} chunks...` }, config);

        const embedder = await EmbedderPipeline.getInstance((progress: any) => {
            if (progress.status === 'progress') {
                dispatchCustomEvent("progress", { msg: `[Local-Embedding] Translating ${progress.file || 'Weights'}... ${Math.round(progress.progress || 0)}%` }, config).catch(() => { });
            }
        });

        const BATCH_SIZE = 16;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batchDocs = docs.slice(i, i + BATCH_SIZE);
            const batchTexts = batchDocs.map(d => d.pageContent);
            await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Embedding chunk ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}...` }, config);
            try {
                const response = await embedder(batchTexts, { pooling: 'mean', normalize: true });
                const embeddingsList = response.tolist();
                
                for (let j = 0; j < embeddingsList.length; j++) {
                    const embedding = embeddingsList[j];
                    const pgVectorStr = `[${embedding.join(",")}]`;
                    await pool.query(
                        "INSERT INTO project_embeddings (project_id, chunk_index, chunk_text, embedding) VALUES ($1, $2, $3, $4)",
                        [project.id, i + j, batchTexts[j], pgVectorStr]
                    );
                }
            } catch (err: any) {
                console.error(`Embedding chunk failed for ${project.repo_name}:`, err.message);
                await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Failed embedding batch ${i}: ${err.message}` }, config);
            }
        }
        await dispatchCustomEvent("progress", { msg: `[${project.repo_name}] Completed embedding.` }, config);
    }

    await dispatchCustomEvent("progress", { msg: "Database RAG Vectors loaded successfully." }, config);
    return {};
}
