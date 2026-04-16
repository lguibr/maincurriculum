import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

// Action payloads for the Persister node to execute
export interface DbDirective {
  targetTable: 'user_profiles' | 'cv_versions' | 'projects_raw_text' | 'project_embeddings';
  action: 'insert' | 'update' | 'upsert';
  data: any;
  whereClause?: any; // e.g. { id: 1 }
}

export interface ProfileGraphState {
  githubUrl: string;
  baseCv: string;
  githubHandle: string;
  userProfileId: number | null;
  
  // Repositories & Processing Tracking
  repositories: any[]; 
  ingestedProjects: number; 
  
  // Sub-Agent and Orchestration State
  nextAgent: string | null;
  pendingDbWrites: DbDirective[];
  
  // Interview tracking
  knowledgeGaps: string[]; 
  messages: BaseMessage[]; 
  finalSQLDemographics: string;
  missingCount: number;
  missingInfoList: string[];
  interviewHistory: { question: string; answer: string }[];
  
  // General UI Display
  currentPhase: string;
  wizardCompleted: boolean;
}

export const StateAnnotation = Annotation.Root({
  githubUrl: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "",
  }),
  baseCv: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "",
  }),
  githubHandle: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "",
  }),
  userProfileId: Annotation<number | null>({
    reducer: (a, b) => b || a,
    default: () => null,
  }),
  repositories: Annotation<any[]>({
    reducer: (a, b) => b || a, // Reset or overwrite
    default: () => [],
  }),
  ingestedProjects: Annotation<number>({
    reducer: (a, b) => a + (b || 0),
    default: () => 0,
  }),
  
  // --- New Sub-Agent Orchestration State ---
  nextAgent: Annotation<string | null>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => null,
  }),
  pendingDbWrites: Annotation<DbDirective[]>({
    reducer: (state, update) => {
      if (update && update.length === 0) return [];
      return state.concat(update || []);
    },
    default: () => [],
  }),
  
  knowledgeGaps: Annotation<string[]>({
    reducer: (a, b) => b || a, // Simple override
    default: () => [],
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (a, b) => a.concat(b || []),
    default: () => [],
  }),
  finalSQLDemographics: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "",
  }),
  missingCount: Annotation<number>({
    reducer: (a, b) => b !== undefined ? b : a,
    default: () => 0,
  }),
  missingInfoList: Annotation<string[]>({
    reducer: (a, b) => b || a,
    default: () => [],
  }),
  interviewHistory: Annotation<{ question: string; answer: string }[]>({
    reducer: (a, b) => b || a,
    default: () => [],
  }),
  currentPhase: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "Initializing System...",
  }),
  wizardCompleted: Annotation<boolean>({
    reducer: (a, b) => b || a,
    default: () => false,
  })
});
