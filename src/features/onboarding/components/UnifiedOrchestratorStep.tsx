import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Copy, Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgentLogViewer } from "@/components/features/AgentLogViewer";

interface UnifiedOrchestratorStepProps {
  isWizardComplete: boolean;
  extendedCv: string;
  currentPhase: string;
  progress: number;
  currentQuestion: string | null;
  interviewHistory: { q: string; a: string; type?: "critique" | "interview" }[];
  submitAnswer: (answer: string) => void;
}

export function UnifiedOrchestratorStep({
  isWizardComplete,
  extendedCv,
  currentPhase,
  progress,
  currentQuestion,
  interviewHistory,
  submitAnswer,
}: UnifiedOrchestratorStepProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const questionRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentQuestion) {
      setTimeout(() => {
        questionRef.current?.scrollIntoView({ behavior: "smooth" });
        textAreaRef.current?.focus();
      }, 300);
    }
  }, [currentQuestion]);

  if (isWizardComplete) {
    return (
      <div className="flex flex-col h-full w-full animate-in fade-in duration-500 overflow-hidden">
        <div className="flex flex-col items-center justify-center p-6 border-b border-border/50 shrink-0 bg-muted/5">
          <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4 ring-2 ring-green-500/30">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-xl text-primary font-bold mb-1">Pipeline Complete</h3>
          <p className="text-sm opacity-80 text-center max-w-[400px]">
            Check out your newly generated Master Extended CV based on the orchestrator's technical pipeline.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-card custom-scrollbar">
          <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-muted max-w-none">
            <ReactMarkdown>{extendedCv || "No CV was generated."}</ReactMarkdown>
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-muted/10 shrink-0 flex justify-end">
          <Link to="/memory">
            <Button className="h-10 px-8 text-sm font-bold shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all">
              Proceed to System Dashboard <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Pure extraction/loading phase before any chat starts
  if (!currentQuestion && interviewHistory.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,251,251,0.05)_0%,transparent_70%)] pointer-events-none" />
        <Loader2 className="w-16 h-16 text-[#00fbfb] shadow-cyan-500 drop-shadow-[0_0_15px_rgba(0,251,251,0.5)] animate-spin mb-6 relative z-10" />
        <h3 className="text-xl text-[#dee2ee] font-mono tracking-widest font-bold mb-2 uppercase text-center relative z-10">
          Initializing Orchestrator
        </h3>
        <p className="text-sm opacity-60 mt-2 max-w-[400px] text-center font-mono mx-auto relative z-10">
          {currentPhase}
          <br />
          <span className="text-[#00fbfb] mt-4 block">{progress}%</span>
        </p>

        <div className="w-full relative z-10 mt-8 max-w-4xl max-h-[50vh]">
          <AgentLogViewer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-between items-center w-full animate-in fade-in duration-500 max-w-4xl mx-auto min-h-0">
      <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 mb-4 pr-2 pb-4">
        {interviewHistory?.map((h, i) => (
          <div key={i} className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-2">
            <div className={`relative shadow-lg rounded-2xl border ${h.type === "critique" ? "border-amber-500/50" : "border-primary/20"} overflow-hidden bg-card/80 p-5`}>
              <Label className={`text-[10px] ${h.type === "critique" ? "text-amber-500" : "text-primary"} tracking-widest font-bold uppercase mb-3 block`}>
                {h.type === "critique" ? "Orchestrator Validation" : "Architect Question"}
              </Label>
              <div className="text-sm font-sans leading-relaxed text-foreground/90 prose prose-invert max-w-none">
                <ReactMarkdown>{h.q}</ReactMarkdown>
              </div>
            </div>
            <div className="relative rounded-2xl border border-border/50 bg-muted/20 p-5 ml-8 lg:ml-12 border-l-4 border-l-primary/50">
              <Label className="text-[10px] text-muted-foreground tracking-widest font-bold uppercase mb-3 block">
                Your Answer
              </Label>
              <div className="text-sm text-foreground/80 whitespace-pre-wrap">{h.a}</div>
            </div>
          </div>
        ))}

        {currentQuestion ? (
          <div
            ref={questionRef}
            className="w-full relative shadow-2xl rounded-2xl border border-primary/50 overflow-hidden flex flex-col mt-4 shrink-0"
          >
            <div className="absolute inset-0 bg-primary/10 blur animate-pulse pointer-events-none" />
            <div className="relative p-6 bg-card flex flex-col flex-1">
              <div className="flex justify-between items-start mb-4 shrink-0">
                <Label className="text-xs text-primary tracking-widest font-bold uppercase mt-1">
                  Active Orchestrator Thread
                </Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary transition-all hover:bg-primary/20 hover:scale-105"
                  onClick={() => {
                    navigator.clipboard.writeText(currentQuestion || "");
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                >
                  {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-base font-sans leading-relaxed text-foreground/90 prose prose-invert prose-p:leading-relaxed prose-pre:bg-muted max-w-none">
                <ReactMarkdown>{currentQuestion}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 mt-4 text-muted-foreground">
             <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
             <p className="text-xs font-mono">{currentPhase}</p>
          </div>
        )}
      </div>

      <div className="w-full relative shrink-0">
        <Textarea
          ref={textAreaRef}
          className="w-full min-h-[56px] py-4 pl-4 pr-14 text-base bg-muted/20 border-primary/50 shadow-inner rounded-xl resize-y custom-scrollbar focus:ring-1 focus:ring-primary"
          placeholder="Provide your answer... (Shift+Enter for new line)"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={!currentQuestion}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (userAnswer.trim()) {
                submitAnswer(userAnswer);
                setUserAnswer("");
              }
            }
          }}
        />
        <Button
          size="icon"
          disabled={!userAnswer.trim() || !currentQuestion}
          className="absolute right-2 top-2 h-10 w-10 rounded-lg hover:scale-105 transition-transform"
          onClick={() => {
            submitAnswer(userAnswer);
            setUserAnswer("");
          }}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
