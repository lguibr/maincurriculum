import React, { useEffect, useState } from "react";
import { useEntityStore } from "../store/useEntityStore";
import { fetchEntities } from "../actions/pipelineActions";
import { Database } from "lucide-react";
import { EntityRefinerChat } from "./EntityRefinerChat";

import { SkillsCard } from "./dashboard/SkillsCard";
import { ExperiencesCard } from "./dashboard/ExperiencesCard";
import { ProjectsCard } from "./dashboard/ProjectsCard";
import { EducationsCard } from "./dashboard/EducationsCard";

export function EntityDashboard() {
  const entities = useEntityStore((s) => s.entities);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [refiningEntity, setRefiningEntity] = useState<{type: "experience" | "project" | "education", data: any} | null>(null);

  useEffect(() => {
    fetchEntities();
  }, []);

  const experiences = entities?.experiences || [];
  const skills = entities?.skills || [];
  const projects = entities?.projects || [];
  const educations = entities?.educations || [];

  if (!entities) {
    return (
      <div className="p-4 text-sm text-muted-foreground animate-pulse">
        Loading architectural context...
      </div>
    );
  }

  if (refiningEntity) {
    return (
      <EntityRefinerChat 
         entityType={refiningEntity.type}
         entityData={refiningEntity.data}
         onClose={() => setRefiningEntity(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <div className="p-4 bg-muted/20 border-b border-border/40 shrink-0">
        <h3 className="font-bold text-lg text-primary flex items-center">
          <Database className="w-5 h-5 mr-2" /> Extracted Relational Profile
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Review the Skills and Work Experiences autonomously structured by the AI. Manage any
          hallucinated additions before extending your CV.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        <SkillsCard skills={skills} activeSkill={activeSkill} setActiveSkill={setActiveSkill} />
        <ExperiencesCard experiences={experiences} activeSkill={activeSkill} setRefiningEntity={setRefiningEntity} />
        <ProjectsCard projects={projects} activeSkill={activeSkill} setRefiningEntity={setRefiningEntity} />
        <EducationsCard educations={educations} setRefiningEntity={setRefiningEntity} />
      </div>
    </div>
  );
}
