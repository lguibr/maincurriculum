import { StateGraph, START, END } from "@langchain/langgraph";
import { StateAnnotation, ProfileGraphState } from "./state";
import { persisterNode } from "./nodes/persister";
import { ingestionSubGraph } from "./subgraphs/ingestion";
import { interviewerSubGraph } from "./subgraphs/interviewer";
import { improverSubGraph } from "./subgraphs/improver";

async function supervisorNode(state: typeof StateAnnotation.State) {
  // Check if we have db writes pending from a previous cycle that Supervisor happened to intercept (unlikely due to routing, but safe)
  if (state.pendingDbWrites && state.pendingDbWrites.length > 0) {
    return {};
  }

  // Logic based Routing (can also use LLM for complex routing)
  if (!state.currentPhase) {
    return { currentPhase: "Initialize", nextAgent: "IngestionAgent" };
  }

  if (state.githubHandle && (!state.repositories || state.repositories.length === 0)) {
    return { nextAgent: "IngestionAgent" };
  }

  // Master CV Improvements
  if (state.currentPhase === "Improver") {
    return { nextAgent: "ImproverAgent" };
  }

  // Interview flow
  if (
    state.missingCount !== 0 ||
    (state.interviewHistory &&
      state.interviewHistory.length > 0 &&
      !state.interviewHistory[state.interviewHistory.length - 1]?.answer)
  ) {
    return { nextAgent: "InterviewerAgent" };
  }

  return { nextAgent: "END" };
}

function supervisorRouter(state: typeof StateAnnotation.State) {
  if (state.pendingDbWrites && state.pendingDbWrites.length > 0) {
    return "Persister";
  }
  if (state.nextAgent === "IngestionAgent") return "IngestionAgent";
  if (state.nextAgent === "InterviewerAgent") return "InterviewerAgent";
  if (state.nextAgent === "ImproverAgent") return "ImproverAgent";
  return END;
}

function subGraphRouter(state: typeof StateAnnotation.State) {
  // If a subgraph generated db writes, route to Persister before returning to Supervisor
  if (state.pendingDbWrites && state.pendingDbWrites.length > 0) {
    return "Persister";
  }
  return "Supervisor";
}

function persisterRouter(state: typeof StateAnnotation.State) {
  // After persisting, always return to Supervisor to re-evaluate state
  return "Supervisor";
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("Supervisor", supervisorNode)
  .addNode("IngestionAgent", ingestionSubGraph)
  .addNode("InterviewerAgent", interviewerSubGraph)
  .addNode("ImproverAgent", improverSubGraph)
  .addNode("Persister", persisterNode)

  .addEdge(START, "Supervisor")
  .addConditionalEdges("Supervisor", supervisorRouter, {
    Persister: "Persister",
    IngestionAgent: "IngestionAgent",
    InterviewerAgent: "InterviewerAgent",
    ImproverAgent: "ImproverAgent",
    [END]: END,
  })
  .addConditionalEdges("IngestionAgent", subGraphRouter, {
    Persister: "Persister",
    Supervisor: "Supervisor",
  })
  .addConditionalEdges("InterviewerAgent", subGraphRouter, {
    Persister: "Persister",
    Supervisor: "Supervisor",
  })
  .addConditionalEdges("ImproverAgent", subGraphRouter, {
    Persister: "Persister",
    Supervisor: "Supervisor",
  })
  .addConditionalEdges("Persister", persisterRouter, {
    Supervisor: "Supervisor",
  });

export const appGraph = workflow.compile();
