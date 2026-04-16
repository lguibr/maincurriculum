# Multi-Agent Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Radically refactor the backend AI processing into a Multi-Agent Supervisor network, enforcing exact SRP, state-driven persistence, and explicitly structured tools/prompts.

**Architecture:** We are moving from a monolithic node sequence to a Hub and Spoke pattern. A Supervisor agent will route tasks to specialized sub-agents (`IngestionAgent`, `InterviewAgent`). The nodes will be pure functions; instead of executing raw SQL using `pool.query` inside the LLM loops, they will emit typed `DbDirective` objects into the LangGraph state. A dedicated `Persister` node will intercept these directives and save them to PostgreSQL.

**Tech Stack:** LangGraph, LangChain, TypeScript, Google GenAI (Gemini 3 Flash), Zod (for Structured Tooling), PostgreSQL

---

## Proposed File Structure

We will transition from the tightly coupled 2 files to a meticulously isolated folder structure:

```text
src/agent/
├── graph.ts                 (Supervisor logic overriding original)
├── state.ts                 (Updated with DbDirectives & Sub-Agent routing)
├── tools/
│   ├── index.ts
│   └── structuralSchemas.ts (Zod definitions for Ontology, CV formats)
├── prompts/
│   ├── interviewer.ts       (Extracted from raw files)
│   └── supervisor.ts
├── nodes/
│   └── persister.ts         (The single point of DB mutation)
└── subgraphs/
    ├── ingestion.ts
    └── interviewer.ts
```

---

### Task 1: Update Application State & Clean Up Folders

**Files:**
- Modify: `packages/backend/src/agent/state.ts`
- Create: `packages/backend/src/agent/tools/structuralSchemas.ts`

**Step 1: Standardize Zod Schemas**
Define formal Zod schemas for the Ontology (Skills, Experience, Education) so the LLM must obey strict structured outputs.

**Step 2: Update Graph State**
Modify `ProfileGraphState` to include `nextAgent: string` and `pendingDbWrites: Array<any>`.

### Task 2: Create the Pure Persister Node

**Files:**
- Create: `packages/backend/src/agent/nodes/persister.ts`

**Step 1: Extract `pool.query` logic**
Build a functional LangGraph Node that receives the state, iterates over `state.pendingDbWrites`, conditionally executes the `pg` pool queries, and then clears the array. This handles `INSERT INTO cv_versions`, `UPDATE user_profiles`, etc.

### Task 3: Extract Prompts

**Files:**
- Create: `packages/backend/src/agent/prompts/interviewer.ts`
- Create: `packages/backend/src/agent/prompts/supervisor.ts`

**Step 1: Migrate strings**
Rip all hardcoded template strings from `agent/nodes/interviewer.ts` and `agent/nodes/ingestor.ts` and put them into clean, pure functional templates in the `prompts/` directory.

### Task 4: Ingestion Sub-Graph

**Files:**
- Create: `packages/backend/src/agent/subgraphs/ingestion.ts`

**Step 1: Isolate HuggingFace and Git**
Move the `EmbedderPipeline` and Git `codeconcat` workflow out of the main loop. Convert them into a discrete sub-graph flow that just appends raw data to the state and queues a `DbDirective` for insertion.

### Task 5: Interviewer Sub-Graph

**Files:**
- Create: `packages/backend/src/agent/subgraphs/interviewer.ts`

**Step 1: Isolate Gemini Generations**
Rewrite the giant inline LLM calls to use `withStructuredOutput(zodSchema)`. The agent will only patch the State's copy of `demographics_json` rather than directly writing to the DB.

### Task 6: Supervisor Orchestrator

**Files:**
- Modify: `packages/backend/src/agent/graph.ts`
- Delete: `packages/backend/src/agent/nodes/ingestor.ts` (After migration is complete)
- Delete: `packages/backend/src/agent/nodes/interviewer.ts` 

**Step 1: Wire the Master Graph**
Construct the main `StateGraph`. Connect the Supervisor node to evaluate the current state and conditionally route to either the `Ingestion` subgraph or the `Interviewer` subgraph. Wire every edge to pass through the `Persister` node before reaching `END`.

---

## Verification Plan

### Automated Tests
- Validate TypeScript compilation `npm run lint`.
- Verify the API server correctly starts up without referencing the deleted files.

### Manual Verification
- We will trigger the API via the `/api/ingest/stream` SSE endpoint to ensure the new Supervisor structure correctly dispatches sub-agents and captures intermediate states.
