import { StateGraph, START, END } from "@langchain/langgraph";
import { ProfileGraphState, StateAnnotation } from "./state";
import { fetchGithub, cloneAndConcat, generateEmbeddings } from "./nodes/ingestor";
import { 
  buildOntology,
  analyzeSkills, 
  skillsInterview, 
  analyzeEducation, 
  educationInterview, 
  analyzeExperience, 
  experienceInterview,
  compileExtendedCV
} from "./nodes/interviewer";

const workflow = new StateGraph(StateAnnotation)
  .addNode("Fetch_Github", fetchGithub)
  .addNode("Clone_And_Concat", cloneAndConcat)
  .addNode("Generate_Embeddings", generateEmbeddings)
  
  // Phase 1
  .addNode("Build_Ontology", buildOntology)
  .addNode("Analyze_Skills", analyzeSkills)
  .addNode("Skills_Interview", skillsInterview)
  
  // Phase 2
  .addNode("Analyze_Education", analyzeEducation)
  .addNode("Education_Interview", educationInterview)
  
  // Phase 3
  .addNode("Analyze_Experience", analyzeExperience)
  .addNode("Experience_Interview", experienceInterview)
  .addNode("Compile_Extended_CV", compileExtendedCV)

  .addEdge(START, "Fetch_Github")
  .addEdge("Fetch_Github", "Clone_And_Concat")
  .addEdge("Clone_And_Concat", "Generate_Embeddings")
  .addEdge("Generate_Embeddings", "Build_Ontology")
  .addEdge("Build_Ontology", "Analyze_Skills")
  .addEdge("Analyze_Skills", "Skills_Interview")
  .addEdge("Analyze_Education", "Education_Interview")
  .addEdge("Analyze_Experience", "Experience_Interview");

// If they gave an answer but the LLM still needs more info, we loop, else advance
workflow.addConditionalEdges(
  "Skills_Interview",
  (state: ProfileGraphState) => {
      return state.knowledgeGaps.length > 0 ? "Analyze_Skills" : "Analyze_Education";
  }
);

workflow.addConditionalEdges(
  "Education_Interview",
  (state: ProfileGraphState) => state.knowledgeGaps.length > 0 ? "Analyze_Education" : "Analyze_Experience"
);

workflow.addConditionalEdges(
  "Experience_Interview",
  (state: ProfileGraphState) => state.knowledgeGaps.length > 0 ? "Analyze_Experience" : "Compile_Extended_CV"
);

workflow.addEdge("Compile_Extended_CV", END);

import { MemorySaver } from "@langchain/langgraph";
export const profileIngestionGraph = workflow.compile({
  checkpointer: new MemorySaver()
});
