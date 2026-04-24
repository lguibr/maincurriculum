import { useState, useEffect } from "react";
import { Loader2, Database, Briefcase, GraduationCap, Code2, FolderTree } from "lucide-react";
import { dbOps } from "../db/indexedDB";
import { useEntityStore } from "../store/useEntityStore";
import { fetchEntities, deleteEntity } from "../actions/pipelineActions";

import { SidebarCategory } from "../features/memory/components/SidebarCategory";
import { EntityEditor } from "../features/memory/components/EntityEditor";
import { MemoryDashboard } from "../features/memory/components/MemoryDashboard";

export default function Memory() {
  const [memoryJson, setMemoryJson] = useState("{}");
  const [baseCv, setBaseCv] = useState("");
  const [extendedCv, setExtendedCv] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          <EntityEditor
            selectedEntity={selectedEntity}
            editBuffer={editBuffer}
            setEditBuffer={setEditBuffer}
            entities={entities}
            setSelectedEntity={setSelectedEntity}
            handleDeleteEntity={handleDeleteEntity}
            handleSaveEntity={handleSaveEntity}
          />
        ) : (
          <MemoryDashboard
            memoryJson={memoryJson}
            setMemoryJson={setMemoryJson}
            saving={saving}
            handleSaveJson={handleSaveJson}
            extendedCv={extendedCv}
          />
        )}
      </div>
    </div>
  );
}
