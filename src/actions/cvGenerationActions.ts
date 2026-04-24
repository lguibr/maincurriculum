import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";

export const startImprover = async (message: string, cvText: string): Promise<boolean> => {
  const { setPipelineState } = usePipelineStore.getState();
  const { setExtendedCv, extendedCv, cloudTier } = useProfileStore.getState();

  try {
    const rawExps = await dbOps.getExperiences();
    const rawProjs = await dbOps.getProjects();
    const rawEdus = await dbOps.getEducations();
    const dbGraph = JSON.stringify({ experiences: rawExps, projects: rawProjs, educations: rawEdus });

    let improveModel = "gemini-pro-latest";
    if (cloudTier === "balanced") improveModel = "gemini-flash-latest";
    if (cloudTier === "widely") improveModel = "gemini-flash-lite-latest";

    const baseForPrompt = extendedCv ? extendedCv : cvText;
    const rewriteMethod = extendedCv 
        ? "You are updating an already Mastered CV. Surgically seamlessly insert, improve, or append the new context described in the USER MESSAGE without destroying the existing layout, structure, or tone. Reply EXCLUSIVELY with the updated raw Markdown string. INCLUDE a ```mermaid classDiagram``` or ```mermaid flowchart TD``` for any new major systems discussed."
        : "Completely rewrite and expand this CV in Markdown format. Enhance descriptions, highlight architectural impact, clarify system depth, and format exactly as a master professional curriculum. Incorporate the interview insights directly. YOU MUST include rich Mermaid.js diagrams (```mermaid classDiagram``` or flowchart) embedded directly into the Markdown to visualize the architecture of their top 2 most complex projects/experiences. DO NOT format this as JSON. Reply EXCLUSIVELY with the new raw Markdown string.";

    const rewritePrompt = `USER MESSAGE:\n${message}\n\nDATABASE RELATIONAL GRAPH:\n${dbGraph}\n\nORIGINAL CV:\n${baseForPrompt}\n\nYou are a senior technical writer and principal engineer. ${rewriteMethod}`;

    const newCv = await GeminiInference.generate(rewritePrompt, "text", improveModel);

    setExtendedCv(newCv);

    await dbOps.saveProfile({
      id: "main",
      github_handle: useProfileStore.getState().githubUsername,
      base_cv: cvText,
      extended_cv: newCv,
      demographics_json: {},
      created_at: Date.now(),
    });

    return true;
  } catch (e) {
    console.error("Improver error", e);
    return false;
  }
};
