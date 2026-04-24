import { Edit3, Save, Trash2, X } from "lucide-react";
import { RelationChip } from "@/components/RelationChip";

export function EntityEditor({
  selectedEntity,
  editBuffer,
  setEditBuffer,
  entities,
  setSelectedEntity,
  handleDeleteEntity,
  handleSaveEntity,
}: {
  selectedEntity: any;
  editBuffer: any;
  setEditBuffer: any;
  entities: any;
  setSelectedEntity: any;
  handleDeleteEntity: () => void;
  handleSaveEntity: () => void;
}) {
  return (
    <div className="flex-1 max-h-full m-0 bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
      <div className="h-16 px-6 border-b border-border/50 bg-muted/10 flex items-center justify-between shrink-0">
        <h2 className="text-xl tracking-tight font-bold flex items-center capitalize text-foreground">
          <Edit3 className="w-5 h-5 mr-3 text-primary" /> Edit {selectedEntity.type}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleDeleteEntity}
            className="h-9 px-4 bg-destructive/10 hover:bg-destructive/80 text-destructive hover:text-white rounded-lg transition-all flex items-center shadow-sm text-sm font-semibold"
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </button>
          <button
            onClick={handleSaveEntity}
            className="h-9 px-4 bg-primary hover:bg-primary/80 text-primary-foreground font-bold rounded-lg transition-all flex items-center shadow-sm text-sm"
          >
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </button>
          <button
            onClick={() => setSelectedEntity(null)}
            className="h-9 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all flex items-center text-sm font-medium"
          >
            <X className="w-4 h-4 mr-2" /> Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="space-y-5 max-w-3xl">
          {editBuffer &&
            Object.keys(editBuffer).map((key) => {
              if (key === "id")
                return (
                  <div
                    key={key}
                    className="text-xs text-muted-foreground font-mono bg-black/10 inline-block px-2 py-1 rounded"
                  >
                    ID: {editBuffer[key]}
                  </div>
                );

              // Arrays/Relations
              if (Array.isArray(editBuffer[key])) {
                return (
                  <div key={key}>
                    <label className="block text-sm font-semibold mb-1.5 text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </label>
                    <div className="flex flex-wrap mt-2">
                      {editBuffer[key].map((relIdRaw: any, idx: number) => {
                        let relType = "skill";
                        const actualId =
                          typeof relIdRaw === "object"
                            ? relIdRaw.id || relIdRaw.name || `obj-${idx}`
                            : String(relIdRaw);
                        let name =
                          typeof relIdRaw === "object" ? relIdRaw.name || actualId : actualId;

                        const skill = entities.skills?.find((s: any) => s.id === actualId);
                        if (skill) {
                          relType = "skill";
                          name = skill.name;
                        } else {
                          const proj = entities.projects?.find((p: any) => p.id === actualId);
                          if (proj) {
                            relType = "project";
                            name = proj.repo_name;
                          }
                        }

                        return (
                          <RelationChip
                            key={`${key}-${actualId}-${idx}`}
                            id={actualId}
                            type={relType as any}
                            label={String(name)}
                            onClick={(t, id) => setSelectedEntity({ type: t, id })}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Text areas for long text
              if (typeof editBuffer[key] === "string" && editBuffer[key].length > 60) {
                return (
                  <div key={key}>
                    <label className="block text-sm font-semibold mb-1.5 text-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </label>
                    <textarea
                      rows={6}
                      className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none resize-y custom-scrollbar transition-all"
                      value={editBuffer[key] || ""}
                      onChange={(e) => setEditBuffer({ ...editBuffer, [key]: e.target.value })}
                    />
                  </div>
                );
              }

              // Standard Inputs
              return (
                <div key={key}>
                  <label className="block text-sm font-semibold mb-1.5 text-foreground capitalize">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    value={editBuffer[key] || ""}
                    onChange={(e) => setEditBuffer({ ...editBuffer, [key]: e.target.value })}
                  />
                </div>
              );
            })}
          {selectedEntity.type === "skill" && (
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
                      onClick={(t, id) => setSelectedEntity({ type: t, id })}
                    />
                  ))}
                {entities?.projects
                  ?.filter((p: any) => p.skills?.includes(selectedEntity.id))
                  .map((p: any) => (
                    <RelationChip
                      key={`proj-${p.id}`}
                      id={p.id}
                      type="project"
                      label={p.repo_name || p.id}
                      onClick={(t, id) => setSelectedEntity({ type: t, id })}
                    />
                  ))}
                {!entities?.experiences?.some((e: any) => e.skills?.includes(selectedEntity.id)) &&
                  !entities?.projects?.some((p: any) => p.skills?.includes(selectedEntity.id)) && (
                    <span className="text-xs text-muted-foreground italic">
                      No projects or experiences linked.
                    </span>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
