# Pipeline Flow and Providers Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely flatten the LangGraph architecture into a single linear pipeline and implement robust `ILLMProvider`, `IEmbeddingProvider`, and `IPersistenceProvider` interfaces to ensure reliable JSON extraction and future browser-portability.

**Architecture:** Create strict TypeScript interfaces in `packages/backend/src/agent/providers`. Implement concrete Node.js/Ollama versions of these providers. Rewrite `graph.ts` to be a single linear sequence of nodes (`Fetch` -> `Embed` -> `Extract` -> `Evaluate` -> `Improve` -> `Interview`), replacing the three multi-node subgraphs and eliminating the complex 5-phase fork/join logic.

**Tech Stack:** TypeScript, LangGraph, Ollama, Xenova/Transformers, pg (Postgres)

---

### Task 1: Create the Provider Interfaces

**Files:**
- Create: `packages/backend/src/agent/providers/interfaces.ts`

**Step 1: Write the minimal implementation**

```typescript
// packages/backend/src/agent/providers/interfaces.ts
import { ZodSchema } from "zod";

export interface ILLMProvider {
  invoke(prompt: string, systemPrompt?: string): Promise<string>;
  extractStructuredJSON<T>(schema: ZodSchema, prompt: string, systemPrompt?: string): Promise<T>;
}

export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[]>;
}

// Simplified generic persistence provider for the agent context
export interface IPersistenceProvider {
  executeQuery(query: string, values: any[]): Promise<any>;
}
```

**Step 2: Commit**

```bash
git add packages/backend/src/agent/providers/interfaces.ts
git commit -m "feat: setup strict provider interfaces"
```

### Task 2: Implement the Robust Ollama Provider

**Files:**
- Create: `packages/backend/src/agent/providers/OllamaProvider.ts`

**Step 1: Write the LLM wrapper with regex healing and retry**

```typescript
// packages/backend/src/agent/providers/OllamaProvider.ts
import { ILLMProvider } from "./interfaces";
import { ChatOllama } from "@langchain/ollama";
import { ZodSchema } from "zod";

export class OllamaProvider implements ILLMProvider {
  private llm: ChatOllama;

  constructor(model: string = "gemma4", temp: number = 0) {
    this.llm = new ChatOllama({ model, temperature: temp, maxRetries: 0 });
  }

  async invoke(prompt: string, systemPrompt: string = ""): Promise<string> {
    const msgs = systemPrompt ? [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] : [{ role: "user", content: prompt }];
    const res = await this.llm.invoke(msgs);
    return res.content.toString();
  }

  async extractStructuredJSON<T>(schema: ZodSchema, prompt: string, systemPrompt: string = ""): Promise<T> {
    const structuredLlm = this.llm.withStructuredOutput(schema);
    let attempts = 0;
    const maxRetries = 2;
    let latestError = "";

    while (attempts <= maxRetries) {
      try {
        const msgs = [{ role: "system", content: systemPrompt + (latestError ? `\n\nFix this error from previous output: ${latestError}` : "") }, { role: "user", content: prompt }];
        const res = await structuredLlm.invoke(msgs);
        return res as T;
      } catch (err: any) {
        attempts++;
        latestError = err.message || "Failed to parse JSON.";
        if (attempts > maxRetries) throw new Error(`LLM Structured Output Failed: ${latestError}`);
      }
    }
    throw new Error("Failed to extract JSON");
  }
}
```

**Step 3: Commit**

```bash
git add packages/backend/src/agent/providers/OllamaProvider.ts
git commit -m "feat: implement self-healing Ollama provider"
```

### Task 3: Implement Embedding and Persistence Providers

**Files:**
- Create: `packages/backend/src/agent/providers/XenovaProvider.ts`
- Create: `packages/backend/src/agent/providers/PostgresProvider.ts`

**Step 1: Implement Xenova Embedder**

```typescript
// packages/backend/src/agent/providers/XenovaProvider.ts
import { IEmbeddingProvider } from "./interfaces";
import { EmbedderPipeline } from "../subgraphs/ingestion"; // Temporarily use existing pipeline

export class XenovaProvider implements IEmbeddingProvider {
  async embedText(text: string): Promise<number[]> {
    const embedder = await EmbedderPipeline.getInstance();
    const res = await embedder([text], { pooling: "mean", normalize: true });
    return res.tolist()[0];
  }
}
```

**Step 2: Implement Postgres Persistence Layer**

```typescript
// packages/backend/src/agent/providers/PostgresProvider.ts
import { IPersistenceProvider } from "./interfaces";
import { pool } from "../../../db/client";

export class PostgresProvider implements IPersistenceProvider {
  async executeQuery(query: string, values: any[]): Promise<any> {
    const res = await pool.query(query, values);
    return res.rows;
  }
}
```

**Step 3: Commit**

```bash
git add packages/backend/src/agent/providers/XenovaProvider.ts packages/backend/src/agent/providers/PostgresProvider.ts
git commit -m "feat: implement Xenova and Postgres providers"
```

### Task 4: Centralize the Linear LangGraph

**Files:**
- Modify: `packages/backend/src/agent/graph.ts`
- Modify: `packages/backend/src/agent/state.ts`

**Step 1: Refactor graph.ts into a single linear workflow**
Remove all subgraph imports and routing logic. Keep it strictly to the new linear nodes: `FetchRepositories`, `EmbedAndSummarize`, `ExtractEntities`, `EvaluateCompleteness`, `ImproveCV`, `InterviewInterrupt`. 

*(Implementation details for the graph refactor nodes will follow the existing business logic but use the injected dependencies instead of direct calls).*

**Step 2: Commit**
```bash
git add packages/backend/src/agent/graph.ts packages/backend/src/agent/state.ts
git commit -m "refactor: flatten LangGraph architecture into linear steps"
```
