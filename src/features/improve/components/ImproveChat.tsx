import { Loader2, Bot, User, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ImproveChatProps {
  messages: ChatMessage[];
  isRunning: boolean;
  currentActionMsg: string;
  endRef: React.RefObject<HTMLDivElement>;
  inputMsg: string;
  setInputMsg: (v: string) => void;
  handleSend: () => void;
}

export function ImproveChat({
  messages,
  isRunning,
  currentActionMsg,
  endRef,
  inputMsg,
  setInputMsg,
  handleSend,
}: ImproveChatProps) {
  return (
    <div className="w-[35%] flex flex-col bg-card border border-border/50 rounded-xl shadow-lg relative print:hidden">
      <div className="h-12 border-b border-border/50 flex items-center px-4 font-semibold text-sm justify-between">
        <span>Improver Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-10 text-sm">
            I am the SOTA Improver.
            <br />
            Ask me to rewrite sections, tweak tone, add skills, block lies, or expand experiences directly via Gemini 3!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.role === "user" ? "bg-blue-600/20 text-blue-100" : "bg-muted/30 text-foreground"}`}>
              <div className="flex items-center gap-2 mb-1 opacity-70 border-b border-border/30 pb-1">
                {m.role === "user" ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                <span className="text-xs uppercase font-bold">{m.role}</span>
              </div>
              <div className="prose prose-sm prose-invert">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isRunning && currentActionMsg && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded p-2 text-xs bg-muted/20 text-blue-300 font-mono flex items-center gap-2 border border-blue-500/20">
              <Loader2 className="w-3 h-3 animate-spin" /> {currentActionMsg}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-border/50 bg-muted/10">
        <div className="relative">
          <textarea
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="w-full bg-background border border-border/50 rounded-lg pr-12 pl-3 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Instruct the CV agent..."
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={isRunning || !inputMsg.trim()}
            className="absolute right-2 bottom-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-muted text-white rounded transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
