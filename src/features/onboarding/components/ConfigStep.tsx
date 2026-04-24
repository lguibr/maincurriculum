import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/ui/Logo";

interface ConfigStepProps {
  githubUsername: string;
  setGithubUsername: (val: string) => void;

  isFetchingRepos: boolean;
  handleFetchRepos: () => void;
  githubToken: string;
  setGithubToken: (val: string) => void;
  geminiToken: string;
  setGeminiToken: (val: string) => void;
}

export function ConfigStep({
  githubUsername,
  setGithubUsername,

  isFetchingRepos,
  handleFetchRepos,
  githubToken,
  setGithubToken,
  geminiToken,
  setGeminiToken,
}: ConfigStepProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent text-[#f1f3fc] relative rounded-b-2xl">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]"></div>

      <div className="relative p-10 flex flex-col items-center justify-center h-full max-w-2xl mx-auto w-full text-center">
        <Logo
          alt="Logo"
          className="h-24 w-auto object-contain mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        />
        <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">Repository Ingestion</h1>
        <p className="text-[#a1a1aa] font-mono text-sm tracking-wide mb-10">
          Enter a GitHub handle to fetch projects for the AI embedding sequence.
        </p>

        <div className="flex flex-col w-full items-center gap-3">
          <div className="flex w-full items-center gap-3">
            <Input
              className="h-14 bg-[#18181b] border border-[#27272a] focus-visible:border-[#0070eb] focus-visible:ring-0 text-center text-lg rounded-xl text-white font-mono placeholder:text-[#52525b]"
              placeholder="github_username"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore="true"
            />
            <Button
              onClick={handleFetchRepos}
              disabled={isFetchingRepos || !githubUsername}
              className="h-14 px-8 bg-white text-black hover:bg-gray-200 rounded-xl transition-all font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)]"
            >
              {isFetchingRepos ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch"}
            </Button>
          </div>

          <div className="flex flex-col w-full gap-4 mt-6">


            <Input
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              data-1p-ignore="true"
              placeholder="GitHub API Token (Optional, avoids rate limits)"
              className="h-12 bg-[#18181b] border border-[#27272a] text-sm rounded-xl text-[#a1a1aa] font-mono placeholder:text-[#52525b] focus-visible:border-[#0070eb] focus-visible:ring-1"
              value={githubToken}
              onChange={(e) => {
                setGithubToken(e.target.value);
                localStorage.setItem("GITHUB_TOKEN", e.target.value);
              }}
            />
            <Input
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              data-1p-ignore="true"
              placeholder="Gemini API Token (Required for Execution)"
              className={`h-12 bg-[#18181b] border ${!geminiToken ? "border-red-500/50 focus-visible:border-red-500/50" : "border-[#27272a] focus-visible:border-[#0070eb]"} text-sm rounded-xl text-[#a1a1aa] font-mono placeholder:text-[#52525b] focus-visible:ring-1`}
              value={geminiToken}
              onChange={(e) => {
                setGeminiToken(e.target.value);
                localStorage.setItem("GEMINI_API_KEY", e.target.value);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
