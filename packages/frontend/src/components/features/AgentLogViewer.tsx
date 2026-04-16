import React, { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";

interface AgentLogViewerProps {
  progress: { node: string; message: string }[];
  isRunning: boolean;
}

export function AgentLogViewer({ progress, isRunning }: AgentLogViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [progress]);

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-64">
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider flex items-center">
          <Activity className="w-3 h-3 mr-2 text-neutral-500" />
          Agent Execution Log
        </span>
        {isRunning && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
      </div>
      <ScrollArea className="flex-1 p-4 font-mono text-xs text-neutral-300">
        <div className="space-y-2">
          {progress.length === 0 && !isRunning && (
            <div className="text-neutral-600 italic">Waiting to start...</div>
          )}
          {progress.map((msg, i) => (
            <div key={i} className="flex items-start">
              <span className="text-emerald-500 mr-2">➜</span>
              <span>{msg.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
