import { StateAnnotation, DbDirective } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaProvider } from "../providers/OllamaProvider";
import { XenovaProvider } from "../providers/XenovaProvider";
import { PostgresProvider } from "../providers/PostgresProvider";

const execAsync = promisify(exec);

export async function EmbedAndSummarize(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (!state.repositories || state.repositories.length === 0) {
    return {};
  }
  
  if (state.ingestedProjects >= state.repositories.length) {
    return {}; // already processed all
  }

  const llmProvider = new OllamaProvider("gemma4", 0.1);
  const embeddingProvider = new XenovaProvider();
  const dbProvider = new PostgresProvider();

  let pendingDbWrites: DbDirective[] = [];
  const total = state.repositories.length;
  
  for (let i = 0; i < total; i++) {
    const repo = state.repositories[i];
    const repoName = repo.name;
    const updatedAt = repo.updatedAt;
    const tmpDir = path.resolve(process.cwd(), "../../temp_repos");
    const repoPath = path.join(tmpDir, repoName);
    
    // Check if already ingested completely
    if (updatedAt) {
      try {
        const rows = await dbProvider.executeQuery(`SELECT repo_updated_at FROM projects_raw_text WHERE repo_name = $1`, [repoName]);
        if (rows.length > 0 && rows[0].repo_updated_at === updatedAt) {
           await dispatchCustomEvent("progress", { msg: `[Repo ${i+1}/${total}] Skipping ${repoName}, up-to-date!` }, config);
           continue;
        }
      } catch (e) {}
    }

    try {
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch { }

    await dispatchCustomEvent("progress", { msg: `[Repo ${i+1}/${total}] Cloning ${repoName}...` }, config);
    try {
      await execAsync(`git clone --depth 1 ${repo.url} ${repoPath}`, { timeout: 60000 });
      await execAsync(`npx repomix -o output.txt`, { cwd: repoPath, timeout: 120000 });
    } catch (e: any) {
      console.error(`[PROCESS REPO] error for ${repoName}:`, e.message);
      continue;
    }

    let textContent = "";
    try {
      textContent = await fs.readFile(path.join(repoPath, "output.txt"), "utf-8");
      textContent = textContent.replace(/\0/g, "");
    } catch (e) {
      continue;
    }

    await dispatchCustomEvent("progress", { msg: `[Repo ${i+1}/${total}] Embedding chunks...` }, config);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 4000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments([textContent.slice(0, 800000)]);
    
    const queryEmbedding = await embeddingProvider.embedText("architecture tech stack logical structure main dependencies");
    const contextChunks: { text: string; score: number }[] = [];
    
    const BATCH_SIZE = 16;
    for (let j = 0; j < docs.length; j += BATCH_SIZE) {
      const batchDocs = docs.slice(j, j + BATCH_SIZE);
      for (let k = 0; k < batchDocs.length; k++) {
         const emb = await embeddingProvider.embedText(batchDocs[k].pageContent);
         let score = 0;
         for (let m = 0; m < emb.length; m++) score += queryEmbedding[m] * emb[m];
         contextChunks.push({ text: batchDocs[k].pageContent, score });
         
         pendingDbWrites.push({
            targetTable: "project_embeddings",
            action: "insert",
            data: {
              chunk_index: j + k,
              chunk_text: batchDocs[k].pageContent,
              embedding: `[${emb.join(",")}]`,
              _repoNameRef: repoName,
            },
         });
      }
    }

    await dispatchCustomEvent("progress", { msg: `[Repo ${i+1}/${total}] Summarizing with LLM...` }, config);
    contextChunks.sort((a, b) => b.score - a.score);
    const topChunks = contextChunks.slice(0, 4).map(c => c.text).join("\n\n---\n\n");

    let summary = "";
    try {
      summary = await llmProvider.invoke(`Top relevant snippets:\n${topChunks}`, "You are a tech analyst. Summarize the logic, architecture, and tech stack from this repository excerpt concisely.");
    } catch(e: any) {
      summary = "Summary generation failed: " + e.message;
    }

    pendingDbWrites.unshift({
      targetTable: "projects_raw_text",
      action: "upsert",
      data: { repo_name: repoName, raw_text: `SUMMARY:\n${summary}\n\nRAW TEXT:\n${textContent}`, file_count: 1, repo_updated_at: updatedAt }
    });
  }

  return { pendingDbWrites, ingestedProjects: total };
}
