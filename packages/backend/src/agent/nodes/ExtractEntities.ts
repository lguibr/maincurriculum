import { StateAnnotation } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { OllamaProvider } from "../providers/OllamaProvider";
import { PostgresProvider } from "../providers/PostgresProvider";
import { z } from "zod";

const EntitiesExtractionZodSchema = z.object({
  skills: z.array(z.object({ name: z.string(), type: z.enum(["language", "framework", "tool", "unknown"]).optional() })).optional(),
  experiences: z.array(z.object({
    company: z.string(),
    role: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    description: z.string(),
    skills: z.array(z.object({ name: z.string() })).optional()
  })).optional(),
  project_mappings: z.array(z.object({
    repository_name: z.string(),
    skills_used: z.array(z.string())
  })).optional()
});

export async function ExtractEntities(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (state.interviewHistory && state.interviewHistory.length > 0) {
    return { currentPhase: "Interview Phase" };
  }

  await dispatchCustomEvent("progress", { msg: "Extracting skills and experiences into the Database Dashboard..." }, config);

  const dbProvider = new PostgresProvider();
  const llmProvider = new OllamaProvider("gemma4", 0);

  let baseCv = state.baseCv || "";
  let projectsText = "";

  if (state.userProfileId) {
    try {
      const prj = await dbProvider.executeQuery("SELECT repo_name, raw_text FROM projects_raw_text WHERE user_profile_id = $1", [state.userProfileId]);
      projectsText = prj.map((r: any) => `Repo: ${r.repo_name}\nData: ${r.raw_text.substring(0, 600)}...`).join("\n\n");
    } catch(e) {}
  }

  const systemPrompt = `You are a strict data extraction system.`;
  const userPrompt = `Context:\nCV:\n${baseCv}\n\nREPOSITORIES:\n${projectsText}`;

  try {
    const extraction = await llmProvider.extractStructuredJSON<z.infer<typeof EntitiesExtractionZodSchema>>(EntitiesExtractionZodSchema, userPrompt, systemPrompt);

    if (extraction && state.userProfileId) {
      for (const skill of (extraction.skills || [])) {
        try {
          await dbProvider.executeQuery("INSERT INTO skills (name, type) VALUES ($1, $2) ON CONFLICT(name) DO NOTHING", [skill.name, skill.type || "unknown"]);
        } catch(e){}
      }
      
      for (const exp of (extraction.experiences || [])) {
        try {
          const expRes = await dbProvider.executeQuery(
            "INSERT INTO experiences (user_profile_id, company, role, start_date, end_date, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [state.userProfileId, exp.company, exp.role, exp.start_date, exp.end_date, exp.description]
          );
          if(expRes.length > 0) {
              const expId = expRes[0].id;
              if (exp.skills) {
                for (const s of exp.skills) {
                  const skillRes = await dbProvider.executeQuery("SELECT id FROM skills WHERE name = $1", [s.name]);
                  if (skillRes.length > 0) {
                    await dbProvider.executeQuery("INSERT INTO experience_skills (experience_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [expId, skillRes[0].id]);
                  }
                }
              }
          }
        } catch(e) {}
      }

      for (const mapping of (extraction.project_mappings || [])) {
        try {
          const projRes = await dbProvider.executeQuery("SELECT id FROM projects_raw_text WHERE repo_name = $1", [mapping.repository_name]);
          if (projRes.length > 0) {
            const projId = projRes[0].id;
            for (const sName of mapping.skills_used) {
              const skillRes = await dbProvider.executeQuery("SELECT id FROM skills WHERE name = $1", [sName]);
              if (skillRes.length > 0) {
                await dbProvider.executeQuery("INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [projId, skillRes[0].id]);
              }
            }
          }
        } catch(e) {}
      }
    }
  } catch (e: any) {
    await dispatchCustomEvent("progress", { msg: `Entities extraction failed (${e.message}). UI Dashboard will be empty.` }, config);
  }

  return { currentPhase: "Interview Phase" };
}
