import { Code, X } from "lucide-react";
import { deleteEntity } from "../../actions/pipelineActions";

interface SkillsCardProps {
  skills: any[];
  activeSkill: string | null;
  setActiveSkill: (s: string | null) => void;
}

export function SkillsCard({ skills, activeSkill, setActiveSkill }: SkillsCardProps) {
  return (
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
  );
}
