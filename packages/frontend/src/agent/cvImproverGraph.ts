import { StateGraph, START, END, Annotation, MemorySaver } from "@langchain/langgraph";
import { GoogleGenAI, Type } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const CVImproverState = Annotation.Root({
  current_cv: Annotation<string>(),
  github_portfolio: Annotation<any[]>(),
  selected_projects: Annotation<string[]>(),
  repo_deep_dives: Annotation<Record<string, string>>(),
  critique: Annotation<string>(),
  score: Annotation<number>(),
  questions_for_user: Annotation<string[]>(),
  user_answers: Annotation<Record<string, string>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  iterations: Annotation<number>(),
});

export type CVImproverStateType = typeof CVImproverState.State;

async function matchGitHubProjects(state: CVImproverStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `Review the current CV and the user's GitHub portfolio. Select up to 5 most impressive and relevant projects that should be highlighted or added to the CV to improve it.
Current CV: ${state.current_cv}
GitHub Portfolio: ${JSON.stringify((state.github_portfolio || []).map((p) => ({ name: p.name, description: p.description, language: p.language })))}
Output ONLY JSON.`,
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
    if (onChunk) onChunk("Match_GitHub_Projects", chunk.text);
  }

  const result = JSON.parse(fullText || "{}");
  return { selected_projects: result.selected_projects || [] };
}

async function fetchRepoContext(state: CVImproverStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const repo_deep_dives: Record<string, string> = { ...(state.repo_deep_dives || {}) };
  for (const repoName of state.selected_projects || []) {
    if (!repo_deep_dives[repoName]) {
      const repo = (state.github_portfolio || []).find((p) => p.name === repoName);
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

async function evaluateCV(state: CVImproverStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `You are an elite Tech Recruiter and Resume Coach specializing in Software Engineering, AI, Game Development, and Full Stack roles.
Review the following CV against State-Of-The-Art (SOTA) industry standards.
Look for the STAR method (Situation, Task, Action, Result) in their experience.
Do NOT hallucinate or invent details. If details are missing, you must ask the user.
Crucially, use the provided GitHub Project Context to verify claims and identify awesome projects the user should highlight more.

Current CV:
${state.current_cv}

GitHub Project Context (Deep Dives):
${JSON.stringify(state.repo_deep_dives || {})}

User Answers to previous questions (if any):
${JSON.stringify(state.user_answers)}

Provide:
1. A score from 1 to 10.
2. A detailed critique (mentioning how they can better use their GitHub projects).
3. If the score is less than 9.5, provide 1-3 specific questions to ask the user to extract STAR details (e.g., "What was the specific impact of X?", "What technologies did you use for Y?"). If you have enough info from recent answers to do a rewrite, you can output an empty list of questions.

Output ONLY JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          critique: { type: Type.STRING },
          questions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Evaluate_CV", chunk.text);
  }

  const res = JSON.parse(fullText || "{}");
  return {
    score: res.score || 0,
    critique: res.critique || "",
    questions_for_user: res.questions || [],
    iterations: (state.iterations || 0) + 1,
  };
}

function routeEvaluation(state: CVImproverStateType) {
  if (state.score >= 9.5 || state.iterations >= 4) {
    return END;
  }
  if (state.questions_for_user && state.questions_for_user.length > 0) {
    return "Ask_User";
  }
  return "Rewrite_CV";
}

async function askUser(state: CVImproverStateType) {
  // This node is the entry point after the human-in-the-loop interrupt.
  // The state has already been updated with user_answers.
  return {};
}

async function rewriteCV(state: CVImproverStateType, config?: RunnableConfig) {
  const onChunk = config?.configurable?.onChunk;
  const stream = await ai.models.generateContentStream({
    model: "gemini-3.1-flash-lite-preview",
    contents: `You are an expert CV writer for AI/Game/Full Stack Software Engineers.
Rewrite the following CV to improve it based on the critique, the user's answers, and their GitHub projects.
Ensure it strictly follows the STAR method where possible.
DO NOT invent, hallucinate, or exaggerate facts. Only use the provided CV, user answers, and GitHub context.

Current CV:
${state.current_cv}

GitHub Project Context (Deep Dives):
${JSON.stringify(state.repo_deep_dives || {})}

Critique to address:
${state.critique}

User Answers:
${JSON.stringify(state.user_answers)}

Output the complete rewritten CV in Markdown format. Output ONLY JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rewritten_cv: { type: Type.STRING },
        },
      },
    },
  });

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk.text;
    if (onChunk) onChunk("Rewrite_CV", chunk.text);
  }

  const res = JSON.parse(fullText || "{}");
  return { current_cv: res.rewritten_cv || state.current_cv, questions_for_user: [] };
}

const workflow = new StateGraph(CVImproverState)
  .addNode("Match_GitHub_Projects", matchGitHubProjects)
  .addNode("Fetch_Repo_Context", fetchRepoContext)
  .addNode("Evaluate_CV", evaluateCV)
  .addNode("Ask_User", askUser)
  .addNode("Rewrite_CV", rewriteCV)
  .addEdge(START, "Match_GitHub_Projects")
  .addEdge("Match_GitHub_Projects", "Fetch_Repo_Context")
  .addEdge("Fetch_Repo_Context", "Evaluate_CV")
  .addConditionalEdges("Evaluate_CV", routeEvaluation)
  .addEdge("Ask_User", "Rewrite_CV")
  .addEdge("Rewrite_CV", "Evaluate_CV");

const checkpointer = new MemorySaver();
export const cvImproverGraph = workflow.compile({
  checkpointer,
  interruptBefore: ["Ask_User"],
});
