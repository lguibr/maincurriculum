import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { GoogleGenAI, Type } from "@google/genai";

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
  critique_feedback: Annotation<string>(),
  next_action: Annotation<string>(),
  iterations: Annotation<number>(),
});

export type AgentStateType = typeof AgentState.State;

async function analyzeJD(state: AgentStateType) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following Job Description and extract the core technologies, soft skills, and vibe/tone.
Job Description:
${state.job_description}`,
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
  const jd_analysis = JSON.parse(response.text || "{}");
  return { jd_analysis };
}

async function profileMatch(state: AgentStateType) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Match the job description analysis against the base CV and GitHub portfolio. Select up to 3 most relevant GitHub projects.
JD Analysis: ${JSON.stringify(state.jd_analysis)}
Base CV: ${state.base_cv}
GitHub Portfolio: ${JSON.stringify(state.github_portfolio.map(p => ({ name: p.name, description: p.description, language: p.language })))}`,
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
  const result = JSON.parse(response.text || "{}");
  return { selected_projects: result.selected_projects || [] };
}

async function fetchRepoContext(state: AgentStateType) {
  const repo_deep_dives: Record<string, string> = { ...(state.repo_deep_dives || {}) };
  for (const repoName of state.selected_projects) {
    if (!repo_deep_dives[repoName]) {
      const repo = state.github_portfolio.find(p => p.name === repoName);
      if (repo && repo.full_name) {
        try {
          const res = await fetch(`https://api.github.com/repos/${repo.full_name}/readme`);
          if (res.ok) {
            const data = await res.json();
            // GitHub API returns base64 encoded content
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

async function draftDocs(state: AgentStateType) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Draft a highly tailored CV and Cover Letter based on the following inputs.
JD Analysis: ${JSON.stringify(state.jd_analysis)}
Base CV: ${state.base_cv}
Selected Projects Context: ${JSON.stringify(state.repo_deep_dives)}
Critique Feedback (if any): ${state.critique_feedback || "None"}

Output a JSON object with 'draft_cv' (markdown format) and 'draft_cover_letter' (markdown format). Ensure the tone matches the requested vibe.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          draft_cv: { type: Type.STRING },
          draft_cover_letter: { type: Type.STRING },
        },
      },
    },
  });
  const result = JSON.parse(response.text || "{}");
  return { 
    draft_cv: result.draft_cv || "", 
    draft_cover_letter: result.draft_cover_letter || "",
    iterations: (state.iterations || 0) + 1
  };
}

async function critiqueAgent(state: AgentStateType) {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Critique the drafted CV and Cover Letter against the Job Description.
Job Description: ${state.job_description}
Draft CV: ${state.draft_cv}
Draft Cover Letter: ${state.draft_cover_letter}

Evaluate if the core frameworks are mentioned, if the strongest projects are leveraged, if the tone is appropriate, and if there are any hallucinations.
Decide the next action:
- ACCEPT: if it's perfect.
- REVISE_DRAFT: if it needs wording tweaks.
- RESELECT_PROJECTS: if it missed the mark completely and needs different projects.

Provide detailed feedback.`,
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
  const result = JSON.parse(response.text || "{}");
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
  .addNode("Critique_Agent", critiqueAgent)
  .addEdge(START, "Analyze_JD")
  .addEdge("Analyze_JD", "Profile_Match")
  .addEdge("Profile_Match", "Fetch_Repo_Context")
  .addEdge("Fetch_Repo_Context", "Draft_Docs")
  .addEdge("Draft_Docs", "Critique_Agent")
  .addConditionalEdges("Critique_Agent", routeCritique);

export const appGraph = workflow.compile();
