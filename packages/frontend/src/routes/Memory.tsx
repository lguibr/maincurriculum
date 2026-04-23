import { useState, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import {
  Loader2,
  Database,
  Save,
  Code,
  FileText,
  Briefcase,
  GraduationCap,
  Code2,
  User as UserIcon,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

export default function Memory() {
  const [memoryJson, setMemoryJson] = useState("{}");
  const [baseCv, setBaseCv] = useState("");
  const [extendedCv, setExtendedCv] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/api/profile/latest`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id) {
          setProfileId(d.id);
          setMemoryJson(JSON.stringify(d.demographics_json || {}, null, 2));
          setBaseCv(d.base_cv || "");
          setExtendedCv(d.extended_cv || "");
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!profileId) return;
    setSaving(true);
    try {
      // Validate JSON
      const parsed = JSON.parse(memoryJson);

      await fetch(`http://localhost:3001/api/profile/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demographics_json: parsed, base_cv: baseCv }),
      });
      alert("Overrides saved to vector index!");
    } catch (e) {
      alert("Invalid JSON schema exactly inside the editor.");
      console.error(e);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden gap-4">
      <div className="flex items-center gap-2 text-violet-500 font-bold text-lg shrink-0">
        <Database className="w-5 h-5" /> Agent Context Data
      </div>

      <Tabs defaultValue="ui" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger
              value="ui"
              className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
            >
              <UserIcon className="w-4 h-4 mr-2" /> Profile Preview
            </TabsTrigger>
            <TabsTrigger
              value="json"
              className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500"
            >
              <Code className="w-4 h-4 mr-2" /> Raw JSON Editor
            </TabsTrigger>
          </TabsList>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-6 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? "Saving..." : "Save JSON Context"}
          </button>
        </div>

        <TabsContent
          value="json"
          className="flex-1 max-h-full m-0 bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 font-semibold text-sm shrink-0">
            demographics_json (Modifying this will alter Agent reasoning on your experience)
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

            {(() => {
              let parsed: any = {};
              try {
                parsed = JSON.parse(memoryJson);
              } catch (e) {
                // Ignore parse errors from temporary malformed JSON state
              }
              const getProjectName = (id: string) =>
                parsed.projects?.find(
                  (p: any) => p.id === id || p.name === id || p.repo_name === id
                )?.name || id;
              const getExperienceName = (id: string) =>
                parsed.experience?.find((e: any) => e.id === id)?.role || id;
              const getSkillName = (id: string) =>
                parsed.skills?.find((s: any) => s.id === id)?.name || id;
              return (
                <div className="space-y-12 border-t border-border/40 pt-12">
                  <h2 className="text-2xl font-bold tracking-tight mb-6 text-primary">
                    Ontological Breakdown Profile
                  </h2>

                  {parsed.skills && parsed.skills.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Code2 className="w-6 h-6 mr-2 text-violet-500" /> Skills Architecture
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {parsed.skills.map((s: any, i: number) => (
                          <div
                            key={i}
                            className="p-4 bg-muted/20 border border-border/50 rounded-xl hover:bg-muted/30 transition-all"
                          >
                            <div className="font-bold text-lg mb-2">{s.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {Array.isArray(s.connections) ? s.connections.join(" • ") : ""}
                            </div>
                            {(Array.isArray(s.linked_project_ids) ||
                              Array.isArray(s.linked_experience_ids)) && (
                              <div className="text-xs mt-2 font-mono text-violet-400/80">
                                {s.linked_project_ids?.map(
                                  (id: string) => `[PRJ: ${getProjectName(id)}] `
                                )}
                                {s.linked_experience_ids?.map(
                                  (id: string) => `[EXP: ${getExperienceName(id)}] `
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsed.experience && parsed.experience.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Briefcase className="w-6 h-6 mr-2 text-blue-500" /> Experience Timeline
                      </h3>
                      <div className="space-y-4">
                        {parsed.experience.map((e: any, i: number) => (
                          <div
                            key={i}
                            className="p-5 bg-muted/20 border border-border/50 rounded-xl hover:bg-muted/30 transition-all border-l-4 border-l-blue-500"
                          >
                            <div className="font-bold text-lg text-blue-100">{e.role}</div>
                            {e.company && (
                              <div className="text-primary font-medium">{e.company}</div>
                            )}
                            {Array.isArray(e.projects_executed) && (
                              <div className="text-sm mt-3 text-muted-foreground font-mono">
                                Projects Executed: {e.projects_executed.join(", ")}
                              </div>
                            )}
                            {Array.isArray(e.linked_project_ids) && (
                              <div className="text-sm mt-3 text-blue-400/80 font-mono">
                                Linked Projects:{" "}
                                {e.linked_project_ids
                                  .map((id: string) => getProjectName(id))
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsed.education && parsed.education.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center">
                        <GraduationCap className="w-6 h-6 mr-2 text-emerald-500" /> Education
                        Background
                      </h3>
                      <div className="space-y-4">
                        {parsed.education.map((e: any, i: number) => (
                          <div
                            key={i}
                            className="p-5 bg-muted/20 border border-border/50 rounded-xl hover:bg-muted/30 transition-all border-l-4 border-l-emerald-500"
                          >
                            <div className="font-bold text-lg text-emerald-100">{e.degree}</div>
                            {Array.isArray(e.foundational_skills) && (
                              <div className="text-sm mt-3 text-muted-foreground font-mono">
                                Foundations: {e.foundational_skills.join(", ")}
                              </div>
                            )}
                            {Array.isArray(e.linked_skill_ids) && (
                              <div className="text-sm mt-3 text-emerald-400/80 font-mono">
                                Linked Skills:{" "}
                                {e.linked_skill_ids
                                  .map((id: string) => getSkillName(id))
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsed.projects && parsed.projects.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold mb-4 flex items-center">
                        <Database className="w-6 h-6 mr-2 text-orange-500" /> Extracted Projects
                      </h3>
                      <div className="space-y-4">
                        {parsed.projects.map((p: any, i: number) => (
                          <div
                            key={i}
                            className="p-5 bg-muted/20 border border-border/50 rounded-xl hover:bg-muted/30 transition-all relative overflow-hidden"
                          >
                            <div className="font-bold text-lg text-orange-100 mb-1">
                              {p.name || p.repo_name}{" "}
                              {p.id && (
                                <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full ml-2 align-middle border border-orange-500/30">
                                  ID: {p.id}
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <div className="text-sm text-foreground/80 mb-3">{p.description}</div>
                            )}
                            {Array.isArray(p.tags) && p.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {p.tags.map((t: string, j: number) => (
                                  <span
                                    key={j}
                                    className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-md"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {Array.isArray(p.linked_skill_ids) && (
                              <div className="text-sm mb-3 text-orange-400/80 font-mono">
                                Linked Skills:{" "}
                                {p.linked_skill_ids
                                  .map((id: string) => getSkillName(id))
                                  .join(", ")}
                              </div>
                            )}
                            {p.ast_summary && (
                              <div className="text-xs text-muted-foreground font-mono leading-relaxed bg-black/40 p-3 rounded-lg mt-2 border border-border/30">
                                <strong>AI Summary:</strong> {p.ast_summary}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
