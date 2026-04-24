import MonacoEditor from "@monaco-editor/react";
import { Code, FileText, Loader2, Save, User as UserIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

export function MemoryDashboard({
  memoryJson,
  setMemoryJson,
  saving,
  handleSaveJson,
  extendedCv,
}: {
  memoryJson: string;
  setMemoryJson: (val: string) => void;
  saving: boolean;
  handleSaveJson: () => void;
  extendedCv: string;
}) {
  return (
    <Tabs defaultValue="ui" className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger
            value="ui"
            className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
          >
            <UserIcon className="w-4 h-4 mr-2" /> Extended Profile Preview
          </TabsTrigger>
          <TabsTrigger
            value="json"
            className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500"
          >
            <Code className="w-4 h-4 mr-2" /> Global Demographics Map
          </TabsTrigger>
        </TabsList>

        <button
          onClick={handleSaveJson}
          disabled={saving}
          className="h-9 px-6 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Demographics"}
        </button>
      </div>

      <TabsContent
        value="json"
        className="flex-1 max-h-full m-0 bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="h-10 border-b border-border/50 bg-muted/20 flex items-center px-4 font-semibold text-xs text-muted-foreground shrink-0 uppercase tracking-wider">
          Raw JSON Profile Editor
        </div>
        <div className="flex-1 w-full min-h-0 relative">
          <MonacoEditor
            wrapperProps={{ className: "absolute inset-0" }}
            height="100%"
            width="100%"
            defaultLanguage="json"
            theme="vs-dark"
            value={memoryJson}
            onChange={(v) => setMemoryJson(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 16 },
            }}
          />
        </div>
      </TabsContent>

      <TabsContent
        value="ui"
        className="flex-1 max-h-full m-0 bg-card border border-border/50 rounded-xl overflow-y-auto shadow-2xl custom-scrollbar p-8"
      >
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-8 flex items-center border-b border-border/40 pb-4">
              <FileText className="w-8 h-8 mr-3 text-primary" /> Master Extended CV
            </h1>
            <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-muted/40 max-w-none text-foreground/90">
              {extendedCv ? (
                <ReactMarkdown>{extendedCv}</ReactMarkdown>
              ) : (
                <div className="text-muted-foreground italic">
                  No Extended CV found. Run Resume Onboarding to generate it.
                </div>
              )}
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
