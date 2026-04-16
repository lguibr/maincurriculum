import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, FolderGit2, Send, Bot, User, Edit3, Eye, RefreshCw } from "lucide-react";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export default function Improve() {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [extendedCv, setExtendedCv] = useState("");
  const [draftMode, setDraftMode] = useState<"preview" | "edit">("preview");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentActionMsg, setCurrentActionMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`http://${window.location.hostname}:3001/api/profile/latest`)
      .then(r => r.json())
      .then(d => { 
        if (d && d.id) {
          setProfileId(d.id);
          setExtendedCv(d.extended_cv || d.base_cv || "");
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
     endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentActionMsg]);

  const sendChatMessage = async () => {
      if (!inputMsg.trim() || isRunning) return;
      const userTxt = inputMsg;
      setInputMsg("");
      setMessages(prev => [...prev, { role: "user", content: userTxt }]);
      
      startAgentFlow(userTxt, extendedCv);
  };

  const startAgentFlow = async (messageText: string = "", currentCvContent: string = "") => {
    setIsRunning(true);
    setCurrentActionMsg("Connecting to Master CV Agent...");
    
    try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/improver/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: messageText, extendedCv: currentCvContent })
        });
        
        let aiFullText = "";
        
        // Setup SSE connection to listen for stream events on the backend
        // Note: the backend uses SSE but the POST request above triggers the streamEvents via a global context, wait...
        // Actually earlier I added SSE to the POST endpoint! Let's read it here
        if (!res.ok) throw new Error("Failed to start agent");
    } catch(e) {
        console.error(e);
        setIsRunning(false);
    }
  }

  // The actual POST in server.ts streams events. But `fetch` doesn't automatically parse SSE. 
  // Let's implement fetch streaming reader.
  const executeAgentStreaming = async (messageText: string = "", currentCvContent: string = "") => {
        setIsRunning(true);
        setCurrentActionMsg("Connecting to Master CV Agent...");
        let aiResponseContent = "";

        setMessages(prev => [...prev, { role: "assistant", content: "" }]);

        try {
            const response = await fetch(`http://${window.location.hostname}:3001/api/improver/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: messageText, extendedCv: currentCvContent })
            });

            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                buffer = lines.pop() || ""; // keep incomplete chunk in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (!dataStr) continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            
                            if (parsed.type === "log" && parsed.message) {
                                setCurrentActionMsg(parsed.message);
                            }
                            
                            if (parsed.type === "token") {
                                aiResponseContent += parsed.message;
                                setMessages(prev => {
                                    const copy = [...prev];
                                    copy[copy.length - 1].content = aiResponseContent;
                                    return copy;
                                });
                            }
                            
                            if (parsed.type === "langgraph_event") {
                               const ev = parsed.payload;
                               if (ev.event === "on_chain_end" && ev.name === "Draft_CV") {
                                   if (ev.data?.output?.workingExtendedCv) {
                                       setExtendedCv(ev.data.output.workingExtendedCv);
                                   }
                               } else if (ev.event === "on_chain_end" && ev.name === "Consolidate_Feedback") {
                                   if (ev.data?.output?.workingExtendedCv) {
                                       setExtendedCv(ev.data.output.workingExtendedCv);
                                   }
                               }
                            }

                            if (parsed.type === "complete") {
                                setIsRunning(false);
                                setCurrentActionMsg("");
                            }
                        } catch (err) {
                            console.error("Parse error", dataStr, err);
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error(e);
            setIsRunning(false);
            setCurrentActionMsg("Error: " + e.message);
        }
  }

  const handleSend = () => {
     if (!inputMsg.trim() || isRunning) return;
     const m = inputMsg;
     setInputMsg("");
     setMessages(prev => [...prev, { role: "user", content: m }]);
     executeAgentStreaming(m, extendedCv);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden gap-4 print:p-0 print:h-auto print:overflow-visible print:block bg-background">
      <div className="flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-blue-500 font-bold text-lg">
             <FolderGit2 className="w-5 h-5" /> Master CV Agent Canvas
          </div>
          <button 
            onClick={() => executeAgentStreaming("Review my entire CV layout again.", extendedCv)}
            disabled={isRunning || !profileId}
            className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 disabled:opacity-50 font-semibold rounded shadow transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Trigger Automated SOTA Critics
          </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-4 print:block">
          
          {/* LEFT: Chat Window */}
          <div className="w-[35%] flex flex-col bg-card border border-border/50 rounded-xl shadow-lg relative print:hidden">
             <div className="h-12 border-b border-border/50 flex items-center px-4 font-semibold text-sm justify-between">
                <span>Improver Chat</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {messages.length === 0 && (
                     <div className="text-center text-muted-foreground mt-10 text-sm">
                         I am the SOTA Improver.<br/>Ask me to rewrite sections, tweak tone, add skills, block lies, or expand experiences using your github repos!
                     </div>
                 )}
                 {messages.map((m, i) => (
                     <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[85%] rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-blue-600/20 text-blue-100' : 'bg-muted/30 text-foreground'}`}>
                             <div className="flex items-center gap-2 mb-1 opacity-70 border-b border-border/30 pb-1">
                                 {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                                 <span className="text-xs uppercase font-bold">{m.role}</span>
                             </div>
                             <div className="prose prose-sm prose-invert">
                                 <ReactMarkdown>{m.content}</ReactMarkdown>
                             </div>
                         </div>
                     </div>
                 ))}
                 
                 {isRunning && currentActionMsg && (
                    <div className="flex justify-start">
                        <div className="max-w-[85%] rounded p-2 text-xs bg-muted/20 text-blue-300 font-mono flex items-center gap-2 border border-blue-500/20">
                            <Loader2 className="w-3 h-3 animate-spin"/> {currentActionMsg}
                        </div>
                    </div>
                 )}
                 <div ref={endRef} />
             </div>
             <div className="p-3 border-t border-border/50 bg-muted/10">
                 <div className="relative">
                     <textarea 
                        value={inputMsg}
                        onChange={e => setInputMsg(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="w-full bg-background border border-border/50 rounded-lg pr-12 pl-3 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Instruct the CV agent..."
                        rows={2}
                     />
                     <button 
                         onClick={handleSend}
                         disabled={isRunning || !inputMsg.trim()}
                         className="absolute right-2 bottom-3 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-muted text-white rounded transition"
                     >
                         <Send className="w-4 h-4"/>
                     </button>
                 </div>
             </div>
          </div>

          {/* RIGHT: Document Canvas */}
          <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl relative print:border-none print:shadow-none print:bg-white print:overflow-visible print:block">
            <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 font-semibold text-sm justify-between print:hidden">
               <div className="flex items-center gap-2">
                   <button 
                       onClick={() => setDraftMode("preview")} 
                       className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${draftMode === 'preview' ? 'bg-blue-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                       <Eye className="w-4 h-4"/> Preview
                   </button>
                   <button 
                       onClick={() => setDraftMode("edit")} 
                       className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${draftMode === 'edit' ? 'bg-orange-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
                    >
                       <Edit3 className="w-4 h-4"/> Manual Edit
                   </button>
               </div>
               <div className="flex items-center gap-2">
               {extendedCv && (
                 <button 
                   onClick={async () => {
                     if(!profileId) return;
                     await fetch(`http://${window.location.hostname}:3001/api/profile/${profileId}/extended`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ extended_cv: extendedCv })
                     });
                     alert("Master CV permanently updated in DB!");
                   }}
                   className="px-4 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded text-xs font-bold transition"
                 >
                    Persist to DB
                 </button>
               )}
               {extendedCv && (
                 <button onClick={() => window.print()} className="px-4 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded text-xs transition">
                    Export PDF
                 </button>
               )}
               </div>
            </div>
            
            <div className="flex-1 min-h-0 relative">
                {draftMode === "preview" ? (
                   <div className="absolute inset-0 p-8 overflow-y-auto w-full max-w-none prose prose-sm prose-invert prose-blue print:p-0 print:h-auto print:overflow-visible">
                     {extendedCv ? (
                       <ReactMarkdown>{extendedCv}</ReactMarkdown>
                     ) : (
                       <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground/50">
                          CV Empty. Chat with the agent or type text manually.
                       </div>
                     )}
                   </div>
                ) : (
                   <textarea
                       className="absolute inset-0 w-full h-full bg-background/50 p-6 font-mono text-sm resize-none focus:outline-none"
                       value={extendedCv}
                       onChange={e => setExtendedCv(e.target.value)}
                   />
                )}
            </div>
          </div>

      </div>
    </div>
  );
}
