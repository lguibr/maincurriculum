# Ingestion & Interview Pipeline Refactor Design

## Understanding Summary
- **What is being built:** A flattened, strictly linear LangGraph pipeline for the AI Curriculum ingestion and interview flow, supported by clean Provider abstractions.
- **Why it exists:** 
  1. To drastically improve reliability of structured JSON extraction (handling gemma4's text padding).
  2. To eliminate complex logic (e.g. fork-joins) making it easier to debug.
  3. To build 'Future-Browser' proof abstractions so the underlying LLM, Embedder, and Persistence mechanisms can be swapped for fully local/browser variants (like indexedDb, webLLM, or Transformers.js w/ EmbeddingGemma) effortlessly.
- **Who it is for:** Single user operation, local first.
- **Key constraints:** The entire LangGraph state machine must interact ONLY with interfaces (`ILLMProvider`, `IEmbeddingProvider`, `IPersistenceProvider`), preventing coupling to Node.js APIs or Ollama specifically.

## Assumptions
- `OllamaProvider` (the LLM wrapper) will have smart self-healing logic (regex, markdown stripping) and an automatic 2-retry minimum to guarantee valid JSON formatting.
- `PostgresProvider` will handle all DB ops, setting up the exact signatures we'll later replicate in `IndexedDBProvider`.
- Performance is bound by local resources, meaning speed comes from proper abstractions and avoiding excessive LLM re-prompts via the reliable wrapper extraction.

## Decision Log
1. **Decision:** We will maintain LangGraph over a pure manual Async State Machine.
   **Alternative Considered:** Dropping LangGraph completely.
   **Reasoning:** LangGraph provides native visualization and interrupt tools out of the box, and a flattened LangGraph is easy enough to maintain.
2. **Decision:** We will create a Universal Provider Interface pattern bridging the DB, Embedder, and LLM.
   **Alternative Considered:** Just wrapping the LLM.
   **Reasoning:** Extending the wrapper to the Embedder and Persistence layer fully unblocks moving the pipeline into the browser in the future (e.g., using Transformers.js for embeddings).
3. **Decision:** The complex 5-phase Critique node will be collapsed into a single LLM operation.
   **Alternative Considered:** Keeping the fork-join parallel topology.
   **Reasoning:** The fork-join was too complex and prone to errors. A single heavy-context prompt is cleaner, more predictable, and fits a linear execution pipeline perfectly.

## Final Design
The architecture will reside in `packages/backend/src/agent/providers/`.

1. **Provider Interfaces**
   - `ILLMProvider` -> `extractStructuredJSON()`
   - `IEmbeddingProvider` -> `embedText()`
   - `IPersistenceProvider` -> `saveProfile()`, `loadState()`
2. **Graph Refactor**
   - We will replace `graph.ts`, `ingestion.ts`, `interviewer.ts` and `improver.ts` with a single, linear graph setup that uses the Provider instances from heavily abstracted injection functions.
   - Flow: `FetchRepositories` ➡️ `EmbedAndSummarize` ➡️ `ExtractEntities` ➡️ `EvaluateCompleteness` ➡️ `ImproveCV` ➡️ `InterviewInterrupt`.
