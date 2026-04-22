import { StateAnnotation } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { OllamaProvider } from "../providers/OllamaProvider";
import { PostgresProvider } from "../providers/PostgresProvider";
import { z } from "zod";

const OnboardingProfileSchemaZod = z.object({
  is_complete: z.boolean(),
  missing_structural_areas: z.array(z.string()).optional(),
  demographics_inferred: z.string().optional()
});

export async function EvaluateCompleteness(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (state.missingCount > 0 && state.interviewHistory.length > 0) {
     return {}; // already evaluated and looping in interview
  }

  await dispatchCustomEvent("progress", { msg: "Evaluating profile completeness via structured outputs..." }, config);

  const dbProvider = new PostgresProvider();
  const llmProvider = new OllamaProvider("gemma4", 0);

  let extendedCv = state.baseCv || "";
  if (state.userProfileId) {
    try {
      const r = await dbProvider.executeQuery("SELECT extended_cv FROM user_profiles WHERE id = $1", [state.userProfileId]);
      if (r[0]?.extended_cv) extendedCv = r[0].extended_cv;
    } catch(e){}
  }

  const systemPrompt = `You are an HR evaluator identifying missing parts of a professional profile. Outputs must be strictly valid JSON.`;
  const userPrompt = `Here is the current CV and profile info: \n\n${extendedCv}`;

  try {
    const evaluation = await llmProvider.extractStructuredJSON<z.infer<typeof OnboardingProfileSchemaZod>>(OnboardingProfileSchemaZod, userPrompt, systemPrompt);
    
    return {
      missingInfoList: evaluation.missing_structural_areas || [],
      missingCount: evaluation.missing_structural_areas ? evaluation.missing_structural_areas.length : 0,
    };
  } catch (e: any) {
    await dispatchCustomEvent("progress", { msg: `Warning: Completeness evaluation failed (${e.message}). Proceeding as complete.` }, config);
    return { missingInfoList: [], missingCount: 0 };
  }
}
