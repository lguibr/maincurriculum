import { Clock, FolderGit2, Loader2 } from "lucide-react";

export function RepoProgressTracker({
  targetRepos,
  reposProgress,
  globalProgressOverride,
  globalPhaseOverride,
}: {
  targetRepos: string[];
  reposProgress: Record<
    string,
    {
      phase: string;
      progress: number;
      currentPhaseProgress: number;
      timeStarted?: number;
      etaSeconds?: number;
    }
  >;
  globalProgressOverride: number;
  globalPhaseOverride?: string;
}) {
  let completedRepos = 0;
  let activeEta = 0;
  let hasValidEta = false;

  targetRepos.forEach((repo) => {
    const rp = reposProgress[repo];
    if (rp?.progress === 100) completedRepos++;
    if (rp?.etaSeconds !== undefined && rp.progress > 0 && rp.progress < 100) {
      activeEta += rp.etaSeconds;
      hasValidEta = true;
    }
  });

  const isPending = targetRepos.length === 0;
  const totalPercentage = isPending
    ? globalProgressOverride
    : Math.round((completedRepos / targetRepos.length) * 100) || 0;

  const pendingMessage =
    globalProgressOverride > 0 && globalPhaseOverride
      ? globalPhaseOverride
      : "Waiting for launch sequence...";

  const formatETA = (seconds: number) => {
    if (seconds <= 0) return "Done";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  return (
    <div className="flex flex-col w-full gap-5 shrink-0 animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto pb-4">
      <div className="flex-1 px-6 py-5 rounded-2xl border border-white/10 bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Ingestion Engine
                {!isPending && totalPercentage < 100 && (
                  <span className="flex h-2 w-2 relative ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                )}
              </h2>
              <p className="text-sm tracking-wide text-muted-foreground mt-1">
                {isPending
                  ? pendingMessage
                  : `Processing ${completedRepos} of ${targetRepos.length} Repositories`}
              </p>
            </div>

            {!isPending && totalPercentage < 100 && hasValidEta && (
              <div className="flex items-center gap-2 bg-black/20 dark:bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg shadow-inner">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-mono tracking-wider font-semibold text-primary/90">
                  est. {formatETA(activeEta)}
                </span>
              </div>
            )}
          </div>

          <div className="relative h-3 mt-1 w-full bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-[800ms] ease-out shadow-[0_0_15px_rgba(var(--primary),0.6)]"
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
        {isPending ? (
          <div className="col-span-full py-16 text-center text-muted-foreground/60 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/5 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 mb-3 opacity-20 animate-spin" />
            <p className="tracking-wide text-sm">
              {globalProgressOverride > 0
                ? "Analyzing source systems and determining target repositories..."
                : "No active repositories. Waiting for launch command..."}
            </p>
          </div>
        ) : (
          targetRepos.map((repoName) => {
            const rp = reposProgress[repoName];
            const progress = rp?.progress || 0;
            const phase = rp?.phase || "Waiting...";
            const eta = rp?.etaSeconds;
            const isComplete = progress === 100;
            const isRunning = progress > 0 && progress < 100;

            return (
              <div
                key={repoName}
                className={`px-5 py-4 rounded-xl border relative overflow-hidden backdrop-blur-md transition-all duration-300 ${
                  isComplete
                    ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_4px_20px_rgba(16,185,129,0.05)]"
                    : isRunning
                      ? "border-primary/30 bg-background/60 shadow-[0_4px_20px_rgba(var(--primary),0.08)]"
                      : "border-white/5 bg-background/30"
                }`}
              >
                {isRunning && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                )}

                <div className="relative flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 truncate max-w-[65%]">
                      <FolderGit2
                        className={`w-4 h-4 shrink-0 ${isComplete ? "text-emerald-500" : isRunning ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span
                        className={`font-semibold text-sm truncate tracking-tight ${isComplete ? "text-emerald-400" : isRunning ? "text-primary" : "text-muted-foreground"}`}
                        title={repoName}
                      >
                        {repoName}
                      </span>
                    </div>

                    {isRunning && eta !== undefined && (
                      <span className="text-[10px] font-mono font-medium text-muted-foreground bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                        {formatETA(eta)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    <span
                      className="text-xs text-muted-foreground tracking-wide flex items-center gap-1.5 font-medium truncate"
                      title={phase}
                    >
                      {isRunning && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                      {phase}
                    </span>
                    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden shadow-inner border border-white/5">
                      <div
                        className={`h-full transition-all duration-[800ms] ease-out ${isComplete ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
