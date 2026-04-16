import { ProfileGraphState, StateAnnotation, DbDirective } from "../state";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { INTERVIEWER_PROMPTS } from "../prompts/interviewer";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  OnboardingProfileSchema,
  MissingInfoSchema,
  EnhancedInterviewSchema,
} from "../prompts/structuralSchemas";
import { pool } from "../../db/client";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3.1-pro-preview",
  temperature: 1,
  apiKey: process.env.GEMINI_API_KEY,
});

async function evaluateCompleteness(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "Evaluating profile completeness via structured outputs..." },
    config
  );

  // Fetch latest context from raw DB reads (if not passed in state, though state should have it)
  let extendedCv = state.baseCv || "";
  if (state.userProfileId) {
    const r = await pool.query("SELECT master_extended_cv FROM user_profiles WHERE id = $1", [
      state.userProfileId,
    ]);
    if (r.rows[0]?.master_extended_cv) extendedCv = r.rows[0].master_extended_cv;
  }

  const evaluatorWithStructure = llm.withStructuredOutput(OnboardingProfileSchema);

  const evaluation = await evaluatorWithStructure.invoke(
    [
      { role: "system", content: INTERVIEWER_PROMPTS.completenessSystem },
      { role: "user", content: `Here is the current CV and profile info: \n\n${extendedCv}` },
    ],
    config
  );

  return {
    missingInfoList: evaluation.missing_structural_areas || [],
    missingCount: evaluation.missing_structural_areas
      ? evaluation.missing_structural_areas.length
      : 0,
  };
}

async function directInterview(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  if (state.missingCount === 0) {
    await dispatchCustomEvent(
      "progress",
      { msg: "Profile complete. Bypassing interview." },
      config
    );
    return { interviewHistory: state.interviewHistory }; // no update
  }

  await dispatchCustomEvent(
    "progress",
    { msg: `Drafting next interview question. Missing ${state.missingCount} areas.` },
    config
  );

  const targetArea = state.missingInfoList[0];
  const interviewLlm = llm.withStructuredOutput(EnhancedInterviewSchema);

  // History
  let historyText =
    state.interviewHistory?.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join("\n") ||
    "No previous questions.";

  const nextQ = await interviewLlm.invoke(
    [
      { role: "system", content: INTERVIEWER_PROMPTS.interviewerSystem },
      { role: "user", content: `Missing area: ${targetArea}. History:\n${historyText}` },
    ],
    config
  );

  const updatedHistory = [
    ...(state.interviewHistory || []),
    {
      question: nextQ.next_question_to_ask,
      answer: "", // to be filled by user
    },
  ];

  return {
    interviewHistory: updatedHistory,
  };
}

async function improveCV(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  // Only improve if there are answers to process or we forcibly requested an update
  if (!state.interviewHistory || state.interviewHistory.length === 0) {
    return { pendingDbWrites: [] };
  }

  // Check last answer
  const lastInteraction = state.interviewHistory[state.interviewHistory.length - 1];
  if (!lastInteraction.answer || lastInteraction.answer.trim() === "") {
    // User hasn't answered yet, don't improve
    return { pendingDbWrites: [] };
  }

  await dispatchCustomEvent("progress", { msg: "Refining Master CV with new answers..." }, config);

  let extendedCv = state.baseCv || "";
  if (state.userProfileId) {
    const r = await pool.query("SELECT master_extended_cv FROM user_profiles WHERE id = $1", [
      state.userProfileId,
    ]);
    if (r.rows[0]?.master_extended_cv) extendedCv = r.rows[0].master_extended_cv;
  }

  const res = await llm.invoke(
    [
      { role: "system", content: INTERVIEWER_PROMPTS.cvImproverSystem },
      {
        role: "user",
        content: `Context: ${extendedCv}\n\nQ: ${lastInteraction.question}\nA: ${lastInteraction.answer}\n\nPlease output the completely updated markdown CV.`,
      },
    ],
    config
  );

  const newCv = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  const writes: DbDirective[] = [];
  if (state.userProfileId) {
    writes.push({
      targetTable: "user_profiles",
      action: "update",
      data: { master_extended_cv: newCv },
    });
  }

  return { pendingDbWrites: writes };
}

// Subgraph orchestration for Interviewer
const workflow = new StateGraph(StateAnnotation)
  .addNode("Evaluate_Completeness", evaluateCompleteness)
  .addNode("Improve_CV", improveCV)
  .addNode("Direct_Interview", directInterview)
  // Flow: Evaluate -> Improve (if pending answers) -> generate new question
  .addEdge(START, "Evaluate_Completeness")
  .addEdge("Evaluate_Completeness", "Improve_CV")
  .addEdge("Improve_CV", "Direct_Interview")
  .addEdge("Direct_Interview", END);

export const interviewerSubGraph = workflow.compile();
