import { useEffect, useState, useRef } from "react";
import { dbOps } from "../db/indexedDB";
import { Download, Copy, BarChart3, Code, Eye, Layers } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { MermaidChart } from "../features/timeline/components/MermaidChart";
import { getSafeDate, getSafeEnd } from "../features/timeline/utils/mermaidUtils";

export default function Timeline() {
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");

  const [mdExps, setMdExps] = useState("Loading...");
  const [mdProjs, setMdProjs] = useState("Loading...");
  const [mdEdus, setMdEdus] = useState("Loading...");
  const [mdSkills, setMdSkills] = useState("Loading...");

  const [rawMarkdown, setRawMarkdown] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const rawExps = await dbOps.getExperiences();
        const rawEdus = await dbOps.getEducations();
        const rawProjs = await dbOps.getProjects();
        const rawSkills = await dbOps.getSkills();

        // Deduplication
        const exps = Array.from(new Map(rawExps.map(e => [e.company + e.role, e])).values()) as Experience[];
        const edus = Array.from(new Map(rawEdus.map(e => [e.school + e.degree, e])).values()) as Education[];
        const projs = Array.from(new Map(rawProjs.map(p => [p.repo_name, p])).values()) as Project[];

        // --- EXPERIENCES GANTT ---
        let expGraph = "```mermaid\ngantt\n    title Professional Experiences\n    dateFormat YYYY-MM-DD\n    axisFormat %Y-%m\n";
        exps.sort((a,b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
        for (const exp of exps) {
          expGraph += `    section ${(exp.company || "Company").replace(/[:]/g,"")}\n`;
          const st = getSafeDate(exp.start_date);
          const ed = getSafeEnd(st, exp.end_date);
          expGraph += `    ${(exp.role || "Role").replace(/[:]/g,"")} : ${st}, ${ed}\n`;
        }
        expGraph += "```";
        setMdExps(expGraph);

        // --- PROJECTS GANTT ---
        let projGraph = "```mermaid\ngantt\n    title Technical Projects\n    dateFormat YYYY-MM-DD\n    axisFormat %Y-%m\n";
        projs.sort((a,b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
        for (const proj of projs) {
          projGraph += `    section ${(proj.repo_name || "Project").replace(/[-:]/g," ")}\n`;
          const st = getSafeDate(proj.start_date);
          const ed = getSafeEnd(st, proj.end_date);
          projGraph += `    Active Development : ${st}, ${ed}\n`;
        }
        projGraph += "```";
        setMdProjs(projGraph);

        // --- EDUCATION GANTT ---
        let eduGraph = "```mermaid\ngantt\n    title Education & Certifications\n    dateFormat YYYY-MM-DD\n    axisFormat %Y\n";
        edus.sort((a,b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
        for (const edu of edus) {
          eduGraph += `    section ${(edu.school || "Institution").replace(/[:]/g,"")}\n`;
          const st = getSafeDate(edu.start_date);
          const ed = getSafeEnd(st, edu.end_date);
          eduGraph += `    ${(edu.degree || "Degree").replace(/[:]/g,"")} : ${st}, ${ed}\n`;
        }
        eduGraph += "```";
        setMdEdus(eduGraph);

        // --- SKILLS TIMELINE ---
        // We will map First Mention to Last Mention
        const skillDates: Record<string, { first: string, last: string }> = {};
        const applyDateToSkill = (sId: string, dt: string) => {
            const dStr = getSafeDate(dt);
            if (!skillDates[sId]) skillDates[sId] = { first: dStr, last: dStr };
            else {
                if (new Date(dStr) < new Date(skillDates[sId].first)) skillDates[sId].first = dStr;
                if (new Date(dStr) > new Date(skillDates[sId].last)) skillDates[sId].last = dStr;
            }
        };

        exps.forEach(e => {
            const end = getSafeEnd(getSafeDate(e.start_date), e.end_date);
            e.skills?.forEach(s => { applyDateToSkill(s, e.start_date!); applyDateToSkill(s, end); });
        });
        projs.forEach(p => {
             const end = getSafeEnd(getSafeDate(p.start_date), p.end_date);
             p.skills?.forEach(s => { applyDateToSkill(s, p.start_date!); applyDateToSkill(s, end); });
        });

        // Filter valid skills and top 20 by duration
        const skillList = Object.entries(skillDates).map(([id, dates]) => {
            const n1 = new Date(dates.first).getTime();
            const n2 = new Date(dates.last).getTime();
            return { id, first: dates.first, last: dates.last, duration: n2 - n1 };
        }).sort((a,b) => b.duration - a.duration).slice(0, 20);

        let skillGraph = "```mermaid\ngantt\n    title Long-Term Skill Lifecycle (Top 20)\n    dateFormat YYYY-MM-DD\n    axisFormat %Y\n";
        for (const s of skillList) {
             const baseSkill = rawSkills.find(x => x.id === s.id);
             if (baseSkill) {
                skillGraph += `    section ${(baseSkill.name || "Skill").replace(/[:.#]/g,"")}\n`;
                const ed = getSafeEnd(s.first, s.last);
                skillGraph += `    Tenure : ${s.first}, ${ed}\n`;
             }
        }
        skillGraph += "```";
        setMdSkills(skillGraph);

        const buildMd = `# Analytics\n\n## Experiences\n${expGraph}\n\n## Projects\n${projGraph}\n\n## Education\n${eduGraph}\n\n## Skills\n${skillGraph}`;
        setRawMarkdown(buildMd);

      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col gap-6 overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-3xl font-bold flex items-center gap-3 drop-shadow-md">
          <Layers className="text-blue-500 w-8 h-8"/> Visual Analytics
        </h1>
        <div className="flex gap-4">
          <div className="bg-white/5 border border-white/10 p-1.5 rounded-lg flex items-center shadow-inner">
             <button
                onClick={() => setViewMode("visual")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 transition-all ${viewMode === "visual" ? "bg-blue-600/50 text-white shadow-md border border-white/20" : "text-white/50 hover:text-white"}`}
             >
                <Eye className="w-4 h-4"/> Graphical
             </button>
             <button
                onClick={() => setViewMode("raw")}
                className={`px-4 py-1.5 rounded-md flex items-center gap-2 transition-all ${viewMode === "raw" ? "bg-purple-600/50 text-white shadow-md border border-white/20" : "text-white/50 hover:text-white"}`}
             >
                <Code className="w-4 h-4"/> Markdown
             </button>
          </div>

          <button 
            onClick={() => navigator.clipboard.writeText(rawMarkdown)}
            className="flex items-center px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 text-sm font-semibold transition-colors"
          >
            <Copy className="w-4 h-4 mr-2" /> Copy MD
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 pb-12 custom-scrollbar">
        {viewMode === "raw" ? (
           <div className="bg-black/60 border border-white/10 backdrop-blur-xl rounded-xl p-6 font-mono text-xs text-blue-200 whitespace-pre-wrap shadow-2xl">
             {rawMarkdown}
           </div>
        ) : (
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
               
               {/* Card Experiences */}
               <div className="bg-gradient-to-br from-[#12182B] to-[#0A0E1A] border border-blue-900/30 shadow-[0_0_40px_-15px_rgba(37,99,235,0.2)] rounded-2xl overflow-hidden flex flex-col">
                   <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                       <h2 className="text-xl font-semibold text-blue-200 tracking-wide flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-3 animate-pulse"></span>Professional Experiences</h2>
                   </div>
                   <div className="p-6 overflow-x-auto w-full prose prose-invert">
                       <ReactMarkdown components={{ code: ({children}) => <MermaidChart chart={String(children)} /> }}>
                            {mdExps}
                       </ReactMarkdown>
                   </div>
               </div>

               {/* Card Projects */}
               <div className="bg-gradient-to-br from-[#1A0B2E] to-[#0D0518] border border-purple-900/30 shadow-[0_0_40px_-15px_rgba(147,51,234,0.2)] rounded-2xl overflow-hidden flex flex-col">
                   <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                       <h2 className="text-xl font-semibold text-purple-200 tracking-wide flex items-center"><span className="w-3 h-3 rounded-full bg-purple-500 mr-3 animate-pulse"></span>Global Projects</h2>
                   </div>
                   <div className="p-6 overflow-x-auto w-full prose prose-invert">
                       <ReactMarkdown components={{ code: ({children}) => <MermaidChart chart={String(children)} /> }}>
                            {mdProjs}
                       </ReactMarkdown>
                   </div>
               </div>

               {/* Card Skills */}
               <div className="bg-gradient-to-br from-[#0B2521] to-[#05110F] border border-emerald-900/30 shadow-[0_0_40px_-15px_rgba(16,185,129,0.2)] rounded-2xl overflow-hidden flex flex-col xl:col-span-2">
                   <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                       <h2 className="text-xl font-semibold text-emerald-200 tracking-wide flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-3 animate-pulse"></span>Skill Lifecycles & Matrix</h2>
                   </div>
                   <div className="p-6 overflow-x-auto w-full prose prose-invert">
                       <ReactMarkdown components={{ code: ({children}) => <MermaidChart chart={String(children)} /> }}>
                            {mdSkills}
                       </ReactMarkdown>
                   </div>
               </div>

               {/* Card Education */}
               <div className="bg-gradient-to-br from-[#2E180B] to-[#170C05] border border-orange-900/30 shadow-[0_0_40px_-15px_rgba(249,115,22,0.2)] rounded-2xl overflow-hidden flex flex-col xl:col-span-2">
                   <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                       <h2 className="text-xl font-semibold text-orange-200 tracking-wide flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-3 animate-pulse"></span>Education Path</h2>
                   </div>
                   <div className="p-6 overflow-x-auto w-full prose prose-invert">
                       <ReactMarkdown components={{ code: ({children}) => <MermaidChart chart={String(children)} /> }}>
                            {mdEdus}
                       </ReactMarkdown>
                   </div>
               </div>

           </div>
        )}
      </div>
    </div>
  );
}
