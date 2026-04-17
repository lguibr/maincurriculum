import { StateGraph, START, END } from "@langchain/langgraph";
import { StateAnnotation } from "../state";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { searchGithubProjectsTool, querySkillsAndExperiencesTool } from "../tools/vectorSearch";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import {
  CV_DRAFTER_PROMPT,
  CRITIQUE_TONE_PROMPT,
  CRITIQUE_TRUTH_PROMPT,
  CRITIQUE_SKILLS_PROMPT,
  CRITIQUE_PROJECTS_PROMPT,
  CRITIQUE_EXPERIENCES_PROMPT,
  CRITIQUE_CONSOLIDATOR_PROMPT,
} from "../prompts/improver.prompt";

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest",
  temperature: 0.7, // slightly lower for truthfulness, but creative enough to draft
  apiKey: process.env.GEMINI_API_KEY,
});

async function draftCV(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Drafting Extended CV context..." }, config);
  // Find latest Human message
  const lastMsg =
    state.messages.length > 0 ? state.messages[state.messages.length - 1].content : "";

  const llmWithTools = llm.bindTools([searchGithubProjectsTool, querySkillsAndExperiencesTool]);
  const msgs: any[] = [
    {
      role: "system",
      content: CV_DRAFTER_PROMPT,
    },
    {
      role: "user",
      content: `Current CV:\n${state.workingExtendedCv || state.baseCv}\n\nRecent User Input:\n${lastMsg}`,
    },
  ];
  let draftCompletion = await llmWithTools.invoke(msgs, config);

  // Manual tool loop
  if (draftCompletion.tool_calls && draftCompletion.tool_calls.length > 0) {
    msgs.push(draftCompletion);
    for (const call of draftCompletion.tool_calls) {
      if (call.name === "search_github_projects") {
        const res = await searchGithubProjectsTool.invoke(call);
        msgs.push({ role: "tool", tool_call_id: call.id, content: res, name: call.name });
      } else if (call.name === "query_skills_and_experiences") {
        const res = await querySkillsAndExperiencesTool.invoke(call);
        msgs.push({ role: "tool", tool_call_id: call.id, content: res, name: call.name });
      }
    }
    draftCompletion = await llmWithTools.invoke(msgs, config);
  }

  let draftContent = "";
  if (typeof draftCompletion.content === "string") {
    draftContent = draftCompletion.content;
  }

  return { workingExtendedCv: draftContent };
}

// Critique 1
async function critiqueTone(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "[Critique Tone] Evaluating braggadocio vs impact..." },
    config
  );
  const evalResult = await llm.invoke(
    [
      { role: "system", content: CRITIQUE_TONE_PROMPT },
      { role: "user", content: state.workingExtendedCv },
    ],
    config
  );
  return { critiqueFeedback: evalResult.content === "PASS" ? [] : [`Tone: ${evalResult.content}`] };
}

// Critique 2
async function critiqueTruth(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "[Critique Truth] Validating claims against vector embeddings..." },
    config
  );
  const truthLlm = llm.bindTools([searchGithubProjectsTool]);
  const msgs: any[] = [
    {
      role: "system",
      content: CRITIQUE_TRUTH_PROMPT,
    },
    { role: "user", content: state.workingExtendedCv },
  ];
  let evalResult = await truthLlm.invoke(msgs, config);

  if (evalResult.tool_calls && evalResult.tool_calls.length > 0) {
    msgs.push(evalResult);
    for (const call of evalResult.tool_calls) {
      if (call.name === "search_github_projects") {
        const res = await searchGithubProjectsTool.invoke(call);
        msgs.push({ role: "tool", tool_call_id: call.id, content: res, name: call.name });
      }
    }
    evalResult = await truthLlm.invoke(msgs, config);
  }

  // Evaluate if tool calls were made or what text it replied with
  const critiqueText =
    typeof evalResult.content === "string"
      ? evalResult.content
      : JSON.stringify(evalResult.content);
  return { critiqueFeedback: critiqueText.includes("PASS") ? [] : [`Truth: ${critiqueText}`] };
}

