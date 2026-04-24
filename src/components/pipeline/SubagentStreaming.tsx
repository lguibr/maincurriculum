import { Loader2 } from "lucide-react";
import { SubagentStreamInterface } from "../../store/types";
import { SubagentCard } from "./SubagentCard";

export function SubagentStreaming({
  subagents,
}: {
  subagents: Record<string, SubagentStreamInterface>;
}) {
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
