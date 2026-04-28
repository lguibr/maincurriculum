import { FolderGit2, Briefcase, ChevronRight, Home, Activity, Database, BarChart3 } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AsciiBackground } from "../components/ui/AsciiBackground";
import { Logo } from "../components/ui/Logo";
import { useProfileStore } from "../store/useProfileStore";

export default function Dashboard() {
  const { githubUsername, githubAvatarUrl, githubBio } = useProfileStore();
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path || (path === "/tailor" && location.pathname === "/");

  return (
    <div className="h-screen w-screen text-foreground flex font-sans overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white print:text-black relative">
      <AsciiBackground />
      {/* Left Sidebar Layout */}
      <div className="w-64 border-r border-border/40 bg-background/40 backdrop-blur-2xl flex flex-col shrink-0 print:hidden z-10">
        <div className="h-14 border-b border-border/40 flex items-center justify-center shrink-0">
          <Link to="/" className="hover:opacity-80 transition-opacity drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <Logo alt="Logo" className="h-8 w-auto object-contain" />
          </Link>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <Link
            to="/"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/") ? "bg-cyan-500/10 text-cyan-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Home className="w-4 h-4 mr-3" /> Home Dashboard
          </Link>

          <div className="mt-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Core AI
          </div>

          <Link
            to="/tailor"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/tailor") ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Briefcase className="w-4 h-4 mr-3" /> Job Tailor Tools
          </Link>

          <Link
            to="/improve"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/improve") ? "bg-blue-500/10 text-blue-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <FolderGit2 className="w-4 h-4 mr-3" /> Master CV Improver
          </Link>

          <div className="mt-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Analytics & Memory
          </div>

          <Link
            to="/memory"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/memory") ? "bg-emerald-500/10 text-emerald-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Database className="w-4 h-4 mr-3" /> Vector Context
          </Link>

          <Link
            to="/timeline"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/timeline") ? "bg-amber-500/10 text-amber-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <BarChart3 className="w-4 h-4 mr-3" /> Timeline Metrics
          </Link>

          <div className="mt-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            System Config
          </div>
          <Link
            to="/onboarding"
            className="flex items-center px-3 py-2 rounded-lg transition-all hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
          >
            <Activity className="w-4 h-4 mr-3" /> Resume Onboarding
          </Link>

          <div className="mt-auto pt-4 border-t border-border/40 mb-2 text-xs font-semibold text-red-500 uppercase tracking-wider">
            Danger Zone
          </div>
          <button
            onClick={async () => {
              if (
                window.confirm(
                  "WARNING: This will permanently wipe all agents, CV versions, and ingested vector memory! Proceed?"
                )
              ) {
                // Backup explicitly preserved data
                const gToken = localStorage.getItem("GITHUB_TOKEN");
                const gemToken = localStorage.getItem("GEMINI_API_KEY");
                const ghHandle = localStorage.getItem("GITHUB_HANDLE");
                const ghAvatar = localStorage.getItem("GITHUB_AVATAR");
                const ghBio = localStorage.getItem("GITHUB_BIO");

                // Erase local storage AI tokens/keys
                localStorage.clear();

                // Restore preserved data
                if (gToken) localStorage.setItem("GITHUB_TOKEN", gToken);
                if (gemToken) localStorage.setItem("GEMINI_API_KEY", gemToken);
                if (ghHandle) localStorage.setItem("GITHUB_HANDLE", ghHandle);
                if (ghAvatar) localStorage.setItem("GITHUB_AVATAR", ghAvatar);
                if (ghBio) localStorage.setItem("GITHUB_BIO", ghBio);

                // Delete IndexedDB
                const req = indexedDB.deleteDatabase("CurriculumDB");
                req.onsuccess = () => {
                  window.location.href = "/onboarding";
                };
                req.onerror = () => {
                  window.location.href = "/onboarding";
                };
              }
            }}
            className="flex items-center px-3 py-2 rounded-lg transition-all hover:bg-red-500/10 text-red-400 font-semibold text-sm"
          >
            Factory Reset & WIPE
          </button>
        </nav>
      </div>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block print:bg-white z-10 relative">
        {/* Header Breadcrumbs */}
        <header className="h-14 border-b border-border/40 bg-card flex items-center px-4 shrink-0 justify-between print:hidden">
          <div className="flex items-center text-sm text-muted-foreground font-medium">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <Logo alt="Home Root" className="h-5 w-auto" />
            </Link>
            
            {location.pathname === "/" ? (
              <>
                <ChevronRight className="w-4 h-4 mx-1 opacity-50" />
                <span className="text-cyan-500 font-semibold capitalize">Home</span>
              </>
            ) : (
              location.pathname.split("/").filter(Boolean).map((segment, index, arr) => (
                <div key={index} className="flex items-center">
                  <ChevronRight className="w-4 h-4 mx-1 opacity-50" />
                  <span className={`capitalize ${index === arr.length - 1 ? "text-primary font-bold" : ""}`}>
                    {segment.replace(/-/g, " ")}
                  </span>
                </div>
              ))
            )}
          </div>
          
          {githubAvatarUrl && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-foreground leading-tight">{githubUsername}</span>
                <span className="text-[9px] text-muted-foreground line-clamp-1 max-w-[150px] leading-tight">{githubBio}</span>
              </div>
              <img src={githubAvatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20 bg-muted" />
            </div>
          )}
        </header>

        {/* Dynamic App Renderer (Outlet) */}
        <div className="flex-1 bg-transparent overflow-hidden print:overflow-visible print:block print:bg-white">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
