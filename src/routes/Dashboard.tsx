import { FolderGit2, Briefcase, ChevronRight, Home, Activity, Database } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export default function Dashboard() {
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path || (path === "/tailor" && location.pathname === "/");

  return (
    <div className="h-screen w-screen bg-background text-foreground flex font-sans overflow-hidden print:h-auto print:overflow-visible print:block print:bg-white print:text-black">
      {/* Left Sidebar Layout */}
      <div className="w-64 border-r border-border/40 bg-card/50 flex flex-col shrink-0 print:hidden">
        <div className="h-14 border-b border-border/40 flex items-center justify-center shrink-0">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
          </Link>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Agent Apps
          </div>

          <Link
            to="/tailor"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/tailor") ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Briefcase className="w-4 h-4 mr-3" /> Job Tailor
          </Link>

          <Link
            to="/improve"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/improve") ? "bg-blue-500/10 text-blue-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <FolderGit2 className="w-4 h-4 mr-3" /> CV Improver
          </Link>

          <div className="mt-6 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Vector Memory
          </div>

          <Link
            to="/memory"
            className={`flex items-center px-3 py-2 rounded-lg transition-all ${isActive("/memory") ? "bg-violet-500/10 text-violet-500 font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Database className="w-4 h-4 mr-3" /> Agent Context
          </Link>

          <div className="mt-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            System
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
                // Erase local storage AI tokens/keys
                localStorage.clear();
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block print:bg-white">
        {/* Header Breadcrumbs */}
        <header className="h-14 border-b border-border/40 bg-card flex items-center px-4 shrink-0 justify-between print:hidden">
          <div className="flex items-center text-sm text-muted-foreground font-medium">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="Home Root" className="h-5 w-auto" />
            </Link>
            <ChevronRight className="w-4 h-4 mx-1 opacity-50" />
            <Link
              to={location.pathname}
              className="text-primary font-semibold capitalize hover:opacity-80 transition-opacity"
            >
              {location.pathname === "/" ? "Tailor" : location.pathname.substring(1)}
            </Link>
          </div>
        </header>

        {/* Dynamic App Renderer (Outlet) */}
        <div className="flex-1 bg-muted/10 overflow-hidden print:overflow-visible print:block print:bg-white">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
