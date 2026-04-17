import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2, FolderGit2 } from "lucide-react";
import { SubagentStreamInterface } from "../store/useStore";

export interface PipelineNode {
  name: string;
  stateKey: string;
  label: string;
}

export const PIPELINE_NODES: PipelineNode[] = [
  { name: "IngestionAgent", stateKey: "ingestedProjects", label: "Repository Ingestion" },
  { name: "InterviewerAgent", stateKey: "finalSQLDemographics", label: "Profile Interview" },
  { name: "ImproverAgent", stateKey: "wizardCompleted", label: "CV Optimization" },
];

export function TodoList({
  nodes,
  values,
  subagents,
}: {
  nodes: typeof PIPELINE_NODES;
  values: Record<string, unknown>;
  subagents: Record<string, SubagentStreamInterface>;
}) {
  return (
    <div className="flex flex-col gap-2 w-full mb-6">
      {nodes.map((node, i) => {
        // Determine status purely from the subagents state or final values
        let status: "pending" | "running" | "complete" = "pending";
        if (values?.[node.stateKey] || subagents[node.name]?.status === "complete") {
          status = "complete";
        } else if (subagents[node.name] || Object.keys(subagents).length > 0 && i === 0 && !values[node.stateKey]) {
          // Heuristic: if any subagent of this node is running, it's running
          // Better: if the macro node started or we just heuristically know
          if (subagents[node.name]) {
            status = subagents[node.name].status as any;
          } else if (Object.keys(subagents).some(k => k.toLowerCase().includes(node.name.replace('Agent', '').toLowerCase()))) {
            status = "running";
          }
        }

        const colors = {
          pending: "text-muted-foreground border-transparent bg-muted/20",
          running: "text-primary border-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.2)] animate-pulse",
          complete: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
        };

        return (
          <div
            key={node.name}
            className={`flex items-center gap-3 p-3 rounded-md border transition-all ${colors[status]}`}
          >
            {status === "complete" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : status === "running" ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-semibold text-sm tracking-wide uppercase">
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SubagentCard({ subagent }: { subagent: SubagentStreamInterface }) {
  const [collapsed, setCollapsed] = useState(subagent.status === "complete");

  React.useEffect(() => {
    if (subagent.status === "complete") {
      setCollapsed(true);
    } else if (subagent.status === "running") {
      setCollapsed(false);
    }
  }, [subagent.status]);

  const statusBadge = {
    pending: {
      text: "Waiting",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
    running: {
      text: "Running",
      className: "bg-blue-100 text-blue-700 animate-pulse dark:bg-blue-900 dark:text-blue-300",
    },
    complete: {
      text: "Done",
      className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
    error: {
      text: "Error",
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    },
  };

  const badge = statusBadge[subagent.status] || statusBadge.pending;

  // Format node name from e.g. "DraftCV" to "Draft CV"
  const formattedName = subagent.name.replace(/([A-Z])/g, ' $1').trim();

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Loader2 className={`w-4 h-4 ${subagent.status === "running" ? "animate-spin text-primary" : "hidden"}`} />
          <h3 className="font-semibold">{formattedName}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && subagent.content && (
        <div className="border-t px-4 py-3 bg-muted/10 custom-scrollbar overflow-y-auto max-h-[300px]">
          <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-xs whitespace-pre-wrap">
            {subagent.content}
            {subagent.status === "running" && (
              <span className="inline-block h-4 w-1 animate-pulse bg-blue-500 ml-1 align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RepoProgressTracker({
  repoProgress,
}: {
  repoProgress: { current: number; total: number; currentRepoName: string; } | null;
}) {
  if (!repoProgress) return null;

  const percentage = Math.round((repoProgress.current / repoProgress.total) * 100);

  return (
    <div className="mb-4 p-4 rounded-xl border border-primary/30 bg-card/80 shadow-lg relative overflow-hidden shrink-0 animate-in fade-in zoom-in-95 duration-500">
      <div className="absolute top-0 right-0 p-8 bg-primary/10 blur-3xl rounded-full scale-150 transform -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="relative flex flex-col gap-3">
         <div className="flex justify-between items-center text-sm font-semibold tracking-wide text-foreground">
            <span className="flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-primary" />
              Processing: <span className="text-primary">{repoProgress.currentRepoName}</span>
            </span>
            <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded-md text-xs border border-border/50">
              {repoProgress.current} / {repoProgress.total} Repositories
            </span>
         </div>
         <div className="h-2.5 w-full bg-muted/80 rounded-full overflow-hidden shadow-inner border border-black/20">
           <div className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.8)]" style={{ width: `${percentage}%` }} />
         </div>
      </div>
    </div>
  );
}

export function SubagentStreaming({
  subagents,
  repoProgress,
}: {
  subagents: Record<string, SubagentStreamInterface>;
  repoProgress?: { current: number; total: number; currentRepoName: string; } | null;
}) {
  // Filter out top-level structural nodes to focus on true subagents
  const filteredSubagents = Object.values(subagents).filter(
    (agent) =>
      !["IngestionAgent", "InterviewerAgent", "ImproverAgent", "Supervisor", "Persister"].includes(
        agent.name
      )
  );

  if (filteredSubagents.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
        <p className="text-sm">Awaiting subagent dispatch...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <RepoProgressTracker repoProgress={repoProgress || null} />
      <div className="space-y-3 w-full flex-1 overflow-y-auto custom-scrollbar p-1">
        {filteredSubagents.map((agent) => (
          <SubagentCard key={agent.id} subagent={agent} />
        ))}
      </div>
    </div>
  );
}
