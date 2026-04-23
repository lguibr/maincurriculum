# Frontend Gemma 4 Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely rewrite the CV/Repository ingestion pipeline to run 100% locally in the browser using Gemma 4 (via MediaPipe) for generative tasks, Transformers.js for embeddings, and IndexedDB for persistence, completely dropping LangChain, LangGraph, and PostgreSQL.

**Architecture:** We are moving from a heavy Backend/Postgres/LangGraph setup to a lightweight Frontend/WebGPU/IndexedDB architecture. The Vite React client will coordinate the workflow directly using `Zustand`. The `MediaPipe Tasks GenAI` library will load the latest Gemma 4 E2B/E4B `.task` models directly into the browser's WebGPU context. `Transformers.js` will handle vector embeddings. All state (user profiles, CV versions, chunks, and embeddings) will be persisted reliably in IndexedDB to remove the brittle DB connections.

**Tech Stack:** React, Zustand, `@mediapipe/tasks-genai`, `@huggingface/transformers`, `idb` (IndexedDB), Vite.

---

## Decision Log
*   **Decided:** Use Gemma 4 (released April 2026) for both inference and embeddings directly in the browser via WebGPU.
*   **Decided:** Discard the Node.js Express Backend Agent nodes, dropping LangChain and LangGraph entirely.
*   **Decided:** Move from PostgreSQL (`pgvector`) to IndexedDB for browser-native storage. Cosine similarity will be computed via optimized client-side JS arrays.

## Proposed Changes

### Task 1: Cleanup Legacy Backend
Remove the brittle multi-agent LangGraph workflow and PostgreSQL dependencies.

**Files:**
- Delete: `packages/backend/src/agent/nodes/ExtractEntities.ts`
- Delete: `packages/backend/src/agent/nodes/ImproveCV.ts`
- Delete: `packages/backend/src/agent/nodes/EmbedAndSummarize.ts`
- Delete: `packages/backend/src/agent/nodes/InterviewInterrupt.ts`
- Modify: `packages/backend/src/server.ts`

**Step 1:** Strip out any remaining ingestion API routes pointing to the old agent.

---

### Task 2: Frontend Dependencies & IndexedDB Setup

**Files:**
- Create: `packages/frontend/src/db/indexedDB.ts`
- Modify: `packages/frontend/package.json`

**Step 1:** Add dependencies.
Run: `cd packages/frontend && yarn add @mediapipe/tasks-genai @huggingface/transformers idb`

**Step 2:** Write `indexedDB.ts`
Implement a lightweight wrapper over `idb` to replace Postgres. It will include tables/stores for `cv_versions`, `experiences`, `skills`, `project_embeddings`.

---

### Task 3: MediaPipe & Transformers.js Integration

**Files:**
- Create: `packages/frontend/src/ai/Gemma4Inference.ts`
- Create: `packages/frontend/src/ai/GemmaEmbeddings.ts`

**Step 1:** Implement Gemma4 Inference Manager
Create a class wrapping `LlmInference.createFromOptions` from `@mediapipe/tasks-genai`, configured to load Gemma 4 E2B model weights. Include progress callbacks for downloading.

**Step 2:** Implement Embeddings Manager
Create a class wrapping `pipeline('feature-extraction', 'onnx-community/embeddinggemma-300m-ONNX', { device: 'webgpu' })` to generate standard dense vectors.

---

### Task 4: Zustand Workflow Orchestration

**Files:**
- Modify: `packages/frontend/src/store/useStore.ts`

**Step 1:** Rip out old Backend SSE logic.
Remove the `setupSseHandler` connecting to `api.ingest.getStreamUrl()`. 

**Step 2:** Implement In-Browser Pipeline
Rewrite `startAgent` and `startInterview` to be sequential, self-contained async functions within Zustand that call the new `Gemma4Inference`, `GemmaEmbeddings`, and `IndexedDB` utilities sequentially, managing their own `isRunning` and `progress` state effortlessly.

---

## Open Questions

> [!WARNING]
> WebGPU is required for reasonable performance. Gemma 4 E4B weights are large. Are you okay with the UI displaying a loading bar while it downloads a ~1.5GB - 2GB compressed Gemma 4 model directly to the user's browser cache on first load?

## Verification Plan

### Manual Verification
1. Run `npm run dev` and open `localhost:3000`.
2. Input a test CV and click "Start Ingestion".
3. Check the DevTools "Network" tab to confirm no backend APIs are triggered, and the `.task` / `.onnx` models correctly download.
4. Check the DevTools "Application -> IndexedDB" tab to confirm Entities, Skills, and Chunks are written natively.
5. Watch the Console output to observe clear, step-by-step UI progress logs.
