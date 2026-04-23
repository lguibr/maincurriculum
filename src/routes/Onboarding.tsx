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
  Copy,
  Check,
  ChevronRight,
  ArrowLeft,
  Search,
  BookOpen,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { useInterviewStore } from "../store/useInterviewStore";
import { useEntityStore } from "../store/useEntityStore";
import { startAgent, processCvAndInterview, submitAnswer } from "../actions/pipelineActions";
import {
  TodoList,
  SubagentStreaming,
  PIPELINE_NODES,
  RepoProgressTracker,
} from "../components/PipelineChat";
import { EntityDashboard } from "../components/EntityDashboard";
import { CommandDirectory } from "../components/CommandDirectory";
export default function Onboarding() {
  const {
    baseCv,
    setBaseCv,
    cloudTier,
    setCloudTier,
    githubUsername,
    setGithubUsername,
    githubAvatarUrl,
    githubBio,
    extendedCv,
  } = useProfileStore();
  const { currentPhase, isRunning, isWizardComplete, progress } = usePipelineStore();
  const { currentQuestion, interviewHistory } = useInterviewStore();
  const { targetRepos, reposProgress } = useEntityStore();
  const [userAnswer, setUserAnswer] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const questionRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Phase management
  const [wizardPhase, setWizardPhase] = useState(1);
  const [fetchedRepos, setFetchedRepos] = useState<any[]>([]);
  const [selectedRepoUrls, setSelectedRepoUrls] = useState<string[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);

  useEffect(() => {
    if (currentQuestion) {
      setTimeout(() => {
        questionRef.current?.scrollIntoView({ behavior: "smooth" });
        textAreaRef.current?.focus();
      }, 300);
    }
    // Auto advance to Phase 3 when Ingestion completes and wizard is waiting
    if (wizardPhase === 2 && !isRunning && currentPhase === "Complete") {
      setWizardPhase(3);
    }
  }, [currentQuestion, isRunning, progress, wizardPhase, currentPhase]);

  const [githubToken, setGithubToken] = useState("");
  const [geminiToken, setGeminiToken] = useState("");

  useEffect(() => {
    setGithubToken(localStorage.getItem("GITHUB_TOKEN") || "");
    setGeminiToken(localStorage.getItem("GEMINI_API_KEY") || "");

    // Auto-resume from local DB
    import("../db/indexedDB").then(({ dbOps }) => {
      dbOps.getProfile("main").then((prof) => {
        if (prof) {
          setGithubUsername(prof.github_handle || "");
          if (prof.base_cv && prof.base_cv.trim().length > 50) {
            setBaseCv(prof.base_cv);
            // If they have entities (skills), they've passed ingestion
            dbOps.getSkills().then((skills) => {
              if (skills && skills.length > 0) {
                setWizardPhase(3); // They need to submit CV or do interview
              }
            });
          }
        }
      });
    });
  }, []);

  const handleHardReset = async () => {
    if (
      !confirm(
        "WARNING: This will completely nuke your local database and restart the onboarding flow. Proceed?"
      )
    )
      return;
    
    // Backup explicitly preserved data
    const gToken = localStorage.getItem("GITHUB_TOKEN");
    const gemToken = localStorage.getItem("GEMINI_API_KEY");
    const ghHandle = localStorage.getItem("GITHUB_HANDLE") || githubUsername;

    localStorage.clear();

    // Restore preserved data
    if (gToken) localStorage.setItem("GITHUB_TOKEN", gToken);
    if (gemToken) localStorage.setItem("GEMINI_API_KEY", gemToken);
    if (ghHandle) localStorage.setItem("GITHUB_HANDLE", ghHandle);

    try {
      const { initDB } = await import("../db/indexedDB");
      const db = await initDB();
      db.close();

      const req = indexedDB.deleteDatabase("CurriculumDB");
      req.onsuccess = () => window.location.reload();
      req.onerror = () => window.location.reload();
      req.onblocked = () => window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  const handleFetchRepos = async () => {
    if (!githubUsername) return;
    setIsFetchingRepos(true);
    try {
      const handle = githubUsername.split("/").pop();
      if (handle) {
        localStorage.setItem("GITHUB_HANDLE", handle);
      }

      const headers: Record<string, string> = {};
      const token = localStorage.getItem("GITHUB_TOKEN");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Fetch Profile Data
      try {
        const profRes = await fetch(`https://api.github.com/users/${handle}`, { headers });
        if (profRes.ok) {
          const profData = await profRes.json();
          useProfileStore.getState().setGithubAvatarUrl(profData.avatar_url || "");
          useProfileStore.getState().setGithubBio(profData.bio || "");
        }
      } catch (err) {
        console.warn("Failed to fetch Github profile", err);
      }

      const res = await fetch(
        `https://api.github.com/users/${handle}/repos?type=owner&sort=updated&per_page=100`,
        { headers }
      );
      const repoData = await res.json();

      if (Array.isArray(repoData)) {
        const mapped = repoData.map((r: any) => ({
          name: r.full_name || r.name,
          url: r.html_url,
          description: r.description,
          updatedAt: r.updated_at,
        }));

        setFetchedRepos(mapped);
      } else {
        setFetchedRepos([]);
      }
      setSelectedRepoUrls([]);

      try {
        const { dbOps } = await import("../db/indexedDB");
        const profileData = await dbOps.getProfile("main");
        if (profileData && profileData.base_cv && profileData.base_cv.trim().length > 50) {
          setBaseCv(profileData.base_cv);
        }
      } catch (err) {}
    } catch (e) {
      console.error(e);
    }
    setIsFetchingRepos(false);
  };

  const handleStartIngestion = async () => {
    setWizardPhase(2);
    try {
      const selectedRepos = fetchedRepos.filter((r) => selectedRepoUrls.includes(r.url));
      await startAgent(selectedRepos);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitCV = async () => {
    setWizardPhase(4);
    try {
      await processCvAndInterview(baseCv);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 h-screen overflow-hidden text-sm">
      <header className="shrink-0 flex items-center justify-between p-4 bg-muted/20 border-b border-border/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Main Curriculum Logo" className="h-10 w-auto object-contain" />
          {githubAvatarUrl && (
            <div className="flex items-center gap-3 ml-4 bg-black/20 p-1.5 pr-4 rounded-full border border-white/5">
              <img src={githubAvatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20" />
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-white leading-tight">{githubUsername}</span>
                <span className="text-[9px] text-muted-foreground line-clamp-1 max-w-[150px] leading-tight">{githubBio}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 1 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
          >
            1. Fetch
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 2 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
          >
            2. Embed
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 3 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
          >
            3. CV
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 4 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}
          >
            4. Interview
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isWizardComplete && (
            <Link
              to="/memory"
              className="flex items-center px-4 py-2 bg-muted/50 hover:bg-primary/20 rounded-lg text-sm font-semibold text-muted-foreground hover:text-primary transition-all border border-border/50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Resume System Operation
            </Link>
          )}
          <button
            onClick={handleHardReset}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-semibold transition-all font-mono"
          >
            NUKE DB (REST)
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6 flex flex-col items-center">
        <div
          className={`w-full flex-1 flex flex-col gap-6 min-h-0 transition-all duration-500 ${wizardPhase === 4 ? "max-w-[1600px]" : "max-w-4xl"}`}
        >
          <div className="w-full flex-1 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden shadow-2xl min-h-0">
            <div
              className={`p-5 border-b border-border/50 bg-muted/40 shrink-0 ${wizardPhase === 1 ? "hidden" : ""}`}
            >
              <h2 className="font-semibold text-base flex items-center">
                <User className="w-5 h-5 mr-3 text-primary" /> Context Setup
              </h2>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative border-0 bg-transparent">
              {wizardPhase === 1 && (
                <div className="h-full flex flex-col overflow-hidden bg-[#09090b] text-[#f1f3fc] relative rounded-b-2xl">
                  {/* Subtle Grid Background */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]"></div>

                  {fetchedRepos.length === 0 ? (
                    <div className="relative p-10 flex flex-col items-center justify-center h-full max-w-2xl mx-auto w-full text-center">
                      <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-24 w-auto object-contain mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                      />
                      <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">
                        Repository Ingestion
                      </h1>
                      <p className="text-[#a1a1aa] font-mono text-sm tracking-wide mb-10">
                        Enter a GitHub handle to fetch projects for the AI embedding sequence.
                      </p>

                      <div className="flex flex-col w-full items-center gap-3">
                        <div className="flex w-full items-center gap-3">
                          <Input
                            className="h-14 bg-[#18181b] border border-[#27272a] focus-visible:border-[#0070eb] focus-visible:ring-0 text-center text-lg rounded-xl text-white font-mono placeholder:text-[#52525b]"
                            placeholder="github_username"
                            value={githubUsername}
                            onChange={(e) => setGithubUsername(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                          />
                          <Button
                            onClick={handleFetchRepos}
                            disabled={isFetchingRepos || !githubUsername}
                            className="h-14 px-8 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                          >
                            {isFetchingRepos ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              "Fetch"
                            )}
                          </Button>
                        </div>

                        <div className="flex flex-col w-full gap-4 mt-6">
                          <div className="flex items-center gap-4 bg-[#18181b] p-4 rounded-xl border border-[#0070eb]/20 animate-in fade-in slide-in-from-top-2">
                            <Label className="text-[#a1a1aa] font-mono text-xs uppercase tracking-widest shrink-0">
                              Cloud Tier:
                            </Label>
                            <div className="flex bg-[#09090b] rounded-lg p-1 border border-[#27272a]">
                              <button
                                onClick={() => setCloudTier("smart")}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${cloudTier === "smart" ? "bg-[#0070eb] text-white" : "text-[#52525b] hover:text-[#a1a1aa]"}`}
                              >
                                Smart
                              </button>
                              <button
                                onClick={() => setCloudTier("balanced")}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${cloudTier === "balanced" ? "bg-[#0070eb] text-white" : "text-[#52525b] hover:text-[#a1a1aa]"}`}
                              >
                                Balanced
                              </button>
                              <button
                                onClick={() => setCloudTier("widely")}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${cloudTier === "widely" ? "bg-[#0070eb] text-white" : "text-[#52525b] hover:text-[#a1a1aa]"}`}
                              >
                                Widely
                              </button>
                            </div>
                            <div className="text-[10px] text-[#52525b] ml-2 hidden sm:block">
                              {cloudTier === "smart" && "Pro (Curriculum) + Flash (Extraction)"}
                              {cloudTier === "balanced" && "Flash (Curriculum) + Lite (Extraction)"}
                              {cloudTier === "widely" && "Pro (Curriculum) + Lite (Extraction)"}
                            </div>
                          </div>

                          <Input
                            type="password"
                            autoComplete="new-password"
                            spellCheck={false}
                            data-1p-ignore="true"
                            placeholder="GitHub API Token (Optional, avoids rate limits)"
                            className="h-12 bg-[#18181b] border border-[#27272a] text-sm rounded-xl text-[#a1a1aa] font-mono placeholder:text-[#52525b] focus-visible:border-[#0070eb] focus-visible:ring-1"
                            value={githubToken}
                            onChange={(e) => {
                              setGithubToken(e.target.value);
                              localStorage.setItem("GITHUB_TOKEN", e.target.value);
                            }}
                          />
                          <Input
                            type="password"
                            autoComplete="new-password"
                            spellCheck={false}
                            data-1p-ignore="true"
                            placeholder="Gemini API Token (Required for Execution)"
                            className={`h-12 bg-[#18181b] border ${!geminiToken ? "border-red-500/50 focus-visible:border-red-500/50" : "border-[#27272a] focus-visible:border-[#0070eb]"} text-sm rounded-xl text-[#a1a1aa] font-mono placeholder:text-[#52525b] focus-visible:ring-1`}
                            value={geminiToken}
                            onChange={(e) => {
                              setGeminiToken(e.target.value);
                              localStorage.setItem("GEMINI_API_KEY", e.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative p-8 flex flex-col overflow-hidden h-full max-w-6xl mx-auto w-full">
                      <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-end mb-4 border-b border-[#27272a] pb-4">
                          <div>
                            <h2 className="text-2xl font-bold text-white mb-1">
                              Select Repositories
                            </h2>
                            <Label className="text-sm text-[#a1a1aa] font-mono">
                              Discovered {fetchedRepos.length} public and private projects.
                            </Label>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 border-[#27272a] bg-[#18181b] text-[#d4d4d8] hover:text-white"
                              onClick={() => setSelectedRepoUrls(fetchedRepos.map((r) => r.url))}
                            >
                              Select All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 border-[#27272a] bg-[#18181b] text-[#d4d4d8] hover:text-white"
                              onClick={() => setSelectedRepoUrls([])}
                            >
                              Unselect All
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {fetchedRepos.map((repo) => (
                            <div
                              key={repo.url}
                              className={`flex items-start space-x-4 p-4 rounded-xl border transition-all cursor-pointer ${selectedRepoUrls.includes(repo.url) ? "bg-[#18181b] border-white/20" : "bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]"}`}
                              onClick={() => {
                                if (selectedRepoUrls.includes(repo.url))
                                  setSelectedRepoUrls(
                                    selectedRepoUrls.filter((u) => u !== repo.url)
                                  );
                                else setSelectedRepoUrls([...selectedRepoUrls, repo.url]);
                              }}
                            >
                              <Checkbox
                                id={repo.url}
                                checked={selectedRepoUrls.includes(repo.url)}
                                className="mt-1 border-[#52525b] data-[state=checked]:bg-white data-[state=checked]:text-black"
                                onCheckedChange={(c) => {
                                  if (c) setSelectedRepoUrls([...selectedRepoUrls, repo.url]);
                                  else
                                    setSelectedRepoUrls(
                                      selectedRepoUrls.filter((u) => u !== repo.url)
                                    );
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold truncate font-mono">
                                  {repo.name}
                                </h3>
                                {repo.description && (
                                  <p className="text-[#a1a1aa] text-sm mt-1.5 line-clamp-2">
                                    {repo.description}
                                  </p>
                                )}
                                <div className="text-[10px] text-[#52525b] mt-2 font-mono">
                                  {repo.url}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="pt-6 shrink-0">
                          <Button
                            onClick={handleStartIngestion}
                            disabled={selectedRepoUrls.length === 0 || !geminiToken}
                            className={`w-full h-14 bg-white text-black hover:bg-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 ${!geminiToken ? "border border-red-500/50" : ""}`}
                          >
                            <BookOpen className="w-5 h-5" />
                            {!geminiToken
                              ? "Missing API Token"
                              : `Initialize Sequence (${selectedRepoUrls.length})`}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wizardPhase === 2 && (
                <div className="flex-1 flex min-h-0 bg-background/50 overflow-hidden relative rounded-b-2xl">
                  {/* Left Column: Command Directory */}
                  <div className="w-1/3 min-w-[350px] border-r border-[#171c24] bg-[#0f141b] h-full flex flex-col overflow-hidden hidden md:flex">
                    <CommandDirectory />
                  </div>

                  {/* Right Column: Ingestion Progress */}
                  <div className="flex-1 p-6 md:p-10 flex flex-col items-center overflow-y-auto custom-scrollbar bg-[#090e16]">
                    <div className="shrink-0 flex flex-col items-center mt-4">
                      <Loader2 className="w-16 h-16 text-[#00fbfb] animate-spin mb-6 drop-shadow-[0_0_15px_rgba(0,251,251,0.5)]" />
                      <h3 className="text-xl font-bold font-mono tracking-widest text-[#dee2ee] mb-2 uppercase">
                        System Running
                      </h3>
                      <p className="text-[#b9cac9] max-w-sm mb-12 font-mono text-xs text-center">
                        {currentPhase || "Initializing Pipeline..."}
                      </p>
                    </div>
                    <div className="w-full max-w-6xl px-2 md:px-4 pb-16 flex-1">
                      <RepoProgressTracker
                        targetRepos={targetRepos}
                        reposProgress={reposProgress}
                        globalProgressOverride={progress}
                        globalPhaseOverride={currentPhase}
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardPhase === 3 && (
                <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e] relative">
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
                      value={baseCv}
                      onChange={(val) => setBaseCv(val || "")}
                      options={{ minimap: { enabled: false }, padding: { top: 16 } }}
                    />
                  </div>
                  <div className="p-4 bg-muted/10 shrink-0 border-t border-border/50">
                    <Button
                      onClick={handleSubmitCV}
                      className="w-full h-12 text-base font-bold tracking-wide shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
                    >
                      <Play className="w-5 h-5 mr-2" /> Submit Resume for Alignment
                    </Button>
                  </div>
                </div>
              )}

              {wizardPhase === 4 && (
                <div className="flex-1 flex min-h-0 bg-background/50 overflow-hidden relative">
                  {/* Left Column: Entity Dashboard */}
                  <div className="w-1/3 min-w-[350px] border-r border-border/50 bg-muted/10 h-full flex flex-col overflow-hidden hidden md:flex">
                    <EntityDashboard />
                  </div>

                  {/* Right Column: Interactive Interview Planner */}
                  <div className="flex-1 p-6 flex flex-col justify-start min-h-0 bg-background/50 overflow-hidden relative">
                    {isWizardComplete ? (
                      <div className="flex flex-col h-full w-full animate-in fade-in duration-500 overflow-hidden">
                        <div className="flex flex-col items-center justify-center p-6 border-b border-border/50 shrink-0 bg-muted/5">
                          <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4 ring-2 ring-green-500/30">
                            <Check className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl text-primary font-bold mb-1">
                            Alignment Complete
                          </h3>
                          <p className="text-sm opacity-80 text-center max-w-[400px]">
                            Check out your newly generated Master Extended CV based on your
                            technical pipeline answers.
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
                    ) : !currentQuestion ? (
                      <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8">
                        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                        <h3 className="text-xl text-primary font-bold mb-2">
                          AI Architect Analyzing Alignment...
                        </h3>
                        <p className="text-sm opacity-60 mt-2 max-w-[300px] text-center mx-auto">
                          {currentPhase.includes("Interview") ||
                          currentPhase.includes("Generating Final CV")
                            ? currentPhase
                            : "Preparing tailored technical deep-dive questions based on your CV..."}
                          <br />
                          {"This may take up to 20-30 seconds depending on context scale."}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="flex flex-col h-full justify-between items-center w-full animate-in fade-in duration-500 max-w-4xl mx-auto min-h-0"
                      >
                        <div className="w-full flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 mb-4 pr-2 pb-4">
                          {/* Render History */}
                          {interviewHistory?.map((h, i) => (
                            <div key={i} className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-2">
                              <div className="relative shadow-lg rounded-2xl border border-primary/20 overflow-hidden bg-card/80 p-5">
                                <Label className="text-[10px] text-primary tracking-widest font-bold uppercase mb-3 block">
                                  Question {i + 1}
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

                          {/* Render Current Question */}
                          <div
                            ref={questionRef}
                            className="w-full relative shadow-2xl rounded-2xl border border-primary/50 overflow-hidden flex flex-col mt-4 shrink-0"
                          >
                            <div className="absolute inset-0 bg-primary/10 blur animate-pulse pointer-events-none" />
                            <div className="relative p-6 bg-card flex flex-col flex-1">
                              <div className="flex justify-between items-start mb-4 shrink-0">
                                <Label className="text-xs text-primary tracking-widest font-bold uppercase mt-1">
                                  {currentPhase} Question
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
                                  {isCopied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              <div className="text-base font-sans leading-relaxed text-foreground/90 prose prose-invert prose-p:leading-relaxed prose-pre:bg-muted max-w-none">
                                <ReactMarkdown>{currentQuestion}</ReactMarkdown>
                              </div>
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
                                  submitAnswer(userAnswer);
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
                              submitAnswer(userAnswer);
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
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
