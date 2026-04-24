import { GeminiInference } from "./GeminiInference";
import { dbOps } from "../db/indexedDB";

export interface CritiqueResult {
  status: "PASS" | "USER_INPUT_REQUIRED";
  assistant_message: string;
  auto_updates?: any; // JSON snippet of db properties to patch
}

export async function runCritiqueOrchestrationLoop(chatHistoryText: string = ""): Promise<CritiqueResult> {
  const exps = await dbOps.getExperiences();
  const projs = await dbOps.getProjects();
  const edus = await dbOps.getEducations();
  const skills = await dbOps.getSkills();

  // Combine entire JSON context. In production, this might be chunked or only target un-validated items.
  const contextStr = JSON.stringify({
    experiences: exps,
    projects: projs.map((p) => ({ ...p, raw_text: p.raw_text.substring(0, 500) + "...(truncated)" })),
    educations: edus,
    skills,
  });

  const orchestratorPrompt = `You are the Master AI Orchestrator running an ingestion pipeline. 
Your goal is to validate the extracted data against 5 rigorous layers:
1. Truthfulness/Timeline: Are there illogical date overlaps or unexplained multi-year gaps?
2. Codebase Validation: Do the described project skills exist in the codebase semantic search?
3. Depth/Context: Are the experience descriptions too shallow?
4. Formatting: Are there glaring spelling or messy grammar issues?
5. STAR Method: Do the bullet points map to Situation, Task, Action, Result?

Current Database State:
${contextStr}

Recent Chat Context with User (Use this to resolve gaps):
${chatHistoryText}

If you find ANY failure in these 5 layers that you CANNOT safely auto-correct (e.g. you need to ask the user what they did during a gap, or need them to provide a concrete 'Result' for the STAR method), you must halt.
Return a STRICT JSON block exactly following this schema:
{
  "status": "USER_INPUT_REQUIRED",
  "assistant_message": "Direct question asking the user to clarify the specific gap or missing info. Be concise."
}

If everything passes flawlessly, OR if you can fix minor formatting issues automatically, return:
{
  "status": "PASS",
  "assistant_message": "All pipeline checks passed.",
  "auto_updates": { "experiences": [...], "projects": [...] } // Only include items that needed formatting fixes
}

Output ONLY valid JSON. No markdown formatting.`;

  const responseJson = await GeminiInference.generate(orchestratorPrompt, "json", "gemini-pro-latest");

  try {
    const parsed = JSON.parse(responseJson) as CritiqueResult;

    if (parsed.auto_updates) {
      // Apply minor fixes directly
      if (parsed.auto_updates.experiences) {
        for (const exp of parsed.auto_updates.experiences) await dbOps.saveExperience(exp);
      }
      if (parsed.auto_updates.projects) {
        for (const p of parsed.auto_updates.projects) {
          const existing = await dbOps.getProject(p.id);
          if (existing) {
            await dbOps.saveProject({ ...existing, ...p });
          }
        }
      }
    }

    return parsed;
  } catch (e) {
    console.error("Critique orchestrator failed to parse JSON:", e, responseJson);
    return {
      status: "PASS",
      assistant_message: "Error parsing orchestrator response. Bypassing critiques."
    };
  }
}
