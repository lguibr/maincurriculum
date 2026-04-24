import { create } from "zustand";

export interface ProfileState {
  githubUsername: string;
  setGithubUsername: (val: string) => void;
  githubAvatarUrl: string;
  setGithubAvatarUrl: (val: string) => void;
  githubBio: string;
  setGithubBio: (val: string) => void;
  baseCv: string;
  setBaseCv: (val: string) => void;
  cvViewMode: "raw" | "preview";
  setCvViewMode: (mode: "raw" | "preview") => void;

  extendedCv: string;
  setExtendedCv: (val: string) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  githubUsername: "",
  setGithubUsername: (val) => set({ githubUsername: val }),
  githubAvatarUrl: "",
  setGithubAvatarUrl: (val) => set({ githubAvatarUrl: val }),
  githubBio: "",
  setGithubBio: (val) => set({ githubBio: val }),
  baseCv:
    "<!-- \n  Paste your Markdown Curriculum here...\n  (Click anywhere in this box to edit!)\n-->\n\n",
  setBaseCv: (val) => set({ baseCv: val }),
  cvViewMode: "raw",
  setCvViewMode: (mode) => set({ cvViewMode: mode }),

  extendedCv: "",
  setExtendedCv: (val) => set({ extendedCv: val }),
}));
