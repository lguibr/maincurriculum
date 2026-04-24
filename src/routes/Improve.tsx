import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, FolderGit2, Send, Bot, User, Edit3, Eye, RefreshCw } from "lucide-react";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";
import { useProfileStore } from "../store/useProfileStore";
import { ImproveChat } from "../features/improve/components/ImproveChat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Improve() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [extendedCv, setExtendedCv] = useState("");
  const [draftMode, setDraftMode] = useState<"preview" | "edit">("preview");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentActionMsg, setCurrentActionMsg] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dbOps
      .getProfile("main")
      .then((d) => {
        if (d && d.id) {
          setProfileId(d.id);
          setExtendedCv(d.extended_cv || d.base_cv || "");
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentActionMsg]);

  const { cloudTier } = useProfileStore();

  const executeAgentCloud = async (messageText: string = "", currentCvContent: string = "") => {
    setIsRunning(true);
    setCurrentActionMsg("Connecting to Gemini 3...");

    setMessages((prev) => [...prev, { role: "assistant", content: "..." }]);

    try {
      setCurrentActionMsg("Drafting new CV...");

      const prompt = `You are an expert tech recruiter and CV Improver. The user asks: "${messageText}".
Here is the current CV draft. Rewrite and improve it based on their instructions, outputting ONLY the new CV draft. Do not add conversational text.
-- CV START --
${currentCvContent}
-- CV END --`;

      let improveModel = "gemini-pro-latest";
      if (cloudTier === "smart") improveModel = "gemini-pro-latest";
      if (cloudTier === "balanced") improveModel = "gemini-flash-latest";
      if (cloudTier === "widely") improveModel = "gemini-pro-latest";

      const response = await GeminiInference.generate(prompt, "text", improveModel);

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1].content = "✅ Generation Complete.";
        return copy;
      });

      setExtendedCv(response);
      setCurrentActionMsg("");
    } catch (e: any) {
      console.error(e);
      setCurrentActionMsg("Error: " + e.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSend = () => {
    if (!inputMsg.trim() || isRunning) return;
    const m = inputMsg;
    setInputMsg("");
    setMessages((prev) => [...prev, { role: "user", content: m }]);
    executeAgentCloud(m, extendedCv);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden gap-4 print:p-0 print:h-auto print:overflow-visible print:block bg-background">
      <div className="flex items-center justify-between shrink-0 print:hidden">
        <div className="flex items-center gap-2 text-blue-500 font-bold text-lg">
          <FolderGit2 className="w-5 h-5" /> Master CV Agent Canvas
        </div>
        <button
          onClick={() =>
            executeAgentCloud("Review my entire CV layout again. Improve vocabulary.", extendedCv)
          }
          disabled={isRunning || !profileId}
          className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 disabled:opacity-50 font-semibold rounded shadow transition-all flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Trigger Automated SOTA Critics
        </button>
      </div>

      <div className="flex-1 min-h-0 flex gap-4 print:block">
        {/* LEFT: Chat Window */}
        <ImproveChat
          messages={messages}
          isRunning={isRunning}
          currentActionMsg={currentActionMsg}
          endRef={endRef}
          inputMsg={inputMsg}
          setInputMsg={setInputMsg}
          handleSend={handleSend}
        />

        {/* RIGHT: Document Canvas */}
        <div className="flex-1 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xl relative print:border-none print:shadow-none print:bg-white print:overflow-visible print:block">
          <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 font-semibold text-sm justify-between print:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraftMode("preview")}
                className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${draftMode === "preview" ? "bg-blue-600 text-white" : "hover:bg-muted text-muted-foreground"}`}
              >
                <Eye className="w-4 h-4" /> Preview
              </button>
              <button
                onClick={() => setDraftMode("edit")}
                className={`px-3 py-1.5 rounded flex items-center gap-2 transition ${draftMode === "edit" ? "bg-orange-600 text-white" : "hover:bg-muted text-muted-foreground"}`}
              >
                <Edit3 className="w-4 h-4" /> Manual Edit
              </button>
            </div>
            <div className="flex items-center gap-2">
              {extendedCv && (
                <button
                  onClick={async () => {
                    if (!profileId) return;
                    const p = await dbOps.getProfile(profileId);
                    if (p) {
                      p.extended_cv = extendedCv;
                      await dbOps.saveProfile(p);
                      alert("Master CV permanently updated in IndexedDB!");
                    }
                  }}
                  className="px-4 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded text-xs font-bold transition"
                >
                  Persist to DB
                </button>
              )}
              {extendedCv && (
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded text-xs transition"
                >
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
                onChange={(e) => setExtendedCv(e.target.value)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
