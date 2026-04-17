import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { GoogleGenAI, Type } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const AgentState = Annotation.Root({
  job_description: Annotation<string>(),
  jd_analysis: Annotation<any>(),
  base_cv: Annotation<string>(),
  github_portfolio: Annotation<any[]>(),
  selected_projects: Annotation<string[]>(),
  repo_deep_dives: Annotation<Record<string, string>>(),
  draft_cv: Annotation<string>(),
  draft_cover_letter: Annotation<string>(),
  company_questions: Annotation<string>(),
  draft_answers: Annotation<string>(),

  critique_truth: Annotation<string>(),
  critique_star: Annotation<string>(),
  critique_verbosity: Annotation<string>(),
  critique_tone: Annotation<string>(),
  critique_feedback: Annotation<string>(),

  next_action: Annotation<string>(),
  iterations: Annotation<number>(),
});

export type AgentStateType = typeof AgentState.State;

async function analyzeJD(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;

  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Analyze the following Job Description and extract the core technologies, soft skills, and vibe/tone.
Job Description:
${state.job_description}

Output ONLY valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          core_technologies: { type: Type.ARRAY, items: { type: Type.STRING } },
          soft_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          vibe: { type: Type.STRING },
        },
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Analyze_JD", chunk.text);
  }

  const jd_analysis = JSON.parse(fullText || "{}");
  return { jd_analysis };
}

async function profileMatch(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Match the job description analysis against the base CV and GitHub portfolio. Select up to 3 most relevant GitHub projects.
JD Analysis: ${JSON.stringify(state.jd_analysis)}
Base CV: ${state.base_cv}
GitHub Portfolio: ${JSON.stringify(state.github_portfolio.map((p) => ({ name: p.name, description: p.description, language: p.language })))}

Output ONLY valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          selected_projects: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Profile_Match", chunk.text);
  }

  const result = JSON.parse(fullText || "{}");
  return { selected_projects: result.selected_projects || [] };
}

async function fetchRepoContext(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const repo_deep_dives: Record<string, string> = { ...(state.repo_deep_dives || {}) };
  for (const repoName of state.selected_projects) {
    if (!repo_deep_dives[repoName]) {
      const repo = state.github_portfolio.find((p) => p.name === repoName);
      if (repo && repo.full_name) {
        try {
          if (onChunk) onChunk("Fetch_Repo_Context", `\nFetching context for ${repo.full_name}...`);
          const res = await fetch(`https://api.github.com/repos/${repo.full_name}/readme`);
          if (res.ok) {
            const data = await res.json();
            repo_deep_dives[repoName] = atob(data.content);
          } else {
            repo_deep_dives[repoName] = repo.description || "No description available.";
          }
        } catch (e) {
          repo_deep_dives[repoName] = repo.description || "No description available.";
        }
      }
    }
  }
  return { repo_deep_dives };
}

async function draftDocs(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const questionsInput = state.company_questions
    ? `Company Application Questions: ${state.company_questions}`
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
    model: "gemini-3.1-flash-lite-preview",
    contents: `Draft a highly tailored CV and Cover Letter based on the following inputs.
JD Analysis: ${JSON.stringify(state.jd_analysis)}
Base CV: ${state.base_cv}
Selected Projects Context: ${JSON.stringify(state.repo_deep_dives)}
Critique Feedback (if any): ${state.critique_feedback || "None"}
${questionsInput}

Output a JSON object with 'draft_cv' (markdown format) and 'draft_cover_letter' (markdown format)${questionsPrompt}. Ensure the tone matches the requested vibe. Output ONLY valid JSON.`,
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

// -------------------------------------------------------------
// MULTI-LAYERED CRITIQUES (Run in parallel)
// -------------------------------------------------------------

async function critiqueTruth(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
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

async function critiqueStar(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
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

async function critiqueVerbosity(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
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

async function critiqueTone(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `You are the Tone Critic. Analyze the Draft CV and Cover Letter against the Job Description vibe.
Does the candidate show off appropriately without sounding arrogant or overly boastful?

JD Vibe: ${state.jd_analysis?.vibe}

Drafts:
${state.draft_cv}
${state.draft_cover_letter}
${state.draft_answers || ""}

Output tone adjustments needed, or "OK" if tone matches beautifully.`,
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_Tone", chunk.text);
  }
  return { critique_tone: fullText };
}

async function critiqueAggregator(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `You are the Master Editor. Analyze the following 4 distinct critiques of the current Draft CV and Cover Letter.
    
1. Truthfulness Critique: ${state.critique_truth}
2. STAR Method Critique: ${state.critique_star}
3. Verbosity Critique: ${state.critique_verbosity}
4. Tone Critique: ${state.critique_tone}

Based on these, formulate an aggregated feedback for the drafting agent. If all critics say "OK" or variations thereof, state that it is perfect and select "ACCEPT".
Otherwise, provide a unified list of actionable instructions to improve the draft, and choose "REVISE_DRAFT".
If the projects chosen seem fundamentally wrong based on the critiques, choose "RESELECT_PROJECTS".

Output JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["ACCEPT", "REVISE_DRAFT", "RESELECT_PROJECTS"] },
          feedback: { type: Type.STRING },
        },
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Critique_Aggregator", chunk.text);
  }

  const result = JSON.parse(fullText || "{}");
  return { critique_feedback: result.feedback || "", next_action: result.action || "ACCEPT" };
}

function routeCritique(state: AgentStateType) {
  if ((state.iterations || 0) >= 3) {
    return END;
  }
  if (state.next_action === "ACCEPT") {
    return END;
  } else if (state.next_action === "RESELECT_PROJECTS") {
    return "Profile_Match";
  } else {
    return "Draft_Docs";
  }
}

const workflow = new StateGraph(AgentState)
  .addNode("Analyze_JD", analyzeJD)
  .addNode("Profile_Match", profileMatch)
  .addNode("Fetch_Repo_Context", fetchRepoContext)
  .addNode("Draft_Docs", draftDocs)
  .addNode("Critique_Truth", critiqueTruth)
  .addNode("Critique_STAR", critiqueStar)
  .addNode("Critique_Verbosity", critiqueVerbosity)
  .addNode("Critique_Tone", critiqueTone)
  .addNode("Critique_Aggregator", critiqueAggregator)

  .addEdge(START, "Analyze_JD")
  .addEdge("Analyze_JD", "Profile_Match")
  .addEdge("Profile_Match", "Fetch_Repo_Context")
  .addEdge("Fetch_Repo_Context", "Draft_Docs")

  // Fan out to parallel critiques
  .addEdge("Draft_Docs", "Critique_Truth")
  .addEdge("Draft_Docs", "Critique_STAR")
  .addEdge("Draft_Docs", "Critique_Verbosity")
  .addEdge("Draft_Docs", "Critique_Tone")

  // Fan in to aggregator
  .addEdge("Critique_Truth", "Critique_Aggregator")
  .addEdge("Critique_STAR", "Critique_Aggregator")
  .addEdge("Critique_Verbosity", "Critique_Aggregator")
  .addEdge("Critique_Tone", "Critique_Aggregator")

  .addConditionalEdges("Critique_Aggregator", routeCritique);

const checkpointer = new MemorySaver();
export const appGraph = workflow.compile({ checkpointer });
