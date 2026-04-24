import { ChevronRight, Edit3, Library, X } from "lucide-react";
import { deleteEntity } from "../../actions/pipelineActions";

interface ProjectsCardProps {
  projects: any[];
  activeSkill: string | null;
  setRefiningEntity: (data: { type: "project"; data: any }) => void;
}

export function ProjectsCard({ projects, activeSkill, setRefiningEntity }: ProjectsCardProps) {
  return (
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
          const hasActiveSkill = activeSkill
            ? proj.skills?.some((s: any) => s.name === activeSkill)
            : true;
          return (
            <div
              key={proj.id}
              className={`relative p-5 rounded-xl border bg-card/30 hover:bg-card/50 border-border/50 transition-colors group ${!hasActiveSkill ? "opacity-30" : ""}`}
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
          );
        })}
        {projects.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No relevant projects extracted.</span>
        )}
      </div>
    </section>
  );
}
