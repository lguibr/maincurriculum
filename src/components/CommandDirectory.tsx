import { Archive, Database, FileText, FolderTree, Terminal } from "lucide-react";
import { useStore } from "../store/useStore";

export function CommandDirectory() {
  const { knowledgeBaseTree, reposProgress } = useStore();

  return (
    <div className="h-full flex flex-col bg-[#0f141b] border-r border-[#171c24] text-[#dee2ee] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#171c24] bg-[#171c24]/50">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#00fbfb]" />
          <h2 className="text-sm font-semibold tracking-widest uppercase font-mono">
            Entity Archive
          </h2>
        </div>
        <p className="text-xs text-[#b9cac9] mt-1 font-mono">Knowledge Base Accumulator</p>
      </div>

      {/* Tree Visualization */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
        {knowledgeBaseTree.length === 0 ? (
          <div className="text-[#b9cac9]/50 flex items-center justify-center h-full">
            Waiting for telemetry...
          </div>
        ) : (
          knowledgeBaseTree.map((node, i) => {
            const isCompleted = node.includes("Completed");
            const isGenerating = node.includes("generating");
            const isFlattened = node.includes("flattened");

            return (
              <div
                key={i}
                className={`flex items-start gap-2 py-1 ${
                  isCompleted
                    ? "text-[#00fbfb]"
                    : isGenerating
                      ? "text-[#b9cac9]"
                      : "text-[#dee2ee]"
                }`}
              >
                {node.includes("|-") ? <span className="text-[#3a4a49] shrink-0">|-</span> : null}

                {isCompleted ? (
                  <Archive className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00fbfb]" />
                ) : isFlattened ? (
                  <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                ) : isGenerating ? (
                  <Terminal className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-pulse" />
                ) : (
                  <FolderTree className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#3a4a49]" />
                )}

                <span className="break-all">{node.replace("|- ", "")}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-[#171c24] text-[10px] text-[#b9cac9] font-mono flex justify-between bg-[#0f141b]">
        <span>NODES: {knowledgeBaseTree.length}</span>
        <span className="text-[#00fbfb] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00fbfb] animate-pulse shadow-[0_0_8px_#00fbfb]"></span>
          ACTIVE
        </span>
      </div>
    </div>
  );
}
