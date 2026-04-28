import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface InterviewState {
  currentQuestion: string | null;
  interviewHistory: { q: string; a: string }[];

  setInterviewState: (state: Partial<InterviewState>) => void;
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set) => ({
      currentQuestion: null,
      interviewHistory: [],
      setInterviewState: (state) => set(state),
    }),
    {
      name: "orchestrator-interview-storage",
    }
  )
);
