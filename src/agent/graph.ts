import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { GoogleGenAI, Type } from "@google/genai";
import { draftDocs } from "./draftDocs";
import { critiqueTruth, critiqueStar, critiqueVerbosity, critiqueTone } from "./critiques";
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
    model: "gemini-flash-lite-latest",
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
    model: "gemini-flash-lite-latest",
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


async function critiqueAggregator(state: AgentStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-flash-lite-latest",
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
