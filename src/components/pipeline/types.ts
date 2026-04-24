export interface PipelineNode {
  name: string;
  stateKey: string;
  label: string;
}

export const PIPELINE_NODES: PipelineNode[] = [
  { name: "IngestionAgent", stateKey: "ingestedProjects", label: "Repository Ingestion" },
  { name: "InterviewerAgent", stateKey: "finalSQLDemographics", label: "Profile Interview" },
  { name: "ImproverAgent", stateKey: "wizardCompleted", label: "CV Optimization" },
];
