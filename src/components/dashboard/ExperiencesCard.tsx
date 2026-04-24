import { Briefcase, Calendar, Edit3, X } from "lucide-react";
import { deleteEntity } from "../../actions/pipelineActions";

interface ExperiencesCardProps {
  experiences: any[];
  activeSkill: string | null;
  setRefiningEntity: (data: { type: "experience"; data: any }) => void;
}

export function ExperiencesCard({ experiences, activeSkill, setRefiningEntity }: ExperiencesCardProps) {
  return (
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
          const hasActiveSkill = activeSkill
            ? exp.skills?.some((s: any) => s.name === activeSkill)
            : true;
          return (
            <div
              key={exp.id}
              className={`relative p-5 rounded-xl border bg-card/50 hover:bg-card border-border/50 transition-colors group ${!hasActiveSkill ? "opacity-30" : ""}`}
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
          );
        })}
        {experiences.length === 0 && (
          <span className="text-xs text-muted-foreground italic">No experiences extracted yet.</span>
        )}
      </div>
    </section>
  );
}
