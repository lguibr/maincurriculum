# Master CV & Visual Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the AI Interview to exactly 7 deterministic, non-redundant questions. Transform the Timeline module into an aesthetic, 4-tier visual analytics suite. Upgrade the Master CV Improver to generate massive, markdown-heavy architecture documents featuring embedded Mermaid diagrams for all projects.

**Architecture:** 
1. **State Machine:** The interview loop in `pipelineActions.ts` will discard the static `length < 10` check. It will dynamically query IndexedDB to sort Experiences and Projects chronologically, locking the 7 questions explicitly to: [1 Edu, 2 Projects, 4 Experiences (3rd, 2nd, 1st, 1st)].
2. **Graphical Rendering:** `Timeline.tsx` will parse the relational DB to output 4 distinct Mermaid blocks (experiences, educations, projects, skills timeline) wrapped in premium glassmorphic UI.
3. **Prompt Engineering:** The final `startImprover` function will be injected with a severe architectural prompt forcing system diagrams and exhaustive Markdown.

**Tech Stack:** React, TailwindCSS, Mermaid.js, Gemini API, IndexedDB.

---

### Task 1: Initialize Timeline Routing & Data Restructuring
**Files:**
- Modify: `src/routes/Timeline.tsx`

**Step 1:** Abstract the single timeline string into 4 discrete states: `expMd`, `projMd`, `eduMd`, `skillsMd`.
**Step 2:** Refactor the Database sorting to pull specific arrays and loop through them building independent Mermaid charts.
**Step 3:** Implement Shadcn-style Card layout mapping to separate scrollable columns.
**Step 4:** Deploy 1-day fallback for missing end dates on GitHub repos.

### Task 2: 7-Question Interview Engine
**Files:**
- Modify: `src/actions/pipelineActions.ts`

**Step 1:** Replace the hardcoded `newHistory.length < 10` block with an array map: `QUESTION_SCHEMA = ["Education", "Project_Latest", "Project_Oldest", "Exp_3", "Exp_2", "Exp_Latest_1", "Exp_Latest_2"]`.
**Step 2:** Force the `generateValidatedQuestion` to ingest *only* the specific DB entity in context for that step instead of dumping the entire `baseCv`.
**Step 3:** Trigger the DB sync after the 7th iteration instead of the 10th.

### Task 3: Heavy Master CV Generator
**Files:**
- Modify: `src/actions/pipelineActions.ts`

**Step 1:** Update `startImprover` prompt to force Markdown structural generation.
**Step 2:** Demand the inclusion of ```mermaid classDiagram``` injections to map relations between the core project layers.
**Step 3:** Append the final generated document directly to the user's Dashboard `/improve` route.
