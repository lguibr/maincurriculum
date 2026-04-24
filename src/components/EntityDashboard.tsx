import React, { useEffect, useState } from "react";
import { useEntityStore } from "../store/useEntityStore";
import { fetchEntities, deleteEntity } from "../actions/pipelineActions";
import { X, Briefcase, Code, Database, Library, Calendar, ChevronRight, GraduationCap, Edit3 } from "lucide-react";
import { EntityRefinerChat } from "./EntityRefinerChat";

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
        {/* Skills Section */}
        <section>
          <h4 className="font-bold text-sm text-foreground/80 flex items-center mb-4 uppercase tracking-wider">
            <Code className="w-4 h-4 mr-2" />
            Detected Skills & Technologies
            <span className="ml-3 bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {skills.length} isolated
            </span>
          </h4>

          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => setActiveSkill(activeSkill === skill.name ? null : skill.name)}
                className={`group relative flex items-center bg-card border hover:border-primary shadow-sm rounded-full pl-3 pr-1 py-1 transition-all cursor-pointer ${activeSkill === skill.name ? "border-primary bg-primary/20 ring-2 ring-primary/50" : "border-border"}`}
              >
                <span className="text-sm font-medium mr-2">{skill.name}</span>
                <span className="text-[10px] text-muted-foreground mr-2 capitalize">
                  ({skill.type})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEntity("skill", skill.id);
                  }}
                  className="bg-destructive/10 hover:bg-destructive/80 text-destructive hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {skills.length === 0 && (
              <span className="text-xs text-muted-foreground italic">No skills extracted yet.</span>
            )}
          </div>
        </section>

        {/* Experiences Section */}
        <section>
          <h4 className="font-bold text-sm text-foreground/80 flex items-center mb-4 uppercase tracking-wider">
            <Briefcase className="w-4 h-4 mr-2" />
            Timeline Experiences
            <span className="ml-3 bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {experiences.length} extracted
            </span>
          </h4>

          <div className="space-y-4">
            {experiences.map((exp) => {
              const hasActiveSkill = activeSkill ? exp.skills?.some((s: any) => s.name === activeSkill) : true;
              return (
              <div
                key={exp.id}
                className={`relative p-5 rounded-xl border bg-card/50 hover:bg-card border-border/50 transition-colors group ${!hasActiveSkill ? 'opacity-30' : ''}`}
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setRefiningEntity({ type: "experience", data: exp })}
                    className="text-muted-foreground hover:text-primary transition-all p-1"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteEntity("experience", exp.id)}
                    className="text-muted-foreground hover:text-destructive transition-all p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-start mb-2 pr-12">
                  <div>
                    <h5 className="font-bold text-base text-foreground">{exp.role}</h5>
                    <p className="text-sm text-primary font-medium">{exp.company}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center whitespace-nowrap bg-muted/40 px-2 py-1 rounded-md">
                    <Calendar className="w-3 h-3 mr-1.5" />
                    {exp.start_date} - {exp.end_date}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3 border-l-2 border-primary/30 pl-3">
                  {exp.description}
                </p>
                {exp.skills && exp.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {exp.skills.map((s: any) => (
                      <span
                        key={s.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${activeSkill === s.name ? "bg-primary text-white border-primary" : "bg-primary/10 text-primary border-primary/20"}`}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )})}
            {experiences.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                No experiences extracted yet.
              </span>
            )}
          </div>
        </section>

        {/* Projects Section */}
        <section>
          <h4 className="font-bold text-sm text-foreground/80 flex items-center mb-4 uppercase tracking-wider">
            <Library className="w-4 h-4 mr-2" />
            Analyzed Repositories
            <span className="ml-3 bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {projects.length} mapped
            </span>
          </h4>

          <div className="space-y-4">
            {projects.map((proj) => {
              const hasActiveSkill = activeSkill ? proj.skills?.some((s: any) => s.name === activeSkill) : true;
              return (
              <div
                key={proj.id}
                className={`relative p-5 rounded-xl border bg-card/30 hover:bg-card/50 border-border/50 transition-colors group ${!hasActiveSkill ? 'opacity-30' : ''}`}
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setRefiningEntity({ type: "project", data: proj })}
                    className="text-muted-foreground hover:text-primary transition-all p-1"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteEntity("project", proj.id)}
                    className="text-muted-foreground hover:text-destructive transition-all p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-start mb-2 pr-12">
                  <h5 className="font-bold text-base text-foreground flex items-center">
                    <ChevronRight className="w-4 h-4 text-primary mr-1" /> {proj.repo_name}
                  </h5>
                </div>
                {proj.raw_text && (
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-3">
                    {proj.raw_text}
                  </p>
                )}
                {proj.skills && proj.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {proj.skills.map((s: any) => (
                      <span
                        key={s.id}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${activeSkill === s.name ? "bg-primary text-white border-primary" : "bg-primary/10 text-primary border-primary/20"}`}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )})}
            {projects.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                No relevant projects extracted.
              </span>
            )}
          </div>
        </section>

        {/* Education Section */}
        <section>
          <h4 className="font-bold text-sm text-foreground/80 flex items-center mb-4 uppercase tracking-wider">
            <GraduationCap className="w-4 h-4 mr-2" />
            Academic Education
            <span className="ml-3 bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {educations.length} mapped
            </span>
          </h4>

          <div className="space-y-4">
            {educations.map((edu) => (
              <div
                key={edu.id}
                className="relative p-5 rounded-xl border bg-card/50 hover:bg-card border-border/50 transition-colors group"
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setRefiningEntity({ type: "education", data: edu })}
                    className="text-muted-foreground hover:text-primary transition-all p-1"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteEntity("education", edu.id)}
                    className="text-muted-foreground hover:text-destructive transition-all p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-start mb-2 pr-12">
                  <div>
                    <h5 className="font-bold text-base text-foreground">{edu.degree}</h5>
                    <p className="text-sm text-primary font-medium">{edu.school}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center whitespace-nowrap bg-muted/40 px-2 py-1 rounded-md">
                    <Calendar className="w-3 h-3 mr-1.5" />
                    {edu.start_date} - {edu.end_date}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3 border-l-2 border-primary/30 pl-3">
                  {edu.description}
                </p>
              </div>
            ))}
            {educations.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                No education extracted yet.
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
