# Entity IDE Navigation & Relations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Entity IDE (Memory.tsx) into a fully interactive graph UI with collapsible navigation, clickable relation chips, and automated reverse lookups.

**Architecture:** 
1. Create a `RelationChip` UI component to gracefully render inline entity references.
2. Refactor `renderSidebarCategory` in `Memory.tsx` to maintain internal expanded/collapsed boolean state using React Hooks context or simple inner component.
3. Update the `editBuffer` property renderer to detect `Array.isArray` representing entity IDs, map them against the in-memory Zustand `entities` store, and output `RelationChip` elements.
4. Add a computed reverse-lookup section at the end of the Form that displays parent objects (Projects/Experiences) when visualizing a child (Skill).

**Tech Stack:** React, TailwindCSS, Zustand, IndexedDB

---

### Task 1: Create RelationChip Component

**Files:**
- Create: `src/components/RelationChip.tsx`
- Modify: None yet

**Step 1: Write the minimal implementation**
We don't need a rigorous unit test for a simple presentational UI component in a fast-paced frontend feature. Create the file structure with basic props: `id`, `type`, `label`, `onClick`.

```tsx
// src/components/RelationChip.tsx
import { Code2, Briefcase, Database, GraduationCap } from "lucide-react";

interface RelationChipProps {
  id: string;
  type: "skill" | "project" | "experience" | "education";
  label: string;
  onClick: (type: any, id: string) => void;
}

export function RelationChip({ id, type, label, onClick }: RelationChipProps) {
  const getIcon = () => {
    switch(type) {
      case "skill": return <Code2 className="w-3.5 h-3.5 mr-1.5" />;
      case "experience": return <Briefcase className="w-3.5 h-3.5 mr-1.5" />;
      case "project": return <Database className="w-3.5 h-3.5 mr-1.5" />;
      case "education": return <GraduationCap className="w-3.5 h-3.5 mr-1.5" />;
    }
  };

  return (
    <button
      onClick={() => onClick(type, id)}
      className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full text-xs font-medium transition-colors shadow-sm mr-2 mb-2"
    >
      {getIcon()}
      {label}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/RelationChip.tsx
git commit -m "feat: add RelationChip component for interactive relations"
```

---

### Task 2: Inject Relation Chips into `Memory.tsx` Editor

**Files:**
- Modify: `src/routes/Memory.tsx`

**Step 1: Import RelationChip and modify array rendering**
In `Memory.tsx`, import the component. Inside the `editBuffer` mapping loop, replace the `JSON.stringify(editBuffer[key])` block containing relation IDs with instances of `RelationChip`. Add a helper `resolveEntityName(id, entities)` to parse the human readable names of skills given the `id` from the array.

**Step 2: Commit**

```bash
git add src/routes/Memory.tsx
git commit -m "feat: replace raw json array strings with clickable relation chips"
```

---

### Task 3: Implement Reverse Lookups (Used In)

**Files:**
- Modify: `src/routes/Memory.tsx`

**Step 1: Compute and Render Reverse References**
Because relation bindings are only defined on the parent (a project defines its `skills`), the children (`Skill` entity) do not explicitly know their parent in the schema.
At the bottom of the right-side Editor pane inside `Memory.tsx`, if the `selectedEntity.type === 'skill'`, we iterate `entities.projects` and `entities.experiences` and find which ones `include` the selected skill's `id`. We then render `RelationChips` for the matching parents so the graph links bidirectionally.

**Step 2: Commit**

```bash
git add src/routes/Memory.tsx
git commit -m "feat: add dynamic bidirectional Used In reverse lookup sections"
```

---

### Task 4: Collapsible Left Sidebar Categories

**Files:**
- Modify: `src/routes/Memory.tsx`

**Step 1: Create local SidebarCategory component**
The `renderSidebarCategory` currently returns raw JSX without state. Change it to an inline functional component `<SidebarCategory />` inside `Memory` (or decouple it) that tracks `const [isOpen, setIsOpen] = useState(true)`.
Toggle the `isOpen` state when clicking the Category Header, smoothly hiding/showing the child items, adding a dynamic chevron angle for polish.

**Step 2: Commit**

```bash
git add src/routes/Memory.tsx
git commit -m "feat: make entity explorer sidebar categories collapsible"
```
