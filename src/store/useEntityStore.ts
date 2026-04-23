import { create } from "zustand";

export interface RepoProgress {
  phase: string;
  progress: number;
  currentPhaseProgress: number;
  timeStarted?: number;
  etaSeconds?: number;
}

export interface EntityState {
  targetRepos: string[];
  reposProgress: Record<string, RepoProgress>;
  knowledgeBaseTree: string[];
  entities: null | { skills: any[]; experiences: any[]; projects: any[]; educations: any[] };

  setEntityState: (state: Partial<EntityState>) => void;
}

export const useEntityStore = create<EntityState>((set) => ({
  targetRepos: [],
  reposProgress: {},
  knowledgeBaseTree: [],
  entities: null,

  setEntityState: (state) => set(state),
}));
