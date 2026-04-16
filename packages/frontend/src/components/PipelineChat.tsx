import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type NodeStatus = "idle" | "streaming" | "complete";

export interface PipelineNode {
  name: string;
  stateKey: string;
  label: string;
}

export const PIPELINE_NODES: PipelineNode[] = [
  { name: "IngestionAgent", stateKey: "ingestedProjects", label: "Repository Ingestion" },
  { name: "InterviewerAgent", stateKey: "finalSQLDemographics", label: "Profile Interview" },
  { name: "Persister", stateKey: "wizardCompleted", label: "Database Commit" }
];

const PIPELINE_NODE_NAMES = new Set(PIPELINE_NODES.map((n) => n.name));

export function getStreamingContent(
  events: any[]
): Record<string, string> {
  const content: Record<string, string> = {};

  for (const evt of events) {
    if (evt.event === "on_chat_model_stream") {
      let node = evt.metadata?.langgraph_node;
      
      // Route internal deepagent nodes to the correct parent NodeCard
      if (evt.metadata?.checkpoint_ns?.includes("IngestionAgent")) {
         node = "IngestionAgent";
      } else if (evt.metadata?.checkpoint_ns?.includes("InterviewerAgent")) {
         node = "InterviewerAgent";
      }

      if (node && PIPELINE_NODE_NAMES.has(node)) {
        if (!content[node]) content[node] = "";
        content[node] += evt.data?.chunk?.text || "";
      }
    }
  }

  return content;
}

export function getNodeStatus(
  node: PipelineNode,
  streamingContent: Record<string, string>,
  values: Record<string, unknown>
): NodeStatus {
  if (values?.[node.stateKey]) return "complete";
  if (streamingContent[node.name]) return "streaming";
  return "idle";
}

function formatContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

export function NodeCard({
  node,
  status,
  streamingContent,
  completedContent,
}: {
  node: PipelineNode;
  status: NodeStatus;
  streamingContent: string | undefined;
  completedContent: unknown;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const displayContent =
    status === "complete"
      ? formatContent(completedContent)
      : streamingContent ?? "";

  const statusBadge = {
    idle: { text: "Waiting", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    streaming: {
      text: "Running",
      className: "bg-blue-100 text-blue-700 animate-pulse dark:bg-blue-900 dark:text-blue-300",
    },
    complete: { text: "Done", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  };

  const badge = statusBadge[status];

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{node.label}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.text}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
      </button>

      {!collapsed && displayContent && (
        <div className="border-t px-4 py-3 bg-card custom-scrollbar overflow-y-auto max-h-[300px]">
          <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-xs whitespace-pre-wrap">
            {displayContent}
            {status === "streaming" && (
              <span className="inline-block h-4 w-1 animate-pulse bg-blue-500 ml-1 align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NodeCardList({
  nodes,
  events,
  values
}: {
  nodes: typeof PIPELINE_NODES;
  events: any[];
  values: Record<string, unknown>;
}) {
  const streamingContent = getStreamingContent(events);

  return (
    <div className="space-y-3 w-full h-full overflow-y-auto custom-scrollbar p-2">
      {nodes.map((node) => {
        const status = getNodeStatus(node, streamingContent, values);
        return (
          <NodeCard
            key={node.name}
            node={node}
            status={status}
            streamingContent={streamingContent[node.name]}
            completedContent={values?.[node.stateKey]}
          />
        );
      })}
    </div>
  );
}

export function PipelineProgress({
  nodes,
  values,
  events,
}: {
  nodes: typeof PIPELINE_NODES;
  values: Record<string, unknown>;
  events: any[];
}) {
  const streamingContent = getStreamingContent(events);

  return (
    <div className="flex flex-wrap items-center gap-1 justify-center w-full my-4">
      {nodes.map((node, i) => {
        const status = getNodeStatus(node, streamingContent, values);
        const colors = {
          idle: "bg-muted text-muted-foreground border-transparent",
          streaming: "bg-primary text-primary-foreground animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)] border-primary",
          complete: "bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] border-emerald-500",
        };

        return (
          <div key={node.name} className="flex items-center">
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium border ${colors[status]}`}
            >
              {node.label}
            </div>
            {i < nodes.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-6 ${
                  status === "complete" ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
