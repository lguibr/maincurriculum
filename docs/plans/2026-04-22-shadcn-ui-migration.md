# Shadcn/UI Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Completely replace the custom, hard-to-maintain frontend primitive UI components with standardized Shadcn/UI v4 components initialized with a clean Zinc dark theme.

**Architecture:** 
We will delete the existing manual primitives inside `packages/frontend/src/components/ui`, configure `components.json` for Vite and Tailwind 4, and use the `npx shadcn@latest add` CLI to re-populate the components securely. We will then update any consuming dashboard files (`Onboarding.tsx`, `EntityDashboard.tsx`) to resolve prop mismatches (e.g., standardizing `checked` vs `defaultChecked` logic).

**Tech Stack:** React 19, Tailwind CSS v4 (@tailwindcss/vite), Shadcn/UI v4, Lucide-React.

---

### Task 1: Clean Up Legacy Component Artifacts

**Files:**
- Delete: `packages/frontend/components/ui/button.tsx` (and other related primitives)

**Step 1: Destroy legacy UI folder**
Run: `rm -rf packages/frontend/src/components/ui packages/frontend/components/ui`
Expected: Folder is deleted to prevent collision.

**Step 2: Commit cleanup**
```bash
cd packages/frontend
git add .
git commit -m "chore: remove legacy ui components prior to shadcn initialization"
```

---

### Task 2: Re-Initialize Shadcn Config

**Files:**
- Create/Modify: `packages/frontend/components.json`
- Modify: `packages/frontend/src/index.css` (or wherever standard styles live)

**Step 1: Run Shadcn Initialization**
Run: `cd packages/frontend && npx -y shadcn@latest init -d`
*Note: We assume non-interactive default. In Tailwind v4, shadcn creates a standard tailwind css setup inside the global index.*
Expected: Successful creation of `components.json` and base CSS variables.

**Step 2: Apply Dark Mode defaults**
Modify: `package.json` to ensure `tailwind-merge` and `clsx` dependencies are up to date if the CLI missed them.

**Step 3: Commit Initialization**
```bash
git add packages/frontend/components.json packages/frontend/src/
git commit -m "build: init shadcn v4 with generic zinc theme"
```

---

### Task 3: Install Core Components

**Files:**
- Create: `packages/frontend/src/components/ui/button.tsx`, `checkbox.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`

**Step 1: Run Shadcn add CLI**
Run: `cd packages/frontend && npx shadcn@latest add button input textarea label checkbox --yes`
Expected: The files are downloaded directly into the newly bound component aliased folder.

**Step 2: Commit generation**
```bash
git add packages/frontend/src/components/ui/
git commit -m "feat: install generic shadcn core components"
```

---

### Task 4: Fix Consumer Syntax & Component Alignments

**Files:**
- Modify: `packages/frontend/src/routes/Onboarding.tsx`
- Modify: `packages/frontend/src/components/EntityDashboard.tsx`

**Step 1: Align Import Paths**
Verify aliases match standard `@/components/ui/...` if the CLI initialized the tsconfig with `@/*`. Update any files pointing to `../components/ui/...` with relative or absolute paths.

**Step 2: Fix Prop Collisions**
Ensure `disabled` logic, `onClick`, and `onChange` signatures line up. `Checkbox` in Shadcn expects `onCheckedChange={(checked) => ...}` instead of generic HTML `onChange`. The old components might have relied on normal input tags wrapped in divs. 

**Step 3: Run Typecheck**
Run: `cd packages/frontend && npm run typecheck`
Expected: PASS with 0 unresolved imports.

**Step 4: Commit UI bindings**
```bash
git add packages/frontend/src/routes/ packages/frontend/src/components/
git commit -m "refactor: bind dashboard routes to newly installed shadcn modules"
```
