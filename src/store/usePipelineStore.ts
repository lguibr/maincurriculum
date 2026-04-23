import { create } from "zustand";

export interface SubagentStreamInterface {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  content: string;
}

export interface PipelineState {
  isRunning: boolean;
  setIsRunning: (val: boolean) => void;
  logs: string[];
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
}

export const usePipelineStore = create<PipelineState>((set) => ({
  isRunning: false,
  setIsRunning: (val) => set({ isRunning: val }),
  logs: [],
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
}));
