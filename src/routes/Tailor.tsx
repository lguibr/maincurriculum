import { useState, useEffect } from "react";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";

import { TailorSidebar, JobApp } from "../features/tailor/components/TailorSidebar";
import { TailorOutput } from "../features/tailor/components/TailorOutput";

export default function Tailor() {
  const [jobDesc, setJobDesc] = useState("");
  const [employerQuestions, setEmployerQuestions] = useState("");
  const [catalog, setCatalog] = useState<JobApp[]>([]);
  const [viewState, setViewState] = useState<"new" | "catalog">("new");
  const [outputs, setOutputs] = useState({ tailoredCv: "", coverLetter: "", employerAnswers: "", fitDiagram: "" });
  const [activeTab, setActiveTab] = useState<"cv" | "letter" | "qa">("cv");
  const [loading, setLoading] = useState(false);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    dbOps.getJobApplications().then(apps => {
       if (apps) setCatalog(apps.sort((a,b) => b.created_at - a.created_at));
    });
  }, []);

  const handleTailor = async () => {
    if (!jobDesc) return;
    setLoading(true);
    setOutputs({ tailoredCv: "", coverLetter: "", employerAnswers: "", fitDiagram: "" });
    try {
      const prof = await dbOps.getProfile("main");
      if (!prof) throw new Error("Profile missing");

      const context = `
Candidate CV:
${prof.extended_cv || prof.base_cv}

Candidate Demographics & Identity (Use logically): 
${JSON.stringify(prof.demographics_json)}

Target Job Description:
${jobDesc}
`;

      const [cvRes, coverRes, qsRes, diagramRaw] = await Promise.all([
        GeminiInference.generate(
          `Rewrite the CV specifically to perfectly match the target job description. Do not hallucinate experiences, just reframe existing ones to match the keywords and tone.\n\nIMPORTANT: Do not include any conversational filler (e.g., "Here is the rewritten CV..."). Start immediately with the document content in Markdown.\n\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        GeminiInference.generate(
          `Write an aggressively impressive Cover Letter for this job description based on the candidate's CV.\n\nIMPORTANT: Do not include any conversational filler (e.g., "Here is the cover letter..."). Start immediately with the document content in Markdown.\n\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        employerQuestions
          ? GeminiInference.generate(
              `Answer the following employer questions using the candidate's perspective securely: ${employerQuestions}\n\nIMPORTANT: Do not include any conversational filler (e.g., "Here are the answers..."). Start immediately with the answers in Markdown.\n\nContext:\n${context}`,
              "text",
              "gemini-pro-latest"
            )
          : Promise.resolve(""),
        GeminiInference.generate(
          `Create a Mermaid.js diagram (e.g., a pie chart, mindmap, or flowchart) visualizing how the candidate's skills perfectly align with the target job description. 
IMPORTANT: If using a flowchart, you MUST use a Top-Down layout (e.g., 'graph TD' or 'flowchart TB') instead of Left-Right (LR) so that the diagram fits vertically on a standard A4 PDF page without horizontal scrolling.
Output ONLY the raw Mermaid code block without any markdown backticks or introductory text. Start directly with the mermaid diagram type.\n\nContext:\n${context}`,
          "text",
          "gemini-pro-latest"
        )
      ]);

      let diagramRes = diagramRaw.replace(/```mermaid/gi, "").replace(/```/g, "").trim();

      const extractMetaPrompt = `Extract a JSON from this Job Description determining {"company": "Company Name", "role": "Job Title"}. If missing, use "Unknown".\nJD:\n${jobDesc}`;
      const metaStr = await GeminiInference.generate(extractMetaPrompt, "json", "gemini-flash-latest");
      let company = "Unknown Company", role = "Unknown Role";
      try {
         const m = metaStr.match(/\{[\s\S]*\}/);
         if (m) {
           const parsed = JSON.parse(m[0]);
           company = parsed.company;
           role = parsed.role;
         }
      } catch (ex) {}

      const newApp: JobApp = {
         id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
         company,
         role,
         job_description: jobDesc,
         tailored_cv: cvRes,
         cover_letter: coverRes,
         qa_prep: qsRes,
         fit_diagram: diagramRes,
         created_at: Date.now()
      };

      await dbOps.saveJobApplication(newApp);
      const apps = await dbOps.getJobApplications();
      setCatalog(apps.sort((a,b) => b.created_at - a.created_at));

      setOutputs({ tailoredCv: cvRes, coverLetter: coverRes, employerAnswers: qsRes, fitDiagram: diagramRes });
      setActiveAppId(newApp.id);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadApplication = (app: JobApp) => {
     setJobDesc(app.job_description);
     setOutputs({ tailoredCv: app.tailored_cv, coverLetter: app.cover_letter, employerAnswers: app.qa_prep, fitDiagram: app.fit_diagram || "" });
     setActiveAppId(app.id);
     setViewState("new");
  };

  const deleteApp = async (id: string, e: any) => {
    e.stopPropagation();
    await dbOps.deleteJobApplication(id);
    setCatalog(catalog.filter((c) => c.id !== id));
    if (activeAppId === id) setActiveAppId(null);
  };

  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});

  const handleRefine = async (instruction: string) => {
    if (!activeAppId) return;
    setIsRefining(true);

    const activeTabName = activeTab === 'cv' ? 'CV' : activeTab === 'letter' ? 'Cover Letter' : 'Form Answers';
    const chatKey = `${activeAppId}_${activeTab}`;
    const history = chatMessages[chatKey] || [
      { role: "assistant", content: `I am your AI Editor. Tell me what to change in your ${activeTabName}.` }
    ];

    const updatedHistory: ChatMessage[] = [...history, { role: "user", content: instruction }];
    setChatMessages(prev => ({ ...prev, [chatKey]: updatedHistory }));

    try {
      const currentContent = getActiveContent();
      const historyStr = updatedHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
      
      const prompt = `You are an AI Job Application Tailor. You are currently refining a markdown document (${activeTabName}).
Current Document:
${currentContent}

The user will provide instructions to modify, clarify, or expand this document.
Your response MUST consist of two parts:
1. A brief, conversational confirmation of what you changed.
2. The EXACT updated document in Markdown at the very end of your response, starting with "UPDATED_DOCUMENT:" followed by the raw Markdown text. Do NOT wrap it in markdown code blocks unless it's part of the content.

Example Response:
I've removed the Python skill and made the tone more professional!
UPDATED_DOCUMENT:
# Job Applicant
...

Chat History:
${historyStr}
ASSISTANT:`;

      const aiResponse = await GeminiInference.generate(prompt, "text", "gemini-pro-latest");
      
      const splitKeyword = "UPDATED_DOCUMENT:";
      const parts = aiResponse.split(splitKeyword);
      
      const conversationalText = parts[0].trim() || "I've updated the document as requested.";
      let newContent = parts[1] ? parts[1].trim() : currentContent;

      setChatMessages(prev => ({ ...prev, [chatKey]: [...updatedHistory, { role: "assistant", content: conversationalText }] }));
      
      const newOutputs = { ...outputs };
      if (activeTab === "cv") newOutputs.tailoredCv = newContent;
      if (activeTab === "letter") newOutputs.coverLetter = newContent;
      if (activeTab === "qa") newOutputs.employerAnswers = newContent;
      setOutputs(newOutputs);

      const app = catalog.find((c) => c.id === activeAppId);
      if (app) {
        const updatedApp = {
          ...app,
          tailored_cv: newOutputs.tailoredCv,
          cover_letter: newOutputs.coverLetter,
          qa_prep: newOutputs.employerAnswers,
        };
        await dbOps.saveJobApplication(updatedApp);
        const apps = await dbOps.getJobApplications();
        setCatalog(apps.sort((a,b) => b.created_at - a.created_at));
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => ({ ...prev, [chatKey]: [...updatedHistory, { role: "assistant", content: "Sorry, I encountered an error while refining the document." }] }));
    }
    setIsRefining(false);
  };

  const handleManualSave = async (newContent: string) => {
    if (!activeAppId) return;
    const newOutputs = { ...outputs };
    if (activeTab === "cv") newOutputs.tailoredCv = newContent;
    if (activeTab === "letter") newOutputs.coverLetter = newContent;
    if (activeTab === "qa") newOutputs.employerAnswers = newContent;
    setOutputs(newOutputs);

    const app = catalog.find((c) => c.id === activeAppId);
    if (app) {
      const updatedApp = {
        ...app,
        tailored_cv: newOutputs.tailoredCv,
        cover_letter: newOutputs.coverLetter,
        qa_prep: newOutputs.employerAnswers,
      };
      await dbOps.saveJobApplication(updatedApp);
      const apps = await dbOps.getJobApplications();
      setCatalog(apps.sort((a,b) => b.created_at - a.created_at));
    }
  };

  const getActiveContent = () => {
    if (activeTab === "cv") return outputs.tailoredCv;
    if (activeTab === "letter") return outputs.coverLetter;
    return outputs.employerAnswers;
  };

  const hasOutput = !!(outputs.tailoredCv || outputs.coverLetter || outputs.employerAnswers);

  const activeApp = catalog.find((c) => c.id === activeAppId);

  const getSafeStr = (str: any) => {
    if (!str || typeof str !== 'string') return "Unknown";
    // Replace non-alphanumeric with underscores, prevent multiple underscores, limit to 50 chars
    return str.replace(/[^a-zA-Z0-9]/g, "_").replace(/__+/g, "_").substring(0, 50);
  };

  const pdfFilename = activeApp
    ? `${activeTab === 'cv' ? 'CV' : activeTab === 'letter' ? 'CoverLetter' : 'QA'}_${getSafeStr(activeApp.role)}_${getSafeStr(activeApp.company)}_${new Date().toISOString().split("T")[0]}`
    : "Document";

  return (
    <div className="h-full flex gap-4 p-4 overflow-hidden print:h-auto print:overflow-visible print:block print:p-0">
      <TailorSidebar
        viewState={viewState} setViewState={setViewState}
        jobDesc={jobDesc} setJobDesc={setJobDesc}
        employerQuestions={employerQuestions} setEmployerQuestions={setEmployerQuestions}
        handleTailor={handleTailor} loading={loading}
        catalog={catalog} loadApplication={loadApplication}
        deleteApp={deleteApp}
      />
      <TailorOutput
        activeTab={activeTab} setActiveTab={setActiveTab}
        hasOutput={hasOutput} getActiveContent={getActiveContent}
        onRefine={handleRefine} isRefining={isRefining}
        onManualSave={handleManualSave}
        pdfFilename={pdfFilename}
        fitDiagram={outputs.fitDiagram}
        chatMessages={activeAppId ? (chatMessages[`${activeAppId}_${activeTab}`] || [{ role: "assistant", content: `I am your AI Editor. Tell me what to change in your ${activeTab === 'cv' ? 'CV' : activeTab === 'letter' ? 'Cover Letter' : 'Form Answers'}.` }]) : []}
      />
    </div>
  );
}
