# Timeline Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated route (`/timeline`) in the Next.js/React dashboard that programmatically queries IndexedDB to generate a robust Markdown document detailing timeline (Gantt charts), skill frequencies, and total duration metrics for the user's career.

**Architecture:** 
- Implement `Timeline.tsx` combining React hooks with `dbOps` to fetch `experiences`, `projects`, and `educations`.
- Perform date math to aggregate time-spent per skill (start_date to end_date).
- String syntax for Mermaid.js (`gantt`) injected directly into a downloadable markdown template.
- Mount the new route on `App.tsx` and place a navigation link in the `Dashboard.tsx` Sidebar.

**Tech Stack:** React, TypeScript, IndexedDB (idb), TailwindCSS, MermaidJS syntax.

---

### Task 1: Create the Generator Logic & Timeline Page Component

**Files:**
- Create: `src/routes/Timeline.tsx`

**Step 1: Write the generation logic and component scaffolding**

```tsx
import { useEffect, useState } from "react";
import { dbOps } from "../db/indexedDB";
import { Download, Copy, BarChart3 } from "lucide-react";

export default function Timeline() {
  const [markdown, setMarkdown] = useState<string>("Generating...");

  useEffect(() => {
    (async () => {
      const exps = await dbOps.getExperiences();
      const edus = await dbOps.getEducations();
      const projs = await dbOps.getProjects();
      const skills = await dbOps.getSkills();

      let md = "# Career & Skills Timeline\n\n";
      
      // Calculate active durations per skill
      const skillCounts: Record<string, number> = {};
      const skillDurationsMonths: Record<string, number> = {};
      
      md += "## Experience Gantt Chart\n\n```mermaid\ngantt\n";
      md += "    title Professional Timeline\n";
      md += "    dateFormat YYYY-MM-DD\n";
      md += "    axisFormat %Y\n";
      
      exps.sort((a,b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
      
      for (const exp of exps) {
        md += `    section ${exp.company}\n`;
        const st = exp.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : "2000-01-01";
        const isPresent = exp.end_date?.toLowerCase().includes("present") || !exp.end_date;
        const ed = isPresent ? new Date().toISOString().split('T')[0] : new Date(exp.end_date!).toISOString().split('T')[0];
        
        md += `    ${exp.role} : ${st}, ${ed}\n`;
        
        const m1 = new Date(st);
        const m2 = new Date(ed);
        const months = (m2.getFullYear() - m1.getFullYear())*12 + (m2.getMonth() - m1.getMonth());
        
        // aggregate skills
        exp.skills?.forEach(sId => {
          skillCounts[sId] = (skillCounts[sId] || 0) + 1;
          skillDurationsMonths[sId] = (skillDurationsMonths[sId] || 0) + months;
        });
      }
      
      projs.forEach(p => {
        p.skills?.forEach(sId => {
          skillCounts[sId] = (skillCounts[sId] || 0) + 1;
        });
      });
      
      md += "```\n\n## Skill Matrix & Durations\n\n";
      md += "| Skill | Mentions | Approx. Experience (Months) |\n|------|----------|---------------------------|\n";
      
      const sortedSkills = Object.entries(skillCounts).sort((a,b) => b[1] - a[1]);
      for (const [id, count] of sortedSkills) {
        const skillName = skills.find(s => s.id === id)?.name || id;
        const dur = skillDurationsMonths[id] || 0;
        md += `| ${skillName} | ${count} | ${dur > 0 ? dur + ' mo' : '-'} |\n`;
      }
      
      setMarkdown(md);
    })();
  }, []);

  return (
    <div className="p-8 h-full flex flex-col gap-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-primary"/> Timeline Analytics</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => navigator.clipboard.writeText(markdown)}
            className="flex items-center px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-semibold"
          >
            <Copy className="w-4 h-4 mr-2" /> Copy MD
          </button>
          <button 
            onClick={() => {
              const element = document.createElement("a");
              const file = new Blob([markdown], {type: 'text/markdown'});
              element.href = URL.createObjectURL(file);
              element.download = "curriculum-timeline.md";
              document.body.appendChild(element);
              element.click();
            }}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-semibold"
          >
            <Download className="w-4 h-4 mr-2" /> Download MD
          </button>
        </div>
      </div>
      <div className="flex-1 bg-black/40 border border-border/40 rounded-xl p-4 font-mono text-sm text-green-400 whitespace-pre-wrap overflow-y-auto">
        {markdown}
      </div>
    </div>
  );
}
```

**Step 2: Commit (Conceptual)**
```bash
git add src/routes/Timeline.tsx
git commit -m "feat: add programmatic timeline generator using IDB"
```

### Task 2: Inject the Route into Global App Layout

**Files:**
- Modify: `src/App.tsx:47-49`
- Modify: `src/routes/Dashboard.tsx:47-49`

**Step 1: Write the minimal implementation for Routing**

```diff
// App.tsx
- import Memory from "./routes/Memory";
+ import Memory from "./routes/Memory";
+ import Timeline from "./routes/Timeline";

- <Route path="memory" element={<Memory />} />
+ <Route path="memory" element={<Memory />} />
+ <Route path="timeline" element={<Timeline />} />
```

**Step 2: Add to Sidebar Navigation**

```diff
// Dashboard.tsx
- import { FolderGit2, Briefcase, ChevronRight, Home, Activity, Database } from "lucide-react";
+ import { FolderGit2, Briefcase, ChevronRight, Home, Activity, Database, BarChart3 } from "lucide-react";

// inside nav under Agent Context Link...
+          <Link
+            to="/timeline"
+            className={\`flex items-center px-3 py-2 rounded-lg transition-all \${isActive("/timeline") ? "bg-amber-500/10 text-amber-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}\`}
+          >
+            <BarChart3 className="w-4 h-4 mr-3" /> Timeline Metrics
+          </Link>
```

**Step 3: Test integration**
Clicking "Timeline Metrics" on the dashboard should load the component, query IndexedDB, and spit out Mermaid.js charting data on-screen.

**Step 4: Commit**
```bash
git add src/App.tsx src/routes/Dashboard.tsx
git commit -m "feat: connect timeline component to app routing and sidebar"
```

---
