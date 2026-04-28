import React, { useRef, useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Cpu } from "lucide-react";
import { usePipelineStore } from "../../store/usePipelineStore";

export function AgentLogViewer() {
  const isRunning = usePipelineStore(s => s.isRunning);
  const inferenceLogs = usePipelineStore(s => s.inferenceLogs);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [inferenceLogs.length, expandedIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (next.size > 5) {
          const firstAdded = Array.from(next)[0];
          next.delete(firstAdded);
        }
      }
      return next;
    });
  };

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm overflow-hidden flex flex-col h-full max-h-[400px] w-full max-w-4xl mx-auto mt-6">
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider flex items-center">
          <Activity className="w-3 h-3 mr-2 text-cyan-500" />
          LLM Inference Telemetry
        </span>
        {isRunning && <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />}
      </div>
      <div className="flex-1 p-4 font-mono text-xs text-neutral-300 overflow-y-auto custom-scrollbar">
        <div className="space-y-3">
          {inferenceLogs.length === 0 && !isRunning && (
            <div className="text-neutral-600 italic">Waiting for agents...</div>
          )}
          {inferenceLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            return (
              <div key={log.id} className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50">
                <button 
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-center justify-between p-2 hover:bg-neutral-800/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-cyan-500" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <Cpu className="w-3 h-3 shrink-0 text-neutral-500" />
                    <span className="text-cyan-400 shrink-0">[{log.model}]</span>
                    <span className="truncate opacity-70 whitespace-nowrap overflow-hidden">
                      {log.prompt.split('\n')[0].substring(0, 80)}...
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 opacity-60 ml-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </button>
                
                {isExpanded && (
                  <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex flex-col gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 font-bold">Raw Prompt Given</div>
                      <div className="bg-neutral-900 border border-neutral-800 p-2 rounded whitespace-pre-wrap font-mono text-[10px] text-neutral-400 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {log.prompt}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-cyan-600 mb-1 font-bold">Agent Response Output</div>
                      <div className="bg-[#051515] border border-cyan-900/30 p-2 rounded whitespace-pre-wrap font-mono text-[10px] text-cyan-200">
                        {log.response}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} className="h-1" />
        </div>
      </div>
    </div>
  );
}
