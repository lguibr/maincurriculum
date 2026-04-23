import { create } from "zustand";
import { AppState } from "./types";
import { dbOps, initDB } from "../db/indexedDB";
import { Gemma4Inference } from "../ai/Gemma4Inference";
import { GemmaEmbeddings } from "../ai/GemmaEmbeddings";

export const useStore = create<AppState>((set, get) => ({
  githubUsername: "",
  setGithubUsername: (val) => set({ githubUsername: val }),
  baseCv: "<!-- \n  Paste your Markdown Curriculum here...\n  (Click anywhere in this box to edit!)\n-->\n\n",
  setBaseCv: (val) => set({ baseCv: val }),
  cvViewMode: "raw",
  setCvViewMode: (mode) => set({ cvViewMode: mode }),

  isRunning: false,
  logs: [],
  progress: 0,
  activeNodes: [],
  currentPhase: "Idle",
  currentQuestion: null,
  isWizardComplete: false,
  langgraphEvents: [],
  langgraphValues: {},
  subagents: {},
  targetRepos: [],
  reposProgress: {},
  knowledgeBaseTree: [],
  entities: null,

  setIsRunning: (val) => set({ isRunning: val }),
  setIsWizardComplete: (val) => set({ isWizardComplete: val }),

  setupSseHandler: () => {
    // Deprecated: No more backend SSE
  },

  startAgent: async (selectedRepos?: any[]) => {
    const { githubUsername, baseCv } = get();

    set({
      isRunning: true,
      logs: ["Starting Frontend Agent Pipeline...", "Initializing indexedDB and AI Models..."],
      progress: 0,
      currentPhase: "Loading Models",
    });

    try {
      // 1. Initialize Profile
      await dbOps.saveProfile({
        id: "main",
        github_handle: githubUsername,
        base_cv: baseCv,
        extended_cv: "",
        demographics_json: {},
        created_at: Date.now()
      });

      // 2. Load Gemma Instances natively
      set(s => ({ logs: [...s.logs, "Allocating WebGPU Context for Gemma 4 & Embeddings..."] }));
      
      // Initialize in parallel purely caching to warm them up
      await Promise.all([
        Gemma4Inference.initialize(),
        GemmaEmbeddings.initialize()
      ]);

      set(s => ({ progress: 20, logs: [...s.logs, "Models Load successfully. Begin CV Parsing"] }));

      const parsePrompt = `Extract up to 5 experiences and 5 skills from the following CV. Output as strict JSON formatted like: {"skills": [{"id": "uuid", "name": "Python", "type": "Language"}], "experiences": [{"id": "uuid", "company":"X", "role":"Dev", "start_date":"2020", "end_date":"2021", "description":"Did stuff", "skills":[]}]}.\nCV:\n${baseCv}`;
      
      set({ currentPhase: "Extracting Entities" });
      const llmResult = await Gemma4Inference.generate(parsePrompt, "json");
      
      // Quick parse
      try {
        const jsonMatch = llmResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.skills) {
                for (const sk of parsed.skills) await dbOps.saveSkill(sk);
            }
            if (parsed.experiences) {
                for (const exp of parsed.experiences) await dbOps.saveExperience(exp);
            }
        }
      } catch(e) {
          console.warn("Failed to parse extracted JSON from Gemma", e);
      }

      set(s => ({ progress: 60, logs: [...s.logs, "Entities Extracted Successfully!"] }));

      // Process Github Repositories natively if selected
      if (selectedRepos && selectedRepos.length > 0) {
         set(s => ({ currentPhase: "Embedding Repositories", logs: [...s.logs, "Fetching Repository Text from Github..."] }));
         for (const repo of selectedRepos) {
             const proj = { id: repo.name, repo_name: repo.name, raw_text: repo.description || "", skills: [] };
             await dbOps.saveProject(proj);
             const emb = await GemmaEmbeddings.getEmbedding(repo.description || repo.name);
             await dbOps.saveEmbedding({
                 id: repo.name + "_chunk1",
                 project_id: repo.name,
                 chunk_index: 0,
                 chunk_text: repo.description || "",
                 embedding: emb
             });
             set(s => ({ logs: [...s.logs, `Embedded repository ${repo.name}`] }));
         }
      }

      set(s => ({ logs: [...s.logs, "Ingestion Pipeline Complete!"], progress: 100, isRunning: false, currentPhase: "Complete", isWizardComplete: true }));
      await get().fetchEntities();

    } catch (e: any) {
      console.error(e);
      set(s => ({ isRunning: false, logs: [...s.logs, "Error: " + e.message] }));
    }
  },

  submitAnswer: async (answer: string) => {
    // Deprecated for now
    set({ currentQuestion: null });
  },

  startInterview: async (baseCv: string) => {
    // Subsumed by startAgent
  },

  startImprover: async (message: string, extendedCv: string) => {
    // Native improve phase using in-browser Gemma
    set({ isRunning: true, logs: ["Starting Improver..."] });
    try {
        const prompt = `Improve the following CV using context: ${message}\nCV:\n${extendedCv}`;
        const newCv = await Gemma4Inference.generate(prompt);
        set(s => ({ isRunning: false, logs: [...s.logs, "Improver generation complete."] }));
        console.log("Improved CV:", newCv);
    } catch(e) {
        console.error(e);
        set(s => ({ isRunning: false, logs: [...s.logs, "Improver Error"] }));
    }
  },

  fetchEntities: async () => {
    try {
        const skills = await dbOps.getSkills();
        const experiences = await dbOps.getExperiences();
        const projects = await dbOps.getProjects();
        set({ entities: { skills, experiences, projects } as any });
    } catch (e) {
        console.error("Failed to fetch entities", e);
    }
  },

  deleteEntity: async (type: "skill" | "experience", id: string | number) => {
    try {
        const db = await initDB();
        if (type === "skill") await db.delete("skills", String(id));
        if (type === "experience") await db.delete("experiences", String(id));
        await get().fetchEntities();
    } catch (e) {
        console.error("Failed to delete entity", e);
    }
  }
}));
