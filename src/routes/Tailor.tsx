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
  const [outputs, setOutputs] = useState({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
  const [activeTab, setActiveTab] = useState<"cv" | "letter" | "qa">("cv");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    dbOps.getJobApplications().then(apps => {
       if (apps) setCatalog(apps.sort((a,b) => b.created_at - a.created_at));
    });
  }, []);

  const handleTailor = async () => {
    if (!jobDesc) return;
    setLoading(true);
    setOutputs({ tailoredCv: "", coverLetter: "", employerAnswers: "" });
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

      const [cvRes, coverRes, qsRes] = await Promise.all([
        GeminiInference.generate(
          `Rewrite the CV specifically to perfectly match the target job description. Do not hallucinate experiences, just reframe existing ones to match the keywords and tone.\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        GeminiInference.generate(
          `Write an aggressively impressive Cover Letter for this job description based on the candidate's CV.\n${context}`,
          "text",
          "gemini-pro-latest"
        ),
        employerQuestions
          ? GeminiInference.generate(
              `Answer the following employer questions using the candidate's perspective securely: ${employerQuestions}\n\nContext:\n${context}`,
              "text",
              "gemini-pro-latest"
            )
          : Promise.resolve(""),
      ]);

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
         created_at: Date.now()
      };

      await dbOps.saveJobApplication(newApp);
      const apps = await dbOps.getJobApplications();
      setCatalog(apps.sort((a,b) => b.created_at - a.created_at));

      setOutputs({ tailoredCv: cvRes, coverLetter: coverRes, employerAnswers: qsRes });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadApplication = (app: JobApp) => {
     setJobDesc(app.job_description);
     setOutputs({ tailoredCv: app.tailored_cv, coverLetter: app.cover_letter, employerAnswers: app.qa_prep });
     setViewState("new");
  };

  const deleteApp = async (id: string, e: any) => {
    e.stopPropagation();
    await dbOps.deleteJobApplication(id);
    setCatalog(catalog.filter((c) => c.id !== id));
  };

  const getActiveContent = () => {
    if (activeTab === "cv") return outputs.tailoredCv;
    if (activeTab === "letter") return outputs.coverLetter;
    return outputs.employerAnswers;
  };

  const hasOutput = !!(outputs.tailoredCv || outputs.coverLetter || outputs.employerAnswers);

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
      />
    </div>
  );
}
