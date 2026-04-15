import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Briefcase, FileSignature, MessageSquare } from "lucide-react";

export default function Tailor() {
  const [jobDesc, setJobDesc] = useState("");
  const [employerQuestions, setEmployerQuestions] = useState("");
  const [outputs, setOutputs] = useState({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
  const [activeTab, setActiveTab] = useState<"cv" | "letter" | "qa">("cv");
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/api/profile/latest`)
      .then(r => r.json())
      .then(d => { if (d && d.id) setProfileId(d.id); })
      .catch(console.error);
  }, []);

  const handleTailor = async () => {
    if (!profileId || !jobDesc) return;
    setLoading(true);
    setOutputs({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/api/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, jobDescription: jobDesc, employerQuestions })
      });
      const data = await res.json();
      setOutputs(data);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getActiveContent = () => {
     if (activeTab === 'cv') return outputs.tailoredCv;
     if (activeTab === 'letter') return outputs.coverLetter;
     return outputs.employerAnswers;
  };

  const hasOutput = outputs.tailoredCv || outputs.coverLetter || outputs.employerAnswers;

  return (
    <div className="h-full flex gap-4 p-4 overflow-hidden print:h-auto print:overflow-visible print:block print:p-0">
      {/* Left Pane: Input Forms */}
      <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 pb-8 print:hidden">
        <div className="flex items-center gap-2 text-primary font-bold">
           <Briefcase className="w-5 h-5" /> Target Job Description
        </div>
        <textarea 
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          placeholder="Paste the target job description here..."
          className="h-64 bg-card border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/50 outline-none resize-none"
        />

        <div className="flex items-center gap-2 text-primary font-bold mt-2">
           <MessageSquare className="w-5 h-5" /> Employer Questions (Optional)
        </div>
        <textarea 
          value={employerQuestions}
          onChange={(e) => setEmployerQuestions(e.target.value)}
          placeholder="e.g. 'Why do you want to work here?' or 'What is your salary expectation?'..."
          className="h-40 bg-card border border-border/50 rounded-xl p-4 focus:ring-2 focus:ring-primary/50 outline-none resize-none"
        />

        <button 
          onClick={handleTailor}
          disabled={loading || !jobDesc}
          className="mt-2 w-full h-12 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSignature className="w-5 h-5" />}
          {loading ? "Agent is writing..." : "Generate RAG Application"}
        </button>
      </div>

      {/* Right Pane: Output with Tabs */}
      <div className="w-2/3 flex flex-col relative h-full print:w-full print:h-auto print:block">
         <div className="flex gap-2 mb-2 print:hidden justify-between w-full relative">
            <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('cv')} 
              className={`px-4 py-2 rounded-t-lg font-semibold transition-all border-b-2 ${activeTab === 'cv' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
            >
              Tailored CV
            </button>
            <button 
              onClick={() => setActiveTab('letter')} 
              className={`px-4 py-2 rounded-t-lg font-semibold transition-all border-b-2 ${activeTab === 'letter' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
            >
              Cover Letter
            </button>
            <button 
              onClick={() => setActiveTab('qa')} 
              className={`px-4 py-2 rounded-t-lg font-semibold transition-all border-b-2 ${activeTab === 'qa' ? 'border-primary text-primary bg-primary/10' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
            >
              Form Answers
            </button>
            </div>
            {hasOutput && (
               <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
               >
                 Export PDF
               </button>
            )}
         </div>

        <div className="flex-1 bg-card border border-border/50 rounded-b-xl rounded-tr-xl overflow-hidden shadow-2xl relative print:border-none print:shadow-none print:bg-white print:overflow-visible print:block">
          <div className="h-full p-8 overflow-y-auto w-full max-w-none prose prose-invert prose-emerald print:h-auto print:overflow-visible print:p-0">
            {hasOutput ? (
              <ReactMarkdown>{getActiveContent()}</ReactMarkdown>
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center opacity-30 pointer-events-none">
                <div className="h-8 bg-muted rounded w-1/3 mb-6" />
                <div className="h-4 bg-muted rounded w-full mb-3" />
                <div className="h-4 bg-muted rounded w-5/6 mb-8" />
                <div className="h-32 bg-muted rounded-xl w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
