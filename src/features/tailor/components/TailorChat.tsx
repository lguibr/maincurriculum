import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface TailorChatProps {
  messages: ChatMessage[];
  isRefining: boolean;
  onSendMessage: (message: string) => void;
  activeTabName: string;
}

export function TailorChat({ messages, isRefining, onSendMessage, activeTabName }: TailorChatProps) {
  const [input, setInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isRefining) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full w-full bg-background/95 border-l border-border/40 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="p-4 bg-muted/20 border-b border-border/40 shrink-0">
        <h3 className="font-bold text-sm text-primary flex items-center">
          Refining {activeTabName}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ask me to change your experience, format, or tone. I'll update the document directly.
        </p>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[90%] text-sm ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-muted/50 border border-border/50 text-foreground rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isRefining && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border border-border/50 p-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> 
              <span className="text-xs text-muted-foreground">Editor is drafting...</span>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 bg-card/50 border-t border-border/50 shrink-0 relative">
        <Textarea 
          className="w-full min-h-[50px] max-h-[120px] bg-background border-border/50 resize-y rounded-xl py-3 pl-3 pr-12 text-sm custom-scrollbar focus-visible:ring-emerald-500/50"
          placeholder={`E.g. "Remove the part about Python", or "Make it sound more professional"`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isRefining}
        />
        <Button 
          size="icon" 
          disabled={!input.trim() || isRefining}
          onClick={handleSend}
          className="absolute right-6 top-6 h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
