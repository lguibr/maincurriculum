export interface SSEMessage {
  type: string;
  message?: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface SubagentStreamInterface {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  content: string;
}

export interface AppState {
  // Input State
  githubUsername: string;
  setGithubUsername: (val: string) => void;
  baseCv: string;
  setBaseCv: (val: string) => void;
  cvViewMode: "raw" | "preview";
  setCvViewMode: (mode: "raw" | "preview") => void;

  extendedCv: string;
  setExtendedCv: (val: string) => void;

  // Pipeline State
  isRunning: boolean;
  logs: string[];
  progress: number;
  activeNodes: string[];
  currentPhase: string;
  currentQuestion: string | null;
  interviewHistory: { q: string; a: string; type?: "critique" | "interview" }[];
  isWizardComplete: boolean;
  langgraphEvents: Record<string, unknown>[];
  langgraphValues: Record<string, unknown>;
  subagents: Record<string, SubagentStreamInterface>;
  targetRepos: string[];
  reposProgress: Record<
    string,
    {
      phase: string;
      progress: number;
      currentPhaseProgress: number;
      timeStarted?: number;
      etaSeconds?: number;
    }
  >;
  knowledgeBaseTree: string[];
  entities: null | { skills: any[]; experiences: any[]; projects: any[] };

  // Actions
  setupSseHandler: () => void;
  startAgent: (selectedRepos?: any[]) => Promise<void>;
  startInterview: (baseCv: string) => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  startImprover: (message: string, extendedCv: string) => Promise<void>;
  processCvAndInterview: (cvText: string) => Promise<void>;
  setIsRunning: (val: boolean) => void;
  setIsWizardComplete: (val: boolean) => void;
  fetchEntities: () => Promise<void>;
  deleteEntity: (type: "skill" | "experience", id: string | number) => Promise<void>;
}
