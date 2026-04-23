import { create } from "zustand";

export interface InterviewState {
  currentQuestion: string | null;
  interviewHistory: { q: string; a: string }[];

  setInterviewState: (state: Partial<InterviewState>) => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  currentQuestion: null,
  interviewHistory: [],
  setInterviewState: (state) => set(state),
}));
