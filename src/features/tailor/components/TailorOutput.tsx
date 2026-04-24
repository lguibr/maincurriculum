import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TailorOutputProps {
  activeTab: "cv" | "letter" | "qa";
  setActiveTab: (val: "cv" | "letter" | "qa") => void;
  hasOutput: boolean;
  getActiveContent: () => string;
}

export function TailorOutput({
  activeTab,
  setActiveTab,
  hasOutput,
  getActiveContent,
}: TailorOutputProps) {
  return (
    <Card className="w-2/3 flex flex-col relative h-full print:w-full print:h-auto print:block border-border/40 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="h-full flex flex-col"
      >
        <div className="flex justify-between items-center p-2 border-b border-border/40 bg-background/60 print:hidden">
          <TabsList className="bg-background/50">
            <TabsTrigger value="cv">Tailored CV</TabsTrigger>
            <TabsTrigger value="letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="qa">Form Answers</TabsTrigger>
          </TabsList>
          {hasOutput && (
            <Button
              onClick={() => window.print()}
              variant="secondary"
              className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 font-bold"
            >
              Export PDF
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative print:overflow-visible print:block bg-transparent top-pane-hack">
          <ScrollArea className="h-full w-full print:h-auto">
            <div className="p-8 max-w-none prose prose-invert prose-emerald print:h-auto print:overflow-visible print:p-0 text-foreground">
              {hasOutput ? (
                <ReactMarkdown>{getActiveContent()}</ReactMarkdown>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center opacity-30 mt-20 pointer-events-none">
                  <div className="h-8 bg-muted rounded w-1/3 mb-6" />
                  <div className="h-4 bg-muted rounded w-full mb-3" />
                  <div className="h-4 bg-muted rounded w-5/6 mb-8" />
                  <div className="h-32 bg-muted rounded-xl w-full" />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </Tabs>
    </Card>
  );
}
