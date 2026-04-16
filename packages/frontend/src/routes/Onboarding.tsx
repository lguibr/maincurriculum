import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  User,
  CheckCircle,
  Send,
  Loader2,
  Activity,
  Play,
  FileCode,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { useStore } from "../store/useStore";
import { NodeCardList, PipelineProgress, PIPELINE_NODES } from "../components/PipelineChat";

export default function Onboarding() {
  const store = useStore();
  const [userAnswer, setUserAnswer] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const questionRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (store.currentQuestion) {
      setTimeout(() => {
        questionRef.current?.scrollIntoView({ behavior: "smooth" });
        textAreaRef.current?.focus();
      }, 300);
    }
  }, [store.currentQuestion]);

  const phases = [
    { name: "Data Extraction", match: "Parsing" },
    { name: "Skills Audit", match: "Skills" },
    { name: "Education Validation", match: "Education" },
    { name: "Experience Timeline", match: "Experience" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 h-screen overflow-hidden text-sm">
      <header className="shrink-0 flex items-center justify-between p-4 bg-muted/20 border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
            <RefreshCw className="w-5 h-5 animate-[spin_5s_linear_infinite]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            MainCurriculum{" "}
            <Badge variant="secondary" className="ml-2 font-normal">
              Command Center 2.0
            </Badge>
          </h1>
        </div>
        {store.isWizardComplete && (
          <Link
            to="/memory"
            className="flex items-center px-4 py-2 bg-muted/50 hover:bg-primary/20 rounded-lg text-sm font-semibold text-muted-foreground hover:text-primary transition-all border border-border/50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Resume System Operation
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-hidden p-6 flex flex-col items-center">
        <div className="w-full max-w-7xl flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          {/* Left Column: Monaco Editor & GitHub Input */}
          <div className="lg:w-1/2 w-full flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-2xl h-full">
            <div className="p-5 border-b border-border/50 bg-muted/40 shrink-0">
              <h2 className="font-semibold text-base flex items-center">
                <User className="w-5 h-5 mr-3 text-primary" /> Ingestion Payload
              </h2>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="p-5 border-b border-border/40 bg-background/50 shrink-0 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  GitHub User / URL
                </Label>
                <Input
                  className="h-12 bg-muted/30"
                  placeholder="lgulbr or https://github.com/..."
                  value={store.githubUsername}
                  onChange={(e) => store.setGithubUsername(e.target.value)}
                />
              </div>

              <div className="flex-1 relative flex flex-col min-h-0 bg-[#1e1e1e]">
                <div className="absolute top-0 w-full z-10 flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c] shadow-lg">
                  <Label className="text-[10px] text-gray-400 font-mono tracking-widest flex items-center">
                    <FileCode className="w-3 h-3 mr-2" /> BASE_CV.md
                  </Label>
                </div>

                <div className="flex-1 mt-10 relative">
                  <Editor
                    wrapperProps={{ className: "absolute inset-0" }}
                    height="100%"
                    width="100%"
                    defaultLanguage="markdown"
                    theme="vs-dark"
                    value={store.baseCv}
                    onChange={(val) => store.setBaseCv(val || "")}
                    options={{ minimap: { enabled: false }, padding: { top: 16 } }}
                  />
                </div>
              </div>

              <div className="p-4 bg-muted/10 shrink-0 border-t border-border/50">
                <Button
                  onClick={store.startAgent}
                  disabled={store.isRunning || (!store.githubUsername && !store.baseCv)}
                  className="w-full h-12 text-base font-bold tracking-wide shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
                >
                  {store.isRunning ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  {store.isRunning ? "Ingesting Repository..." : "Launch Command Graph"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Wizard Stepper */}
          <div className="lg:w-1/2 w-full flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl h-full min-h-0 relative">
            {/* Progress Stepper Header */}
            <div className="p-6 bg-muted/30 shrink-0 border-b border-border/40">
              <h2 className="text-xl font-bold mb-6 flex items-center">
                <Activity className="w-6 h-6 mr-3 text-primary" /> Agentic Onboarding
              </h2>
              <div className="flex flex-col gap-4">
                {phases.map((step, i) => {
                  const isPassed =
                    phases.findIndex((p) => store.currentPhase.includes(p.match)) > i;
                  const isActive = store.currentPhase.includes(step.match);
                  const colorState =
                    isPassed || store.isWizardComplete
                      ? "text-emerald-500"
                      : isActive
                        ? "text-primary"
                        : "text-muted-foreground";
                  const circleState =
                    isPassed || store.isWizardComplete
                      ? "bg-emerald-500/20 border-emerald-500"
                      : isActive
                        ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                        : "bg-muted border-border/50";

                  return (
                    <div
                      key={i}
                      className={`flex items-center text-sm font-semibold transition-all ${colorState}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 border-2 ${circleState}`}
                      >
                        {isPassed || store.isWizardComplete ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      {step.name}
                      {isActive && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Graph Interaction Box */}
            <div className="flex-1 p-8 flex flex-col justify-center min-h-0 bg-background/50">
              {!store.isRunning && !store.currentQuestion ? (
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="w-16 h-16 mx-auto mb-6 opacity-20" />
                  <p className="text-lg">Graph Offline</p>
                  <p className="text-sm opacity-60 mt-2 max-w-[300px] mx-auto">
                    Fill out the payload to the left and click Launch to execute the workflow phase
                    checkpoints.
                  </p>
                </div>
              ) : !store.currentQuestion ? (
                <div className="flex flex-col items-center justify-start text-primary h-full w-full max-w-2xl mx-auto py-2">
                  <PipelineProgress
                    nodes={PIPELINE_NODES}
                    events={store.langgraphEvents}
                    values={store.langgraphValues}
                  />
                  <NodeCardList
                    nodes={PIPELINE_NODES}
                    events={store.langgraphEvents}
                    values={store.langgraphValues}
                  />
                </div>
              ) : (
                <div
                  ref={questionRef}
                  className="flex flex-col h-full justify-between items-center w-full animate-in fade-in duration-500"
                >
                  <div className="w-full relative shadow-2xl rounded-2xl mb-8 border border-primary/30 overflow-hidden flex flex-col max-h-[60vh]">
                    <div className="absolute inset-0 bg-primary/10 blur animate-pulse pointer-events-none" />
                    <div className="relative p-6 bg-card flex flex-col flex-1 overflow-y-auto custom-scrollbar">
                      <div className="flex justify-between items-start mb-4 shrink-0">
                        <Label className="text-xs text-primary tracking-widest font-bold uppercase mt-1">
                          {store.currentPhase} Question
                        </Label>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary transition-all hover:bg-primary/20 hover:scale-105"
                          onClick={() => {
                            navigator.clipboard.writeText(store.currentQuestion || "");
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="text-base font-sans leading-relaxed text-foreground/90 prose prose-invert prose-p:leading-relaxed prose-pre:bg-muted max-w-none">
                        <ReactMarkdown>{store.currentQuestion}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  <div className="w-full relative shrink-0">
                    <Textarea
                      ref={textAreaRef}
                      className="w-full min-h-[56px] py-4 pl-4 pr-14 text-base bg-muted/20 border-primary/50 shadow-inner rounded-xl resize-y custom-scrollbar"
                      placeholder="Provide your answer... (Shift+Enter for new line)"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (userAnswer.trim()) {
                            store.submitAnswer(userAnswer);
                            setUserAnswer("");
                          }
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!userAnswer.trim()}
                      className="absolute right-2 top-2 h-10 w-10 rounded-lg hover:scale-105 transition-transform"
                      onClick={() => {
                        store.submitAnswer(userAnswer);
                        setUserAnswer("");
                      }}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
