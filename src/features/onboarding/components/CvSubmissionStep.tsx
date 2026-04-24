import { FileCode, Play } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CvSubmissionStepProps {
  baseCv: string;
  setBaseCv: (cv: string) => void;
  handleSubmitCV: () => void;
}

export function CvSubmissionStep({ baseCv, setBaseCv, handleSubmitCV }: CvSubmissionStepProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent relative w-full h-full">
      <div className="absolute top-0 w-full z-10 flex justify-between items-center px-4 py-2 bg-background/60 border-b border-[#3c3c3c] shadow-lg backdrop-blur-md">
        <Label className="text-[10px] text-gray-400 font-mono tracking-widest flex items-center">
          <FileCode className="w-3 h-3 mr-2" /> BASE_CV.md
        </Label>
      </div>
      <div className="flex-1 mt-10 relative">
        <Editor
          wrapperProps={{ className: "absolute inset-0" }}
          height="100%"
          width="100%"
          defaultLanguage="markdown"
          theme="vs-dark"
          value={baseCv}
          onChange={(val) => setBaseCv(val || "")}
          options={{ minimap: { enabled: false }, padding: { top: 16 } }}
        />
      </div>
      <div className="p-4 bg-muted/10 shrink-0 border-t border-border/50">
        <Button
          onClick={handleSubmitCV}
          className="w-full h-12 text-base font-bold tracking-wide shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
        >
          <Play className="w-5 h-5 mr-2" /> Submit Resume for Alignment
        </Button>
      </div>
    </div>
  );
}
