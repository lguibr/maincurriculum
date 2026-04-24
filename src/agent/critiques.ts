import { GoogleGenAI } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { AgentStateType } from "./graph";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function critiqueTruth(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
    contents: `You are the Truthfulness Critic. Compare the Draft CV/Cover Letter against the provided GitHub Repo context and Base CV.
Are there any blatantly invented claims, skills, or metrics? 

Base CV:
${state.base_cv}

Draft CV & Answers:
${state.draft_cv}
${state.draft_answers || ""}

GitHub Context:
${JSON.stringify(state.repo_deep_dives)}

Output a brief critique or "OK" if everything is grounded in the source data.`,
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_Truth", chunk.text);
  }
  return { critique_truth: fullText };
}

export async function critiqueStar(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
    contents: `You are the STAR Method Critic. Evaluate the Draft CV.
Do the bullet points and any application answers effectively use the STAR method (Situation, Task, Action, Result)? Or are they just a list of responsibilities?

Draft CV:
${state.draft_cv}

Draft Answers (If any):
${state.draft_answers || ""}

Output specific areas for improvement, or "OK" if well-formatted.`,
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_STAR", chunk.text);
  }
  return { critique_star: fullText };
}

export async function critiqueVerbosity(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
    contents: `You are the Conciseness Critic. Evaluate the Draft CV and Draft Cover Letter.
Are they too wordy, rambling, or dense? Are they too sparse and lacking detail?

Drafts:
${state.draft_cv}
${state.draft_cover_letter}
${state.draft_answers || ""}

Output specific wording suggestions, or "OK" if perfectly balanced.`,
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_Verbosity", chunk.text);
  }
  return { critique_verbosity: fullText };
}

export async function critiqueTone(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
    contents: `You are the Tone/Vibe Critic. Evaluate the Drafts against the extracted JD Vibe.
JD Vibe: ${state.jd_analysis?.vibe || "Professional"}

Drafts:
${state.draft_cv}
${state.draft_cover_letter}

Output specific suggestions to align the tone better with the company vibe, or "OK" if aligned.`,
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_Tone", chunk.text);
  }
  return { critique_tone: fullText };
}
