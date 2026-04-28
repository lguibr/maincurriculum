import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X, MessageSquare, PanelRightClose } from "lucide-react";
import { MermaidChart } from "../../timeline/components/MermaidChart";
import { TailorChat, ChatMessage } from "./TailorChat";

interface TailorOutputProps {
  activeTab: "cv" | "letter" | "qa";
  setActiveTab: (val: "cv" | "letter" | "qa") => void;
  hasOutput: boolean;
  getActiveContent: () => string;
  onRefine?: (instruction: string) => Promise<void>;
  isRefining?: boolean;
  onManualSave?: (content: string) => Promise<void>;
  pdfFilename?: string;
  fitDiagram?: string;
  chatMessages?: ChatMessage[];
}

export function TailorOutput({
  activeTab,
  setActiveTab,
  hasOutput,
  getActiveContent,
  onRefine,
  isRefining,
  onManualSave,
  pdfFilename,
  fitDiagram,
  chatMessages = [],
}: TailorOutputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    if (!isEditing) {
      setEditText(getActiveContent());
    }
  }, [activeTab, getActiveContent, isEditing]);

  const handleExportPdf = () => {
    const originalTitle = document.title;
    if (pdfFilename) document.title = pdfFilename;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  const handleSaveEdit = () => {
    if (onManualSave) {
      onManualSave(editText);
      setIsEditing(false);
    }
  };

  const activeTabName = activeTab === 'cv' ? 'CV' : activeTab === 'letter' ? 'Cover Letter' : 'Form Answers';

  return (
    <Card className="w-2/3 flex flex-col relative h-full print:w-full print:h-auto print:block border-border/40 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="h-full flex flex-col"
      >
        <div className="flex justify-between items-center p-2 border-b border-border/40 bg-background/60 print:hidden shrink-0">
          <TabsList className="bg-background/50">
            <TabsTrigger value="cv">CV</TabsTrigger>
            <TabsTrigger value="letter">Cover Letter</TabsTrigger>
            <TabsTrigger value="qa">Form Answers</TabsTrigger>
          </TabsList>
          {hasOutput && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                  >
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    variant="secondary"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500 font-bold"
                  >
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit className="w-4 h-4 mr-1" /> Edit
                </Button>
              )}
              {!isEditing && (
                <Button
                  onClick={() => setShowChat(!showChat)}
                  variant="ghost"
                  size="sm"
                  className={`text-muted-foreground hover:text-foreground ${showChat ? 'bg-muted/50' : ''}`}
                >
                  {showChat ? <PanelRightClose className="w-4 h-4 mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
                  {showChat ? 'Hide Chat' : 'Refine'}
                </Button>
              )}
              <Button
                onClick={handleExportPdf}
                variant="secondary"
                size="sm"
                className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 font-bold ml-2"
              >
                Export PDF
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden relative print:overflow-visible print:block bg-transparent flex flex-row">
          <div className={`flex-1 overflow-hidden relative transition-all duration-300 print:w-full ${showChat && !isEditing && hasOutput ? 'w-2/3 border-r border-border/40' : 'w-full'}`}>
            {isEditing ? (
              <div className="h-full w-full p-4 print:hidden">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full h-full min-h-[500px] font-mono text-sm bg-background/50 border-border/40 focus-visible:ring-emerald-500/50 resize-none"
                />
              </div>
            ) : (
              <ScrollArea className="h-full w-full print:h-auto">
                <div className="p-8 max-w-none prose prose-invert prose-emerald print:h-auto print:overflow-visible print:p-0 text-foreground">
                  {hasOutput ? (
                    <>
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            if (!inline && match && match[1] === "mermaid") {
                              return <MermaidChart chart={String(children).replace(/\n$/, "")} />;
                            }
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {getActiveContent()}
                      </ReactMarkdown>
                      {activeTab === "cv" && fitDiagram && (
                        <div className="mt-8 break-inside-avoid">
                          <h3 className="text-xl font-bold mb-4">Skill Mapping & Fit Analysis</h3>
                          <MermaidChart chart={fitDiagram} />
                        </div>
                      )}
                    </>
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
            )}
          </div>
          
          {/* Chat Panel */}
          {showChat && !isEditing && hasOutput && onRefine && (
            <div className="w-1/3 h-full min-w-[300px] print:hidden">
              <TailorChat 
                messages={chatMessages} 
                isRefining={!!isRefining} 
                onSendMessage={onRefine} 
                activeTabName={activeTabName} 
              />
            </div>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