// Critique 3
async function critiqueSkills(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "[Critique Skills] Cross-referencing ontology..." },
    config
  );
  const skillLlm = llm.bindTools([querySkillsAndExperiencesTool]);
  const msgs: any[] = [
    {
      role: "system",
      content: CRITIQUE_SKILLS_PROMPT,
    },
    { role: "user", content: state.workingExtendedCv },
  ];
  let evalResult = await skillLlm.invoke(msgs, config);

  if (evalResult.tool_calls && evalResult.tool_calls.length > 0) {
    msgs.push(evalResult);
    for (const call of evalResult.tool_calls) {
      if (call.name === "query_skills_and_experiences") {
        const res = await querySkillsAndExperiencesTool.invoke(call);
        msgs.push({ role: "tool", tool_call_id: call.id, content: res, name: call.name });
      }
    }
    evalResult = await skillLlm.invoke(msgs, config);
  }
  const critiqueText =
    typeof evalResult.content === "string"
      ? evalResult.content
      : JSON.stringify(evalResult.content);
  return { critiqueFeedback: critiqueText.includes("PASS") ? [] : [`Skills: ${critiqueText}`] };
}

// Critique 4
async function critiqueProjects(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "[Critique Projects] Checking repository mappings..." },
    config
  );
  const evalResult = await llm.invoke(
    [
      { role: "system", content: CRITIQUE_PROJECTS_PROMPT },
      { role: "user", content: state.workingExtendedCv },
    ],
    config
  );
  return {
    critiqueFeedback: evalResult.content === "PASS" ? [] : [`Projects: ${evalResult.content}`],
  };
}

// Critique 5
async function critiqueExperiences(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent(
    "progress",
    { msg: "[Critique Experiences] Asserting timeline continuity..." },
    config
  );
  const evalResult = await llm.invoke(
    [
      { role: "system", content: CRITIQUE_EXPERIENCES_PROMPT },
      { role: "user", content: state.workingExtendedCv },
    ],
    config
  );
  return {
    critiqueFeedback: evalResult.content === "PASS" ? [] : [`Experiences: ${evalResult.content}`],
  };
}

async function consolidateCV(state: typeof StateAnnotation.State, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Consolidating 5-Phase critiques..." }, config);
  if (state.critiqueFeedback.length > 0) {
    // Redraft
    await dispatchCustomEvent(
      "progress",
      { msg: `Found ${state.critiqueFeedback.length} critique issues. Repairing...` },
      config
    );
    const fixed = await llm.invoke(
      [
        {
          role: "system",
          content: `${CRITIQUE_CONSOLIDATOR_PROMPT}\n<critiques_list>\n${state.critiqueFeedback.join("\n")}\n</critiques_list>`,
        },
        { role: "user", content: state.workingExtendedCv },
      ],
      config
    );

    const fixedContent =
      typeof fixed.content === "string" ? fixed.content : state.workingExtendedCv;

    // Return fixed CV and clear critiques
    return {
      workingExtendedCv: fixedContent,
      critiqueFeedback: [],
      messages: [
        { role: "assistant", content: "I have updated the CV based on multiple critique phases." },
      ],
    };
  }

  return {
    messages: [
      {
        role: "assistant",
        content:
          "I have finalized the CV iteration and it passes all 5 critique validation stages.",
      },
    ],
  };
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("Draft_CV", draftCV)
  .addNode("Critique_Tone", critiqueTone)
  .addNode("Critique_Truth", critiqueTruth)
  .addNode("Critique_Skills", critiqueSkills)
  .addNode("Critique_Projects", critiqueProjects)
  .addNode("Critique_Experiences", critiqueExperiences)
  .addNode("Consolidate_Feedback", consolidateCV)

  // Fork
  .addEdge(START, "Draft_CV")
  .addEdge("Draft_CV", "Critique_Tone")
  .addEdge("Draft_CV", "Critique_Truth")
  .addEdge("Draft_CV", "Critique_Skills")
  .addEdge("Draft_CV", "Critique_Projects")
  .addEdge("Draft_CV", "Critique_Experiences")

  // Join
  .addEdge("Critique_Tone", "Consolidate_Feedback")
  .addEdge("Critique_Truth", "Consolidate_Feedback")
  .addEdge("Critique_Skills", "Consolidate_Feedback")
  .addEdge("Critique_Projects", "Consolidate_Feedback")
  .addEdge("Critique_Experiences", "Consolidate_Feedback")

  .addEdge("Consolidate_Feedback", END);

export const improverSubGraph = workflow.compile();
