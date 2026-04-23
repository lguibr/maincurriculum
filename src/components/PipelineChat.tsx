import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2, FolderGit2 } from "lucide-react";
import { SubagentStreamInterface } from "../store/types";

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
        } else if (
          subagents[node.name] ||
          (Object.keys(subagents).length > 0 && i === 0 && !values[node.stateKey])
        ) {
          // Heuristic: if any subagent of this node is running, it's running
          // Better: if the macro node started or we just heuristically know
          if (subagents[node.name]) {
            status = subagents[node.name].status as any;
          } else if (
            Object.keys(subagents).some((k) =>
              k.toLowerCase().includes(node.name.replace("Agent", "").toLowerCase())
            )
          ) {
            status = "running";
          }
        }

        const colors = {
          pending: "text-muted-foreground border-transparent bg-muted/20",
          running:
            "text-primary border-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.2)] animate-pulse",
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
            <span className="font-semibold text-sm tracking-wide uppercase">{node.label}</span>
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
  const formattedName = subagent.name.replace(/([A-Z])/g, " $1").trim();

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Loader2
            className={`w-4 h-4 ${subagent.status === "running" ? "animate-spin text-primary" : "hidden"}`}
          />
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

import { Clock } from "lucide-react";

export function RepoProgressTracker({
  targetRepos,
  reposProgress,
  globalProgressOverride,
  globalPhaseOverride,
}: {
  targetRepos: string[];
  reposProgress: Record<
    string,
    {
      phase: string;
      progress: number;
      currentPhaseProgress: number;
      timeStarted?: number;
      etaSeconds?: number;
    }
  >;
  globalProgressOverride: number;
  globalPhaseOverride?: string;
}) {
  let completedRepos = 0;
  let activeEta = 0;
  let hasValidEta = false;

  targetRepos.forEach((repo) => {
    const rp = reposProgress[repo];
    if (rp?.progress === 100) completedRepos++;
    if (rp?.etaSeconds !== undefined && rp.progress > 0 && rp.progress < 100) {
      activeEta += rp.etaSeconds;
      hasValidEta = true;
    }
  });

  const isPending = targetRepos.length === 0;
  let totalPercentage = isPending
    ? globalProgressOverride
    : Math.round((completedRepos / targetRepos.length) * 100) || 0;

  // Derive global pending message tracking
  const pendingMessage =
    globalProgressOverride > 0 && globalPhaseOverride
      ? globalPhaseOverride
      : "Waiting for launch sequence...";

  // Format ETA dynamically
  const formatETA = (seconds: number) => {
    if (seconds <= 0) return "Done";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  return (
    <div className="flex flex-col w-full gap-5 shrink-0 animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto pb-4">
      {/* Global Progress Dashboard */}
      <div className="flex-1 px-6 py-5 rounded-2xl border border-white/10 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Ingestion Engine
                {!isPending && totalPercentage < 100 && (
                  <span className="flex h-2 w-2 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                )}
              </h2>
              <p className="text-sm tracking-wide text-muted-foreground mt-1">
                {isPending
                  ? pendingMessage
                  : `Processing ${completedRepos} of ${targetRepos.length} Repositories`}
              </p>
            </div>

            {/* Dynamic ETA Widget */}
            {!isPending && totalPercentage < 100 && hasValidEta && (
              <div className="flex items-center gap-2 bg-black/20 dark:bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg shadow-inner">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-mono tracking-wider font-semibold text-primary/90">
                  est. {formatETA(activeEta)}
                </span>
              </div>
            )}
          </div>

          {/* Global Progress Bar */}
          <div className="relative h-3 mt-1 w-full bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-[800ms] ease-out shadow-[0_0_15px_rgba(var(--primary),0.6)]"
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Micro Repos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {isPending ? (
          <div className="col-span-full py-16 text-center text-muted-foreground/60 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/5 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 mb-3 opacity-20 animate-spin" />
            <p className="tracking-wide text-sm">
              {globalProgressOverride > 0
                ? "Analyzing source systems and determining target repositories..."
                : "No active repositories. Waiting for launch command..."}
            </p>
          </div>
        ) : (
          targetRepos.map((repoName) => {
            const rp = reposProgress[repoName];
            const progress = rp?.progress || 0;
            const phase = rp?.phase || "Waiting...";
            const eta = rp?.etaSeconds;
            const isComplete = progress === 100;
            const isRunning = progress > 0 && progress < 100;

            return (
              <div
                key={repoName}
                className={`px-5 py-4 rounded-xl border relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
                  isComplete
                    ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_4px_20px_rgba(16,185,129,0.05)]"
                    : isRunning
                      ? "border-primary/30 bg-background/60 shadow-[0_4px_20px_rgba(var(--primary),0.08)]"
                      : "border-white/5 bg-background/30"
                }`}
              >
                {isRunning && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                )}

                <div className="relative flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <FolderGit2
                        className={`w-4 h-4 shrink-0 ${isComplete ? "text-emerald-500" : isRunning ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span
                        className={`font-semibold text-sm truncate tracking-tight ${isComplete ? "text-emerald-400" : isRunning ? "text-primary" : "text-muted-foreground"}`}
                        title={repoName}
                      >
                        {repoName}
                      </span>
                    </div>

                    {isRunning && eta !== undefined && (
                      <span className="text-[10px] font-mono font-medium text-muted-foreground bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                        {formatETA(eta)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    <span
                      className="text-xs text-muted-foreground tracking-wide flex items-center gap-1.5 font-medium truncate"
                      title={phase}
                    >
                      {isRunning && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                      {phase}
                    </span>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div
                        className={`h-full transition-all duration-[800ms] ease-out ${isComplete ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SubagentStreaming({
  subagents,
}: {
  subagents: Record<string, SubagentStreamInterface>;
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
      <div className="space-y-3 w-full flex-1 overflow-y-auto custom-scrollbar p-1">
        {filteredSubagents.map((agent) => (
          <SubagentCard key={agent.id} subagent={agent} />
        ))}
      </div>
    </div>
  );
}
