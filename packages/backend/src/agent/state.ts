import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export interface ProfileGraphState {
  githubUrl: string;
  baseCv: string;
  githubHandle: string;
  userProfileId: number | null;
  repositories: any[]; // List of rich Github repo metadata objects
  ingestedProjects: number; // Count of projects processed
  knowledgeGaps: string[]; // Generic gaps (pending removal)
  messages: BaseMessage[]; // Conversation history for the interview
  finalSQLDemographics: string;
  
  // Wizard State
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
    reducer: (a, b) => b || a,
    default: () => [],
  }),
  ingestedProjects: Annotation<number>({
    reducer: (a, b) => a + (b || 0),
    default: () => 0,
  }),
  knowledgeGaps: Annotation<string[]>({
    reducer: (a, b) => b || a,
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
  currentPhase: Annotation<string>({
    reducer: (a, b) => b || a,
    default: () => "Parsing Github...",
  }),
  wizardCompleted: Annotation<boolean>({
    reducer: (a, b) => b || a,
    default: () => false,
  })
});
