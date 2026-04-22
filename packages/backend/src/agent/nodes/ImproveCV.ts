import { StateAnnotation, DbDirective } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { OllamaProvider } from "../providers/OllamaProvider";
import { PostgresProvider } from "../providers/PostgresProvider";

export async function ImproveCV(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (state.missingCount > 0 && state.interviewHistory.length === 0) {
    return {}; // Wait for at least one interview iteration to improve
  }

  // Check last answer
  if (state.interviewHistory && state.interviewHistory.length > 0) {
    const lastInteraction = state.interviewHistory[state.interviewHistory.length - 1];
    if (!lastInteraction.answer || lastInteraction.answer.trim() === "") {
      return {}; // user has not answered yet
    }
  }

  await dispatchCustomEvent("progress", { msg: "Refining Master CV with 5-phase unified critique..." }, config);

  const dbProvider = new PostgresProvider();
  const llmProvider = new OllamaProvider("gemma4", 0.7);

  let extendedCv = state.baseCv || "";
  let relationalContext = "No explicit relational data found.";

  if (state.userProfileId) {
    try {
      const r = await dbProvider.executeQuery("SELECT extended_cv FROM user_profiles WHERE id = $1", [state.userProfileId]);
      if (r.length > 0 && r[0]?.extended_cv) extendedCv = r[0].extended_cv;

      const expsRes = await dbProvider.executeQuery("SELECT company, role, description FROM experiences WHERE user_profile_id = $1", [state.userProfileId]);
      const projRes = await dbProvider.executeQuery("SELECT repo_name, description FROM projects_raw_text WHERE user_profile_id = $1", [state.userProfileId]);
      
      const skillsQuery = `
         SELECT s.name 
         FROM experience_skills es JOIN skills s ON es.skill_id = s.id 
         JOIN experiences e ON es.experience_id = e.id 
         WHERE e.user_profile_id = $1
         UNION
         SELECT s.name 
         FROM project_skills ps JOIN skills s ON ps.skill_id = s.id 
         JOIN projects_raw_text p ON ps.project_id = p.id 
         WHERE p.user_profile_id = $1
      `;
      const skillsRes = await dbProvider.executeQuery(skillsQuery, [state.userProfileId]);
      
      relationalContext = `
# VALIDATED TIMELINE EXPERIENCES
${expsRes.map((r: any) => `- ${r.role} at ${r.company}: ${r.description}`).join('\n')}

# CORE PROJECTS
${projRes.map((r: any) => `- ${r.repo_name}: ${r.description}`).join('\n')}

# VALIDATED SKILLS DASHBOARD
${skillsRes.map((r: any) => r.name).join(', ')}
`;
    } catch(e) {}
  }

  const lastInteraction = state.interviewHistory && state.interviewHistory.length > 0 ? state.interviewHistory[state.interviewHistory.length - 1] : null;
  const recentQnA = lastInteraction ? `\n\nRecent Interview Q: ${lastInteraction.question}\nUser A: ${lastInteraction.answer}` : "";

  const systemPrompt = `You are an elite Tech Recruiter drafting a Master CV. 
You must simultaneously critique the document across 5 dimensions before generating the final output:
1. TONE: Action-oriented, high impact, zero filler.
2. TRUTH: Strictly bound to the relational context.
3. SKILLS: Accurately reflected in the ontology.
4. PROJECTS: Highlighted appropriately.
5. EXPERIENCES: Logically sequenced.

Output ONLY the completely updated and thoroughly polished markdown CV. Do not include <thinking> blocks or conversational fluff.`;

  const userPrompt = `Context:\nCV:\n${extendedCv}\n\nStructured Database Truth:\n${relationalContext}${recentQnA}`;

  let newCv = extendedCv;
  try {
    const res = await llmProvider.invoke(userPrompt, systemPrompt);
    newCv = res;
    // Strip markdown fences just in case
    newCv = newCv.replace(/^\`\`\`(markdown)?|\`\`\`$/g, "").trim();
  } catch (e: any) {
    await dispatchCustomEvent("progress", { msg: `Warning: CV improvement failed (${e.message}). Skipping update.` }, config);
    return {};
  }

  const writes: DbDirective[] = [];
  if (state.userProfileId) {
    writes.push({
      targetTable: "user_profiles",
      action: "update",
      data: { extended_cv: newCv },
    });
  }

  return { pendingDbWrites: writes, workingExtendedCv: newCv };
}
