import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import { GeminiInference } from "../ai/GeminiInference";
import { dbOps } from "../db/indexedDB";
import { fetchEntities } from "../actions/pipelineActions";
import { useProfileStore } from "../store/useProfileStore";

export function EntityRefinerChat({ 
  entityType, 
  entityData, 
  onClose 
}: { 
  entityType: "experience" | "project" | "education", 
  entityData: any, 
  onClose: () => void 
}) {
  const [messages, setMessages] = useState<{role: "user" | "assistant" | "system", content: string}[]>([
    {
      role: "assistant", 
      content: `I am your AI Editor. Tell me what needs to be changed, added, or removed regarding this **${entityType}**. I will update its structure safely.`
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEntityState, setCurrentEntityState] = useState(entityData);
  const { cloudTier } = useProfileStore();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsProcessing(true);

    const modelParams = cloudTier === "smart" ? "gemini-pro-latest" : "gemini-flash-latest";

    try {
      const historyStr = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
      const systemPrompt = `You are an AI Curriculum Editor. You are currently refining a single entity of type "${entityType}".
Current Entity JSON state:
\`\`\`json
${JSON.stringify(currentEntityState, null, 2)}
\`\`\`

The user will provide instructions to modify, clarify, or expand this entity.
Your response MUST consist of two parts:
1. A brief, conversational confirmation of what you changed (no JSON).
2. The EXACT updated JSON block at the very end of your response, starting with "UPDATED_JSON:" followed by the raw JSON object matching the current schema perfectly. Do NOT wrap it in markdown code blocks, just raw JSON.

Example Response:
I've updated the dates and added the new keyword to the description!
UPDATED_JSON:{"id":"...","company":"...","start_date":"..."}`;

      const fullPrompt = `${systemPrompt}\n\nChat History:\n${historyStr}\n\nUSER: ${userMsg}\nASSISTANT:`;
      const aiResponse = await GeminiInference.generate(fullPrompt, "text", modelParams);

      const splitKeyword = "UPDATED_JSON:";
      const parts = aiResponse.split(splitKeyword);
      
      const conversationalText = parts[0].trim();
      let updatedJsonStr = parts[1] ? parts[1].trim() : null;
      
      let parsedEntity = { ...currentEntityState };
      if (updatedJsonStr) {
         try {
           // Cleanup potential markdown formatting if LLM hallucinated it
           updatedJsonStr = updatedJsonStr.replace(/```json/g, "").replace(/```/g, "").trim();
           parsedEntity = JSON.parse(updatedJsonStr);
           setCurrentEntityState(parsedEntity);
           
           // Automatically save to DB
           if (entityType === "experience") await dbOps.saveExperience(parsedEntity);
           if (entityType === "project") await dbOps.saveProject(parsedEntity);
           if (entityType === "education") await dbOps.saveEducation(parsedEntity);
           await fetchEntities(); // Refresh global store
         } catch(e) {
           console.warn("Failed to parse updated entity json", e);
         }
      }

      setMessages(prev => [...prev, { role: "assistant", content: conversationalText }]);

    } catch(e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error attempting to process that instruction." }]);
    }
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="p-4 bg-muted/20 border-b border-border/40 shrink-0 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-primary/20 hover:text-primary">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h3 className="font-bold text-sm text-primary flex items-center capitalize">
            Refining {entityType}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {currentEntityState.company || currentEntityState.repo_name || currentEntityState.school}
          </p>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-transparent relative">
        {/* State Preview (Readonly Visualization) */}
        <div className="p-3 bg-card border-b border-border/50 shrink-0">
           <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Live Entity State</Label>
           <div className="bg-muted/30 p-2 rounded-lg border border-border/50 max-h-[150px] overflow-y-auto custom-scrollbar">
             <pre className="text-[10px] font-mono text-primary/80 whitespace-pre-wrap">{JSON.stringify(currentEntityState, null, 2)}</pre>
           </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`p-3 rounded-2xl max-w-[90%] text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/50 border border-border/50 rounded-tl-sm'}`}>
                  {m.content}
               </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-muted/50 border border-border/50 p-3 rounded-2xl rounded-tl-sm flex items-center items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> <span className="text-xs text-muted-foreground">Editor is drafting...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-card/50 border-t border-border/50 shrink-0 relative">
          <Textarea 
             className="w-full min-h-[50px] max-h-[120px] bg-background border-border/50 resize-y rounded-xl py-3 pl-3 pr-12 text-sm custom-scrollbar"
             placeholder="E.g. Change my end date to Present, or 'Add Python to skills'"
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                   e.preventDefault();
                   handleSend();
                }
             }}
          />
          <Button 
            size="icon" 
            disabled={!input.trim() || isProcessing}
            onClick={handleSend}
            className="absolute right-6 top-6 h-8 w-8 rounded-lg"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
