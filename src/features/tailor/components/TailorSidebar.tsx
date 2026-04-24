import { Briefcase, FileSignature, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

export interface JobApp {
  id: string;
  company: string;
  role: string;
  job_description: string;
  tailored_cv: string;
  cover_letter: string;
  qa_prep: string;
  created_at: number;
}

interface TailorSidebarProps {
  viewState: "new" | "catalog";
  setViewState: (s: "new" | "catalog") => void;
  jobDesc: string;
  setJobDesc: (s: string) => void;
  employerQuestions: string;
  setEmployerQuestions: (s: string) => void;
  handleTailor: () => void;
  loading: boolean;
  catalog: JobApp[];
  loadApplication: (app: JobApp) => void;
  deleteApp: (id: string, e: any) => void;
}

export function TailorSidebar({
  viewState,
  setViewState,
  jobDesc,
  setJobDesc,
  employerQuestions,
  setEmployerQuestions,
  handleTailor,
  loading,
  catalog,
  loadApplication,
  deleteApp,
}: TailorSidebarProps) {
  return (
    <Card className="w-1/3 flex flex-col overflow-hidden print:hidden border-border/40 bg-background/40 backdrop-blur-xl shadow-2xl relative">
      <div className="flex bg-muted/30 border-b border-border/40 shrink-0 p-2 gap-2">
        <Button
          variant={viewState === "new" ? "secondary" : "ghost"}
          className="flex-1 font-bold text-xs"
          onClick={() => setViewState("new")}
        >
          New Generator
        </Button>
        <Button
          variant={viewState === "catalog" ? "secondary" : "ghost"}
          className="flex-1 font-bold text-xs"
          onClick={() => setViewState("catalog")}
        >
          Archive Hub ({catalog.length})
        </Button>
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
            {catalog.map((app) => (
              <div
                key={app.id}
                className="p-4 bg-card/60 hover:bg-card border border-border/50 rounded-xl cursor-pointer transition-colors relative group"
                onClick={() => loadApplication(app)}
              >
                <h4 className="font-bold text-foreground truncate">{app.role}</h4>
                <p className="text-primary text-sm font-medium">{app.company}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(app.created_at).toLocaleDateString()}
                </p>
                <button
                  className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                  onClick={(e) => deleteApp(app.id, e)}
                >
                  ✕
                </button>
              </div>
            ))}
            {catalog.length === 0 && (
              <p className="text-muted-foreground text-sm italic text-center mt-10">
                No applications exported yet.
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
