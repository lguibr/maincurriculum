import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

interface HeaderProps {
  githubAvatarUrl: string;
  githubUsername: string;
  githubBio: string;
  wizardPhase: number;
  isWizardComplete: boolean;
  handleHardReset: () => void;
}

export function OnboardingHeader({
  githubAvatarUrl,
  githubUsername,
  githubBio,
  wizardPhase,
  isWizardComplete,
  handleHardReset,
}: HeaderProps) {
  return (
    <header className="shrink-0 flex items-center justify-between p-4 bg-background/60 border-b border-border/40 backdrop-blur-xl z-10">
      <div className="flex items-center gap-4">
        <Logo alt="Main Curriculum" className="h-10 w-auto object-contain" />
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
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 1 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>1. Fetch</div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 2 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>2. Embed</div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 3 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>3. CV</div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${wizardPhase === 4 ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground"}`}>4. Interview</div>
      </div>
      <div className="flex items-center gap-2">
        {isWizardComplete && (
          <Link to="/memory" className="flex items-center px-4 py-2 bg-muted/50 hover:bg-primary/20 rounded-lg text-sm font-semibold text-muted-foreground hover:text-primary transition-all border border-border/50">
            <ArrowLeft className="w-4 h-4 mr-2" /> Resume System Operation
          </Link>
        )}
        <button onClick={handleHardReset} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-semibold transition-all font-mono">
          NUKE DB (REST)
        </button>
      </div>
    </header>
  );
}
