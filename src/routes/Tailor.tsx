import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, Briefcase, FileSignature, MessageSquare } from "lucide-react";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";

interface JobApp {
  id: string;
  company: string;
  role: string;
  job_description: string;
  tailored_cv: string;
  cover_letter: string;
  qa_prep: string;
  created_at: number;
}

export default function Tailor() {
  const [jobDesc, setJobDesc] = useState("");
  const [employerQuestions, setEmployerQuestions] = useState("");
  const [catalog, setCatalog] = useState<JobApp[]>([]);
  const [viewState, setViewState] = useState<"new" | "catalog">("new");
  const [outputs, setOutputs] = useState({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
  const [activeTab, setActiveTab] = useState<"cv" | "letter" | "qa">("cv");
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  useEffect(() => {
    dbOps.getJobApplications().then(apps => {
       if (apps) setCatalog(apps.sort((a,b) => b.created_at - a.created_at));
    });
  }, []);

  const handleTailor = async () => {
    if (!jobDesc) return;
    setLoading(true);
    setOutputs({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
    try {
      const prof = await dbOps.getProfile("main");
      if (!prof) throw new Error("Profile missing");

      // Generate context block
      const context = `
Candidate CV:
${prof.extended_cv || prof.base_cv}

Candidate Demographics & Identity (Use logically): 
${JSON.stringify(prof.demographics_json)}

Target Job Description:
${jobDesc}
`;

      const [cvRes, coverRes, qsRes] = await Promise.all([
        GeminiInference.generate(
          `Rewrite the CV specifically to perfectly match the target job description. Do not hallucinate experiences, just reframe existing ones to match the keywords and tone.\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        GeminiInference.generate(
          `Write an aggressively impressive Cover Letter for this job description based on the candidate's CV.\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        employerQuestions
          ? GeminiInference.generate(
              `Answer the following employer questions using the candidate's perspective securely: ${employerQuestions}\n\nContext:\n${context}`,
              "text",
              "gemini-pro-latest"
            )
          : Promise.resolve(""),
      ]);

      const extractMetaPrompt = `Extract a JSON from this Job Description determining {"company": "Company Name", "role": "Job Title"}. If missing, use "Unknown".\nJD:\n${jobDesc}`;
      const metaStr = await GeminiInference.generate(extractMetaPrompt, "json", "gemini-flash-latest");
      let company = "Unknown Company", role = "Unknown Role";
      try {
         const m = metaStr.match(/\{[\s\S]*\}/);
         if (m) {
           const parsed = JSON.parse(m[0]);
           company = parsed.company;
           role = parsed.role;
         }
      } catch (ex) {}

      const newApp: JobApp = {
         id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
         company,
         role,
         job_description: jobDesc,
         tailored_cv: cvRes,
         cover_letter: coverRes,
         qa_prep: qsRes,
         created_at: Date.now()
      };

      await dbOps.saveJobApplication(newApp);
      const apps = await dbOps.getJobApplications();
      setCatalog(apps.sort((a,b) => b.created_at - a.created_at));

      setOutputs({ tailoredCv: cvRes, coverLetter: coverRes, employerAnswers: qsRes });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadApplication = (app: JobApp) => {
     setJobDesc(app.job_description);
     setOutputs({ tailoredCv: app.tailored_cv, coverLetter: app.cover_letter, employerAnswers: app.qa_prep });
     setViewState("new");
  };

  const getActiveContent = () => {
    if (activeTab === "cv") return outputs.tailoredCv;
    if (activeTab === "letter") return outputs.coverLetter;
    return outputs.employerAnswers;
  };

  const hasOutput = outputs.tailoredCv || outputs.coverLetter || outputs.employerAnswers;

  return (
    <div className="h-full flex gap-4 p-4 overflow-hidden print:h-auto print:overflow-visible print:block print:p-0">
      {/* Left Pane: Input Forms / Catalog */}
      <Card className="w-1/3 flex flex-col overflow-hidden print:hidden border-border/40 bg-background/40 backdrop-blur-xl shadow-2xl relative">
        <div className="flex bg-muted/30 border-b border-border/40 shrink-0 p-2 gap-2">
           <Button variant={viewState === "new" ? "secondary" : "ghost"} className="flex-1 font-bold text-xs" onClick={() => setViewState("new")}>New Generator</Button>
           <Button variant={viewState === "catalog" ? "secondary" : "ghost"} className="flex-1 font-bold text-xs" onClick={() => setViewState("catalog")}>Archive Hub ({catalog.length})</Button>
        </div>

        {viewState === "new" ? (
          <>
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Briefcase className="w-5 h-5" /> Target Job Description
                </div>
                <Textarea
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  placeholder="Paste the target job description here..."
                  className="min-h-[250px] resize-none bg-background/50 border-border/40 focus-visible:ring-primary/50"
                />

                <div className="flex items-center gap-2 text-primary font-bold mt-2">
                  <MessageSquare className="w-5 h-5" /> Employer Questions (Optional)
                </div>
                <Textarea
                  value={employerQuestions}
                  onChange={(e) => setEmployerQuestions(e.target.value)}
                  placeholder="e.g. 'Why do you want to work here?' or 'What is your salary expectation?'..."
                  className="min-h-[150px] resize-none bg-background/50 border-border/40 focus-visible:ring-primary/50"
                 />
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border/40 bg-background/60">
              <Button
                onClick={handleTailor}
                disabled={loading || !jobDesc}
                className="w-full h-12 font-bold shadow-lg transition-all"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <FileSignature className="w-5 h-5 mr-2" />
                )}
                {loading ? "Agent is writing..." : "Generate RAG Application"}
              </Button>
            </div>
          </>
        ) : (
           <ScrollArea className="flex-1 bg-background/20">
              <div className="p-4 space-y-3">
                 {catalog.map(app => (
                    <div key={app.id} className="p-4 bg-card/60 hover:bg-card border border-border/50 rounded-xl cursor-pointer transition-colors relative group" onClick={() => loadApplication(app)}>
                       <h4 className="font-bold text-foreground truncate">{app.role}</h4>
                       <p className="text-primary text-sm font-medium">{app.company}</p>
                       <p className="text-xs text-muted-foreground mt-2">{new Date(app.created_at).toLocaleDateString()}</p>
                       <button 
                         className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                         onClick={async (e) => { e.stopPropagation(); await dbOps.deleteJobApplication(app.id); setCatalog(catalog.filter(c => c.id !== app.id)); }}
                       >✕</button>
                    </div>
                 ))}
                 {catalog.length === 0 && <p className="text-muted-foreground text-sm italic text-center mt-10">No applications exported yet.</p>}
              </div>
           </ScrollArea>
        )}
      </Card>

      {/* Right Pane: Output with Tabs */}
      <Card className="w-2/3 flex flex-col relative h-full print:w-full print:h-auto print:block border-border/40 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="h-full flex flex-col">
          <div className="flex justify-between items-center p-2 border-b border-border/40 bg-background/60 print:hidden">
            <TabsList className="bg-background/50">
              <TabsTrigger value="cv">Tailored CV</TabsTrigger>
              <TabsTrigger value="letter">Cover Letter</TabsTrigger>
              <TabsTrigger value="qa">Form Answers</TabsTrigger>
            </TabsList>
            {hasOutput && (
              <Button
                onClick={() => window.print()}
                variant="secondary"
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 font-bold"
              >
                Export PDF
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative print:overflow-visible print:block bg-transparent top-pane-hack">
            <ScrollArea className="h-full w-full print:h-auto">
              <div className="p-8 max-w-none prose prose-invert prose-emerald print:h-auto print:overflow-visible print:p-0 text-foreground">
                {hasOutput ? (
                  <ReactMarkdown>{getActiveContent()}</ReactMarkdown>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center opacity-30 mt-20 pointer-events-none">
                    <div className="h-8 bg-muted rounded w-1/3 mb-6" />
                    <div className="h-4 bg-muted rounded w-full mb-3" />
                    <div className="h-4 bg-muted rounded w-5/6 mb-8" />
                    <div className="h-32 bg-muted rounded-xl w-full" />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
