import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RepoSelectorProps {
  fetchedRepos: any[];
  selectedRepoUrls: string[];
  setSelectedRepoUrls: (urls: string[]) => void;
  geminiToken: string;
  handleStartIngestion: () => void;
}

export function RepoSelector({
  fetchedRepos,
  selectedRepoUrls,
  setSelectedRepoUrls,
  geminiToken,
  handleStartIngestion,
}: RepoSelectorProps) {
  return (
    <div className="relative p-8 flex flex-col overflow-hidden h-full max-w-6xl mx-auto w-full">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-end mb-4 border-b border-[#27272a] pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Select Repositories</h2>
            <Label className="text-sm text-[#a1a1aa] font-mono">
              Discovered {fetchedRepos.length} public and private projects.
            </Label>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-[#27272a] bg-[#18181b] text-[#d4d4d8] hover:text-white"
              onClick={() => setSelectedRepoUrls(fetchedRepos.map((r) => r.url))}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-[#27272a] bg-[#18181b] text-[#d4d4d8] hover:text-white"
              onClick={() => setSelectedRepoUrls([])}
            >
              Unselect All
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {fetchedRepos.map((repo) => (
            <div
              key={repo.url}
              className={`flex items-start space-x-4 p-4 rounded-xl border transition-all cursor-pointer ${selectedRepoUrls.includes(repo.url) ? "bg-[#18181b] border-white/20" : "bg-[#09090b] border-[#27272a] hover:border-[#3f3f46]"}`}
              onClick={() => {
                if (selectedRepoUrls.includes(repo.url))
                  setSelectedRepoUrls(selectedRepoUrls.filter((u) => u !== repo.url));
                else setSelectedRepoUrls([...selectedRepoUrls, repo.url]);
              }}
            >
              <Checkbox
                id={repo.url}
                checked={selectedRepoUrls.includes(repo.url)}
                className="mt-1 border-[#52525b] data-[state=checked]:bg-white data-[state=checked]:text-black"
                onCheckedChange={(c) => {
                  if (c) setSelectedRepoUrls([...selectedRepoUrls, repo.url]);
                  else setSelectedRepoUrls(selectedRepoUrls.filter((u) => u !== repo.url));
                }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold truncate font-mono">{repo.name}</h3>
                {repo.description && (
                  <p className="text-[#a1a1aa] text-sm mt-1.5 line-clamp-2">{repo.description}</p>
                )}
                <div className="text-[10px] text-[#52525b] mt-2 font-mono">{repo.url}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-6 shrink-0">
          <Button
            onClick={handleStartIngestion}
            disabled={selectedRepoUrls.length === 0 || !geminiToken}
            className={`w-full h-14 bg-white text-black hover:bg-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 ${!geminiToken ? "border border-red-500/50" : ""}`}
          >
            <BookOpen className="w-5 h-5" />
            {!geminiToken ? "Missing API Token" : `Initialize Sequence (${selectedRepoUrls.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
