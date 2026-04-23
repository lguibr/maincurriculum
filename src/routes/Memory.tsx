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
  FolderTree,
  ChevronRight,
  Trash2,
  Edit3,
  X
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import { dbOps } from "../db/indexedDB";
import { useEntityStore } from "../store/useEntityStore";
import { fetchEntities, deleteEntity } from "../actions/pipelineActions";
import { RelationChip } from "../components/RelationChip";

function SidebarCategory({
  title,
  type,
  items = [],
  Icon,
  selectedEntity,
  setSelectedEntity,
}: {
  title: string;
  type: "skill" | "experience" | "project" | "education";
  items: any[];
  Icon: any;
  selectedEntity: any;
  setSelectedEntity: any;
}) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="w-full">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-2 hover:text-foreground transition-colors"
      >
        <span className="flex items-center"><Icon className="w-3.5 h-3.5 mr-2 opacity-70" /> {title} ({items.length})</span>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1">
          {items.map(item => {
            const isSelected = selectedEntity?.id === item.id && selectedEntity?.type === type;
            const displayName = item.name || item.repo_name || item.role || item.degree || item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedEntity({type, id: item.id})}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium truncate transition-colors flex items-center ${isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50 text-foreground/80'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />
                {displayName}
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
}

export default function Memory() {
  const [memoryJson, setMemoryJson] = useState("{}");
  const [baseCv, setBaseCv] = useState("");
  const [extendedCv, setExtendedCv] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Entities directly from store
  const entities = useEntityStore((s) => s.entities);
  const [selectedEntity, setSelectedEntity] = useState<{type: "skill"|"project"|"experience"|"education", id: string} | null>(null);
  const [editBuffer, setEditBuffer] = useState<any>(null);

  useEffect(() => {
    fetchEntities();
  }, []);

  useEffect(() => {
    dbOps
      .getProfile("main")
      .then((d) => {
        if (d && d.id) {
          setProfileId(d.id as any);
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

  useEffect(() => {
    if (!selectedEntity || !entities) {
       setEditBuffer(null);
       return;
    }
    const { type, id } = selectedEntity;
    let found = null;
    if (type === "skill") found = entities.skills.find(s => s.id === id);
    if (type === "experience") found = entities.experiences.find(e => e.id === id);
    if (type === "project") found = entities.projects.find(p => p.id === id);
    if (type === "education") found = entities.educations.find(e => e.id === id);
    
    setEditBuffer(found ? JSON.parse(JSON.stringify(found)) : null);
  }, [selectedEntity, !!entities]);

  const handleSaveJson = async () => {
    if (!profileId) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(memoryJson);
      const prof = await dbOps.getProfile("main");
      if (prof) {
        prof.demographics_json = parsed;
        prof.base_cv = baseCv;
        await dbOps.saveProfile(prof);
      }
      alert("Overrides saved to vector index!");
    } catch (e) {
      alert("Invalid JSON schema exactly inside the editor.");
      console.error(e);
    }
    setSaving(false);
  };

  const handleSaveEntity = async () => {
    if (!selectedEntity || !editBuffer) return;
    try {
      const { type } = selectedEntity;
      if (type === "skill") await dbOps.saveSkill(editBuffer);
      if (type === "experience") await dbOps.saveExperience(editBuffer);
      if (type === "project") await dbOps.saveProject(editBuffer);
      if (type === "education") await dbOps.saveEducation(editBuffer);
      
      await fetchEntities();
      alert("Entity updated successfully!");
    } catch(e) {
      console.error(e);
      alert("Failed to save entity.");
    }
  }

  const handleDeleteEntity = async () => {
    if (!selectedEntity) return;
    const confirm = window.confirm("Are you sure you want to delete this entity?");
    if (!confirm) return;
    
    await deleteEntity(selectedEntity.type as any, selectedEntity.id);
    setSelectedEntity(null);
  }



  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-primary">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );

  return (
    <div className="h-full flex flex-row p-4 overflow-hidden gap-6 bg-background w-full">
      {/* LEFT SIDEBAR EXPLORER */}
      <div className="w-72 shrink-0 flex flex-col bg-card/50 border border-border/50 rounded-xl overflow-hidden shadow-sm hidden md:flex">
         <div className="p-4 border-b border-border/50 bg-muted/10 shrink-0">
           <div className="flex items-center gap-2 text-primary font-bold text-lg">
             <FolderTree className="w-5 h-5" /> Entity Explorer
           </div>
           <p className="text-xs text-muted-foreground mt-1 leading-snug">
             Navigate all extracted models injected into your generative memory.
           </p>
         </div>
         <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
           <SidebarCategory title="Skills" type="skill" items={entities?.skills} Icon={Code2} selectedEntity={selectedEntity} setSelectedEntity={setSelectedEntity} />
           <SidebarCategory title="Experiences" type="experience" items={entities?.experiences} Icon={Briefcase} selectedEntity={selectedEntity} setSelectedEntity={setSelectedEntity} />
           <SidebarCategory title="Educations" type="education" items={entities?.educations} Icon={GraduationCap} selectedEntity={selectedEntity} setSelectedEntity={setSelectedEntity} />
           <SidebarCategory title="Projects" type="project" items={entities?.projects} Icon={Database} selectedEntity={selectedEntity} setSelectedEntity={setSelectedEntity} />
         </div>
      </div>

      {/* RIGHT PANE: Editing or Default Dashboard */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden gap-4 h-full">
        {selectedEntity ? (
          <div className="flex-1 max-h-full m-0 bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <div className="h-16 px-6 border-b border-border/50 bg-muted/10 flex items-center justify-between shrink-0">
                 <h2 className="text-xl tracking-tight font-bold flex items-center capitalize text-foreground">
                    <Edit3 className="w-5 h-5 mr-3 text-primary" /> Edit {selectedEntity.type}
                 </h2>
                 <div className="flex gap-2">
                    <button onClick={handleDeleteEntity} className="h-9 px-4 bg-destructive/10 hover:bg-destructive/80 text-destructive hover:text-white rounded-lg transition-all flex items-center shadow-sm text-sm font-semibold">
                       <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </button>
                    <button onClick={handleSaveEntity} className="h-9 px-4 bg-primary hover:bg-primary/80 text-primary-foreground font-bold rounded-lg transition-all flex items-center shadow-sm text-sm">
                       <Save className="w-4 h-4 mr-2" /> Save Changes
                    </button>
                    <button onClick={() => setSelectedEntity(null)} className="h-9 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all flex items-center text-sm font-medium">
                       <X className="w-4 h-4 mr-2" /> Close
                    </button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                 <div className="space-y-5 max-w-3xl">
                  {editBuffer && Object.keys(editBuffer).map(key => {
                      if (key === 'id') return <div key={key} className="text-xs text-muted-foreground font-mono bg-black/10 inline-block px-2 py-1 rounded">ID: {editBuffer[key]}</div>;
                      
                      // Arrays/Relations
                      if (Array.isArray(editBuffer[key])) {
                          return (
                             <div key={key}>
                                <label className="block text-sm font-semibold mb-1.5 text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</label>
                                <div className="flex flex-wrap mt-2">
                                  {editBuffer[key].map((relId: string) => {
                                      let relType = "skill";
                                      let name = relId;
                                      
                                      const skill = entities.skills?.find((s: any) => s.id === relId);
                                      if (skill) {
                                          relType = "skill";
                                          name = skill.name;
                                      } else {
                                          const proj = entities.projects?.find((p: any) => p.id === relId);
                                          if (proj) {
                                              relType = "project";
                                              name = proj.repo_name;
                                          }
                                      }
                                      
                                      return (
                                        <RelationChip
                                          key={relId}
                                          id={relId}
                                          type={relType as any}
                                          label={name}
                                          onClick={(t, id) => setSelectedEntity({type: t, id})}
                                        />
                                      );
                                  })}
                                </div>
                             </div>
                          )
                      }
                      
                      // Text areas for long text
                      if (typeof editBuffer[key] === "string" && editBuffer[key].length > 60) {
                          return (
                             <div key={key}>
                                <label className="block text-sm font-semibold mb-1.5 text-foreground capitalize">{key.replace(/_/g, ' ')}</label>
                                <textarea rows={6} className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-y custom-scrollbar transition-all" value={editBuffer[key] || ""} onChange={(e) => setEditBuffer({...editBuffer, [key]: e.target.value})} />
                             </div>
                          )
                      }
                      
                      // Standard Inputs
                      return (
                         <div key={key}>
                            <label className="block text-sm font-semibold mb-1.5 text-foreground capitalize">{key.replace(/_/g, ' ')}</label>
                            <input type="text" className="w-full bg-background border border-border rounded-lg p-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all" value={editBuffer[key] || ""} onChange={(e) => setEditBuffer({...editBuffer, [key]: e.target.value})} />
                         </div>
                      )
                  })}
                  {selectedEntity.type === 'skill' && (
                    <div className="pt-6 mt-6 border-t border-border/40">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                        Used In
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {entities?.experiences
                          ?.filter((e: any) => e.skills?.includes(selectedEntity.id))
                          .map((e: any) => (
                            <RelationChip
                               key={`exp-${e.id}`}
                               id={e.id}
                               type="experience"
                               label={e.company ? `${e.company} - ${e.role}` : e.role || e.id}
                               onClick={(t, id) => setSelectedEntity({type: t, id})}
                            />
                          ))
                        }
                        {entities?.projects
                          ?.filter((p: any) => p.skills?.includes(selectedEntity.id))
                          .map((p: any) => (
                            <RelationChip
                               key={`proj-${p.id}`}
                               id={p.id}
                               type="project"
                               label={p.repo_name || p.id}
                               onClick={(t, id) => setSelectedEntity({type: t, id})}
                            />
                          ))
                        }
                        {(!entities?.experiences?.some((e: any) => e.skills?.includes(selectedEntity.id)) && 
                          !entities?.projects?.some((p: any) => p.skills?.includes(selectedEntity.id))) && (
                            <span className="text-xs text-muted-foreground italic">No projects or experiences linked.</span>
                        )}
                      </div>
                    </div>
                  )}
                 </div>
              </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
