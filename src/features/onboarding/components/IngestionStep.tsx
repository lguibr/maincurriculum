import { Loader2 } from "lucide-react";
import { CommandDirectory } from "@/components/CommandDirectory";
import { RepoProgressTracker } from "@/components/PipelineChat";

interface IngestionStepProps {
  currentPhase: string;
  progress: number;
  targetRepos: string[];
  reposProgress: Record<string, any>;
}

export function IngestionStep({
  currentPhase,
  progress,
  targetRepos,
  reposProgress,
}: IngestionStepProps) {
  return (
    <div className="flex-1 flex min-h-0 bg-transparent overflow-hidden relative rounded-b-2xl">
      {/* Left Column: Command Directory */}
      <div className="w-1/3 min-w-[350px] border-r border-[#171c24] bg-transparent h-full flex flex-col overflow-hidden hidden md:flex">
        <CommandDirectory />
      </div>

      {/* Right Column: Ingestion Progress */}
      <div className="flex-1 p-6 md:p-10 flex flex-col items-center overflow-y-auto custom-scrollbar bg-transparent">
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
  );
}
