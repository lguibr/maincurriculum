import { Calendar, Edit3, GraduationCap, X } from "lucide-react";
import { deleteEntity } from "../../actions/pipelineActions";

interface EducationsCardProps {
  educations: any[];
  setRefiningEntity: (data: { type: "education"; data: any }) => void;
}

export function EducationsCard({ educations, setRefiningEntity }: EducationsCardProps) {
  return (
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
          <span className="text-xs text-muted-foreground italic">No education extracted yet.</span>
        )}
      </div>
    </section>
  );
}
