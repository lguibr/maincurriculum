import { useState } from "react";
import { ChevronRight } from "lucide-react";

export function SidebarCategory({
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
        <span className="flex items-center">
          <Icon className="w-3.5 h-3.5 mr-2 opacity-70" /> {title} ({items.length})
        </span>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1">
          {items.map((item) => {
            const isSelected = selectedEntity?.id === item.id && selectedEntity?.type === type;
            const displayName = item.name || item.repo_name || item.role || item.degree || item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedEntity({ type, id: item.id })}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium truncate transition-colors flex items-center ${isSelected ? "bg-primary/20 text-primary" : "hover:bg-muted/50 text-foreground/80"}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isSelected ? "bg-primary" : "bg-transparent"}`} />
                {displayName}
              </button>
            );
          })}
        </div>
      )
      }
    </div >
  );
}
