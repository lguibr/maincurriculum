import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Markdown from "react-markdown";
import { Loader2 } from "lucide-react";

interface ChatStreamViewerProps {
  streamingTokens: Record<string, string>;
  activeNodes: string[];
}

export function ChatStreamViewer({ streamingTokens, activeNodes }: ChatStreamViewerProps) {
  const visibleStreams = Object.entries(streamingTokens).filter(([_, text]) => text.length > 0);

  if (visibleStreams.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {visibleStreams.map(([nodeName, text]) => {
        const isActive = activeNodes.includes(nodeName);

        return (
          <Card
            key={nodeName}
            className={`bg-neutral-900 border-neutral-800 shadow-lg transition-transform ${isActive ? "ring-1 ring-emerald-500/50" : ""}`}
          >
            <CardHeader className="py-3 px-4 border-b border-neutral-800 bg-neutral-950/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-emerald-400 font-mono tracking-tight flex items-center">
                {nodeName.replace(/_/g, " ")}
              </CardTitle>
              {isActive && <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-48 p-4">
                <div className="text-xs text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {text}
                  {isActive && (
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-500 ml-1 animate-pulse" />
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
