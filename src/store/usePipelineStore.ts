import { create } from "zustand";

export interface SubagentStreamInterface {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  content: string;
}

export interface InferenceLog {
  id: string;
  timestamp: number;
  model: string;
  prompt: string;
  response: string;
}

export interface PipelineState {
  isRunning: boolean;
  setIsRunning: (val: boolean) => void;
  logs: string[];
  inferenceLogs: InferenceLog[];
  progress: number;
  activeNodes: string[];
  currentPhase: string;
  isWizardComplete: boolean;
  langgraphEvents: Record<string, unknown>[];
  langgraphValues: Record<string, unknown>;
  subagents: Record<string, SubagentStreamInterface>;

  // Setters
  setIsWizardComplete: (val: boolean) => void;
  setPipelineState: (state: Partial<PipelineState>) => void;
  addLog: (log: string) => void;
  addInferenceLog: (log: Omit<InferenceLog, "id" | "timestamp">) => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  isRunning: false,
  setIsRunning: (val) => set({ isRunning: val }),
  logs: [],
  inferenceLogs: [],
  progress: 0,
  activeNodes: [],
  currentPhase: "Idle",
  isWizardComplete: false,
  langgraphEvents: [],
  langgraphValues: {},
  subagents: {},

  setIsWizardComplete: (val) => set({ isWizardComplete: val }),
  setPipelineState: (state) => set(state),
  addLog: (log) => set((s) => ({ logs: [...s.logs, log] })),
  addInferenceLog: (log) => set((s) => ({
    inferenceLogs: [
      ...s.inferenceLogs,
      { ...log, id: Math.random().toString(36).substring(7), timestamp: Date.now() }
    ]
  })),
}));
