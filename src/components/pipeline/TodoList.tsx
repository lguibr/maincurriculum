import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { SubagentStreamInterface } from "../../store/types";
import { PIPELINE_NODES } from "./types";

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
        let status: "pending" | "running" | "complete" = "pending";
        if (values?.[node.stateKey] || subagents[node.name]?.status === "complete") {
          status = "complete";
        } else if (
          subagents[node.name] ||
          (Object.keys(subagents).length > 0 && i === 0 && !values[node.stateKey])
        ) {
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
