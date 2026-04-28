import { Fingerprint, BarChart3, Database, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 md:px-12 relative overflow-y-auto custom-scrollbar pt-20 pb-12">
      <div className="max-w-4xl w-full flex flex-col items-center">
        
        <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center mb-8 border border-cyan-500/20 shadow-[0_0_60px_-15px_rgba(6,182,212,0.4)] relative">
            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-pulse delay-75"></div>
            <Fingerprint className="w-12 h-12 text-cyan-400 animate-pulse" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-600 mb-6 drop-shadow-sm">
          Main<span className="text-cyan-500 font-black">.</span>Curriculum
        </h1>
        
        <p className="text-lg md:text-xl text-neutral-400 mb-12 max-w-2xl font-medium leading-relaxed">
          The ultimate agentic career orchestration system. 
          Manage your master technical profile, generate hyper-targeted CVs, and prep for high-tier engineering interviews seamlessly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left">
           <Link to="/tailor" className="group p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 hover:bg-neutral-800/50 hover:border-cyan-500/50 transition-all hover:-translate-y-1 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute -inset-20 bg-gradient-to-br from-cyan-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Briefcase className="w-8 h-8 text-cyan-400 mb-4" />
              <h2 className="text-lg font-bold text-white mb-2 tracking-wide">Job Tailor</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Instantly generate targeted CV variations and custom cover letters based on any job description.</p>
           </Link>

           <Link to="/timeline" className="group p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 hover:bg-neutral-800/50 hover:border-purple-500/50 transition-all hover:-translate-y-1 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute -inset-20 bg-gradient-to-br from-purple-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <BarChart3 className="w-8 h-8 text-purple-400 mb-4" />
              <h2 className="text-lg font-bold text-white mb-2 tracking-wide">Analytics</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Visualize your professional history, project timelines, and evolving engineering skill matrix natively.</p>
           </Link>

           <Link to="/memory" className="group p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 hover:bg-neutral-800/50 hover:border-emerald-500/50 transition-all hover:-translate-y-1 relative overflow-hidden backdrop-blur-xl">
              <div className="absolute -inset-20 bg-gradient-to-br from-emerald-500/10 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Database className="w-8 h-8 text-emerald-400 mb-4" />
              <h2 className="text-lg font-bold text-white mb-2 tracking-wide">Vector Context</h2>
              <p className="text-sm text-neutral-400 leading-relaxed">Preview the actual high-density semantic RAG chunks the LLM uses to corroborate your profile.</p>
           </Link>
        </div>
      </div>
    </div>
  );
}
