import { useEffect, useState, useRef } from "react";
import { dbOps } from "../db/indexedDB";
import { Download, Copy, BarChart3, Code, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "monospace"
});

const MermaidChart = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderChart = async () => {
      try {
        if (ref.current) {
          const id = "mermaid-" + Math.random().toString(36).substr(2, 9);
          const { svg } = await mermaid.render(id, chart);
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        console.error("Mermaid parsing error", e);
      }
    };
    renderChart();
  }, [chart]);

  return <div ref={ref} className="mermaid flex justify-center w-full px-4 py-8 bg-black/20 rounded-xl mb-6 shadow-inner border border-white/5 overflow-x-auto" />;
};

export default function Timeline() {
  const [markdown, setMarkdown] = useState<string>("Generating...");
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");

  useEffect(() => {
    (async () => {
      try {
        const rawExps = await dbOps.getExperiences();
        const rawEdus = await dbOps.getEducations();
        const rawProjs = await dbOps.getProjects();
        const skills = await dbOps.getSkills();

        // Deduplication
        const exps = Array.from(new Map(rawExps.map(e => [e.company + e.role, e])).values());
        const edus = Array.from(new Map(rawEdus.map(e => [e.school + e.degree, e])).values());
        const projs = Array.from(new Map(rawProjs.map(p => [p.repo_name, p])).values());

        let md = "# Career Timeline & Analytics\n\n";
        
        // Calculate active durations per skill
        const skillCounts: Record<string, number> = {};
        const skillDurationsMonths: Record<string, number> = {};
        
        md += "## Experience Gantt Chart\n\n```mermaid\ngantt\n";
        md += "    title Professional Timeline\n";
        md += "    dateFormat YYYY-MM-DD\n";
        md += "    axisFormat %Y\n";
        
        exps.sort((a,b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime());
        
        for (const exp of exps) {
          md += `    section ${exp.company}\n`;
          const st = exp.start_date ? new Date(exp.start_date).toISOString().split('T')[0] : "2000-01-01";
          const isPresent = exp.end_date?.toLowerCase().includes("present") || !exp.end_date;
          const ed = isPresent ? new Date().toISOString().split('T')[0] : new Date(exp.end_date!).toISOString().split('T')[0];
          
          md += `    ${exp.role} : ${st}, ${ed}\n`;
          
          const m1 = new Date(st);
          const m2 = new Date(ed);
          const months = (m2.getFullYear() - m1.getFullYear())*12 + (m2.getMonth() - m1.getMonth());
          
          // aggregate skills
          exp.skills?.forEach(sId => {
            skillCounts[sId] = (skillCounts[sId] || 0) + 1;
            skillDurationsMonths[sId] = (skillDurationsMonths[sId] || 0) + months;
          });
        }
        
        projs.forEach(p => {
          p.skills?.forEach(sId => {
            skillCounts[sId] = (skillCounts[sId] || 0) + 1;
          });
        });
        
        md += "```\n\n## Skill Matrix\n\n";
        md += "| Skill | Project/Role Mentions | Approx. Duration (Months) |\n|------|----------|---------------------------|\n";
        
        const sortedSkills = Object.entries(skillCounts).sort((a,b) => b[1] - a[1]);
        for (const [id, count] of sortedSkills) {
          const skillName = skills.find(s => s.id === id)?.name || id;
          const dur = skillDurationsMonths[id] || 0;
          md += `| ${skillName} | ${count} | ${dur > 0 ? dur + ' mo' : '-'} |\n`;
        }
        
        setMarkdown(md);
      } catch (err) {
        console.error(err);
        setMarkdown("Error generating timeline");
      }
    })();
  }, []);

  return (
    <div className="p-8 h-full flex flex-col gap-6 overflow-y-auto">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="text-primary w-8 h-8"/> Timeline Analytics
        </h1>
        <div className="flex gap-3">
          <div className="bg-muted p-1 rounded-lg flex items-center text-sm mr-4">
             <button
                onClick={() => setViewMode("visual")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${viewMode === "visual" ? "bg-black/50 text-white shadow-sm" : "text-muted-foreground hover:text-white"}`}
             >
                <Eye className="w-4 h-4"/> Visual
             </button>
             <button
                onClick={() => setViewMode("raw")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-all ${viewMode === "raw" ? "bg-black/50 text-white shadow-sm" : "text-muted-foreground hover:text-white"}`}
             >
                <Code className="w-4 h-4"/> Markdown
             </button>
          </div>

          <button 
            onClick={() => navigator.clipboard.writeText(markdown)}
            className="flex items-center px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-semibold transition-colors"
          >
            <Copy className="w-4 h-4 mr-2" /> Copy MD
          </button>
          <button 
            onClick={() => {
              const element = document.createElement("a");
              const file = new Blob([markdown], {type: 'text/markdown'});
              element.href = URL.createObjectURL(file);
              element.download = "curriculum-timeline.md";
              document.body.appendChild(element);
              element.click();
            }}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-semibold shadow-md transition-all drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
          >
            <Download className="w-4 h-4 mr-2" /> Download MD
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-black/40 border border-border/40 backdrop-blur-md rounded-xl p-8 overflow-y-auto shadow-2xl">
        {viewMode === "raw" ? (
           <div className="font-mono text-sm text-green-400 whitespace-pre-wrap">
             {markdown}
           </div>
        ) : (
           <div className="prose prose-invert max-w-none text-white/90">
             <ReactMarkdown
               components={{
                 code(props: any) {
                   const { children, className, inline } = props;
                   const match = /language-(\w+)/.exec(className || "");
                   if (!inline && match && match[1] === "mermaid") {
                     return <MermaidChart chart={String(children).replace(/\n$/, "")} />;
                   }
                   return (
                     <code className={className || "text-primary bg-primary/10 px-1 py-0.5 rounded-sm font-mono"} {...props}>
                       {children}
                     </code>
                   );
                 },
                 h1: ({children}) => <h1 className="text-4xl font-bold mb-8 text-white border-b border-border/50 pb-4">{children}</h1>,
                 h2: ({children}) => <h2 className="text-2xl font-semibold mb-4 mt-12 text-primary">{children}</h2>,
                 table: ({children}) => <div className="overflow-x-auto my-6 rounded-lg border border-border/40"><table className="w-full text-left border-collapse">{children}</table></div>,
                 th: ({children}) => <th className="p-4 border-b border-border/40 bg-black/40 text-muted-foreground uppercase text-xs tracking-wider font-semibold">{children}</th>,
                 td: ({children}) => <td className="p-4 border-b border-border/20 text-white/90 text-sm">{children}</td>,
               }}
             >
               {markdown}
             </ReactMarkdown>
           </div>
        )}
      </div>
    </div>
  );
}
