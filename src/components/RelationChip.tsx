import { Code2, Briefcase, Database, GraduationCap } from "lucide-react";

interface RelationChipProps {
  id: string;
  type: "skill" | "project" | "experience" | "education";
  label: string;
  onClick: (type: "skill" | "project" | "experience" | "education", id: string) => void;
}

export function RelationChip({ id, type, label, onClick }: RelationChipProps) {
  const getIcon = () => {
    switch (type) {
      case "skill":
        return <Code2 className="w-3.5 h-3.5 mr-1.5" />;
      case "experience":
        return <Briefcase className="w-3.5 h-3.5 mr-1.5" />;
      case "project":
        return <Database className="w-3.5 h-3.5 mr-1.5" />;
      case "education":
        return <GraduationCap className="w-3.5 h-3.5 mr-1.5" />;
      default:
        return null;
    }
  };

  return (
    <button
      onClick={() => onClick(type, id)}
      className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-full text-xs font-medium transition-colors shadow-sm mr-2 mb-2"
    >
      {getIcon()}
      {label}
    </button>
  );
}
