import React, { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { SubagentStreamInterface } from "../../store/types";

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
    pending: { text: "Waiting", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    running: { text: "Running", className: "bg-blue-100 text-blue-700 animate-pulse dark:bg-blue-900 dark:text-blue-300" },
    complete: { text: "Done", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
    error: { text: "Error", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  };

  const badge = statusBadge[subagent.status] || statusBadge.pending;
  const formattedName = subagent.name.replace(/([A-Z])/g, " $1").trim();

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Loader2 className={`w-4 h-4 ${subagent.status === "running" ? "animate-spin text-primary" : "hidden"}`} />
          <h3 className="font-semibold">{formattedName}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.text}</span>
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
      </button>

      {!collapsed && subagent.content && (
        <div className="border-t px-4 py-3 bg-muted/10 custom-scrollbar overflow-y-auto max-h-[300px]">
          <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-xs whitespace-pre-wrap">
            {subagent.content}
            {subagent.status === "running" && <span className="inline-block h-4 w-1 animate-pulse bg-blue-500 ml-1 align-middle" />}
          </div>
        </div>
      )}
    </div>
  );
}
