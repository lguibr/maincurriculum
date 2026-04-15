import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, FolderGit2, Sparkles, Target } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function Improve() {
  const [improvedCv, setImprovedCv] = useState("");
  const [loading, setLoading] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/api/profile/latest`)
      .then(r => r.json())
      .then(d => { 
        if (d && d.id) {
          setProfileId(d.id);
          setImprovedCv(d.extended_cv || d.base_cv || "");
        }
      })
      .catch(console.error);
  }, []);

  const handleImprove = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, instruction, currentCv: improvedCv })
      });
      const data = await res.json();
      if (data.improvedCv) setImprovedCv(data.improvedCv);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden gap-4 print:p-0 print:h-auto print:overflow-visible print:block">
      <div className="flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-blue-500 font-bold text-lg">
             <FolderGit2 className="w-5 h-5" /> CV Improver Agent
          </div>
          <button 
            onClick={handleImprove}
            disabled={loading || !profileId}
            className="h-10 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? "Critiquing..." : "Rewrite Base CV"}
          </button>
      </div>
      
      <div className="bg-card border border-border/50 rounded-xl p-4 shadow-md shrink-0 flex gap-4 items-start print:hidden">
         <Target className="w-6 h-6 text-blue-500 mt-2 shrink-0" />
         <div className="flex-1">
            <label className="text-sm font-semibold text-foreground/80 block mb-2">Optional Fine-Tuning Instructions</label>
            <Textarea 
               placeholder="e.g. Optimize this CV iteration specifically for a Senior Machine Learning Engineer position. Emphasize GPU architecture over traditional web development."
               className="resize-none min-h-[60px] bg-muted/20 border-border/50 focus-visible:ring-blue-500/50"
               value={instruction}
               onChange={(e) => setInstruction(e.target.value)}
            />
         </div>
      </div>
      
      <div className="flex-1 bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl relative print:border-none print:shadow-none print:bg-white print:overflow-visible print:block">
        <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 font-semibold text-sm justify-between print:hidden">
           <span>Mega CV Interactive Editor</span>
           <div className="flex items-center gap-2">
           {improvedCv && (
             <button 
               onClick={async () => {
                 if(!profileId) return;
                 await fetch(`http://${window.location.hostname}:3001/api/profile/${profileId}/extended`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extended_cv: improvedCv })
                 });
                 alert("Master CV permanently updated!");
               }}
               className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold shadow"
             >
                Save as Master CV
             </button>
           )}
           {improvedCv && (
             <button onClick={() => window.print()} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs">
                Export PDF
             </button>
           )}
           </div>
        </div>
        <div className="p-8 overflow-y-auto h-[calc(100%-3rem)] w-full max-w-none prose prose-invert prose-blue print:p-0 print:h-auto print:overflow-visible">
          {improvedCv ? (
            <ReactMarkdown>{improvedCv}</ReactMarkdown>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground/50">
               Click the rewrite button above to synthesize your repository code into a top-tier resume.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
