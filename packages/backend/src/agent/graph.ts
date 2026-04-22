import { StateGraph, START, END } from "@langchain/langgraph";
import { StateAnnotation } from "./state";
import { MemorySaver } from "@langchain/langgraph";

// Nodes
import { persisterNode } from "./nodes/persister";
import { FetchRepositories } from "./nodes/FetchRepositories";
import { EmbedAndSummarize } from "./nodes/EmbedAndSummarize";
import { ExtractEntities } from "./nodes/ExtractEntities";
import { EvaluateCompleteness } from "./nodes/EvaluateCompleteness";
import { ImproveCV } from "./nodes/ImproveCV";
import { InterviewInterrupt } from "./nodes/InterviewInterrupt";

export async function InitializeProfile(state: typeof StateAnnotation.State) {
  if (!state.userProfileId && state.githubHandle) {
    const writes = [
      { 
        targetTable: "user_profiles", 
        action: "insert" as const, 
        data: { github_handle: state.githubHandle || "", base_cv: state.baseCv || "" } 
      }
    ];
    return { currentPhase: "Initialize", pendingDbWrites: writes };
  }
  return {};
}

const workflow = new StateGraph(StateAnnotation)
  .addNode("InitializeProfile", InitializeProfile)
  .addNode("PersisterInit", persisterNode)
  .addNode("FetchRepositories", FetchRepositories)
  .addNode("EmbedAndSummarize", EmbedAndSummarize)
  .addNode("PersisterIngestion", persisterNode)
  .addNode("ExtractEntities", ExtractEntities)
  .addNode("EvaluateCompleteness", EvaluateCompleteness)
  .addNode("ImproveCV", ImproveCV)
  .addNode("PersisterImprovement", persisterNode)
  .addNode("InterviewInterrupt", InterviewInterrupt)

  // Linear Flow Connections
  .addEdge(START, "InitializeProfile")
  .addEdge("InitializeProfile", "PersisterInit")
  .addEdge("PersisterInit", "FetchRepositories")
  .addEdge("FetchRepositories", "EmbedAndSummarize")
  .addEdge("EmbedAndSummarize", "PersisterIngestion")
  .addEdge("PersisterIngestion", "ExtractEntities")
  .addEdge("ExtractEntities", "EvaluateCompleteness")
  .addEdge("EvaluateCompleteness", "ImproveCV")
  .addEdge("ImproveCV", "PersisterImprovement")
  .addEdge("PersisterImprovement", "InterviewInterrupt")
  .addEdge("InterviewInterrupt", END);

const checkpointer = new MemorySaver();
export const appGraph = workflow.compile({ checkpointer });
