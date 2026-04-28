import { GoogleGenAI, Type } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { AgentStateType } from "./graph";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function draftDocs(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const questionsInput = state.company_questions
    ? \`Company Application Questions: \${state.company_questions}\`
    : "";
  const questionsPrompt = state.company_questions
    ? " and 'draft_answers' (markdown format resolving the questions)"
    : "";

  const properties: Record<string, any> = {
    draft_cv: { type: Type.STRING },
    draft_cover_letter: { type: Type.STRING },
  };

  if (state.company_questions) {
    properties.draft_answers = { type: Type.STRING };
  }

  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
    contents: `Draft a highly tailored CV and Cover Letter based on the following inputs.
JD Analysis: ${JSON.stringify(state.jd_analysis)}
Base CV: ${state.base_cv}
Selected Projects Context: ${JSON.stringify(state.repo_deep_dives)}
Critique Feedback (if any): ${state.critique_feedback || "None"}
${questionsInput}

Output a JSON object with 'draft_cv' (markdown format) and 'draft_cover_letter' (markdown format)${questionsPrompt}.
IMPORTANT: Do not include any conversational filler or introductions (e.g., "Here is the tailored CV...") in the markdown strings. Start immediately with the document content (e.g., the title or your name). Ensure the tone matches the requested vibe. Output ONLY valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: properties,
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Draft_Docs", chunk.text);
  }

  const result = JSON.parse(fullText || "{}");
  return {
    draft_cv: result.draft_cv || "",
    draft_cover_letter: result.draft_cover_letter || "",
    draft_answers: result.draft_answers || "",
    iterations: (state.iterations || 0) + 1,
    // Reset critiques
    critique_truth: "",
    critique_star: "",
    critique_verbosity: "",
    critique_tone: "",
    critique_feedback: "",
  };
}
