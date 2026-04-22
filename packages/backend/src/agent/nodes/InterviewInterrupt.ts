import { StateAnnotation } from "../state";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { interrupt } from "@langchain/langgraph";
import { OllamaProvider } from "../providers/OllamaProvider";
import { z } from "zod";

const EnhancedInterviewSchemaZod = z.object({
  next_question_to_ask: z.string()
});

export async function InterviewInterrupt(
  state: typeof StateAnnotation.State,
  config?: RunnableConfig
) {
  if (state.missingCount === 0) {
    await dispatchCustomEvent("progress", { msg: "Profile is structurally complete. Final state reached." }, config);
    return { currentPhase: "Complete" };
  }

  const llmProvider = new OllamaProvider("gemma4", 1);

  await dispatchCustomEvent("progress", { msg: `Drafting next interview question. Missing ${state.missingCount} core areas.` }, config);

  const targetArea = state.missingInfoList[0];
  const historyText = state.interviewHistory?.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join("\n") || "No previous questions.";

  const systemPrompt = `You are a technical interviewer identifying missing elements in a candidate's profile. You must generate only one highly specific question about the missing target area. Output strict JSON.`;
  const userPrompt = `Missing area: ${targetArea}. History:\n${historyText}`;

  let nextQ = "Could you tell me more about your recent achievements?";
  try {
    const res = await llmProvider.extractStructuredJSON<z.infer<typeof EnhancedInterviewSchemaZod>>(EnhancedInterviewSchemaZod, userPrompt, systemPrompt);
    nextQ = res.next_question_to_ask;
  } catch (e: any) {
    await dispatchCustomEvent("progress", { msg: `Warning: Formatting failed (${e.message}). Fallback to generic.` }, config);
  }

  const updatedHistory = [
    ...(state.interviewHistory || []),
    {
      question: nextQ,
      answer: "", // to be filled by user
    },
  ];

  const userAnswer = interrupt({ phase: "Interview Phase", question: nextQ }) as string;
  
  if (userAnswer) {
    updatedHistory[updatedHistory.length - 1].answer = userAnswer;
  }

  return { interviewHistory: updatedHistory };
}
