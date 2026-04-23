import { create } from "zustand";
import { AppState } from "./types";
import { dbOps, initDB } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";

export const useStore = create<AppState>((set, get) => ({
  githubUsername: "",
  setGithubUsername: (val) => set({ githubUsername: val }),
  baseCv: "<!-- \n  Paste your Markdown Curriculum here...\n  (Click anywhere in this box to edit!)\n-->\n\n",
  setBaseCv: (val) => set({ baseCv: val }),
  cvViewMode: "raw",
  setCvViewMode: (mode) => set({ cvViewMode: mode }),
  cloudTier: "balanced",
  setCloudTier: (tier) => set({ cloudTier: tier }),

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

      // 2. LLMs are cloud-based now, no heavy WebGPU loading needed
      set(s => ({ logs: [...s.logs, `Preparing Pipeline... (Tier: ${get().cloudTier})`] }));
      
      // CV Entity Extraction was moved to `processCvAndInterview` 
      // which happens *after* the user provides their CV in Phase 3.

      // Process Github Repositories concurrently if selected
      if (selectedRepos && selectedRepos.length > 0) {
         set(s => ({ currentPhase: "Embedding Repositories", logs: [...s.logs, "Fetching Repository Text from Github..."] }));
         
         const BATCH_SIZE = 5;
         for (let i = 0; i < selectedRepos.length; i += BATCH_SIZE) {
             const batch = selectedRepos.slice(i, i + BATCH_SIZE);
             
             await Promise.all(batch.map(async (repo) => {
                 const proj = { id: repo.name, repo_name: repo.name, raw_text: repo.description || "", skills: [] };
                 await dbOps.saveProject(proj);
                 
                 const emb = await GeminiInference.getEmbedding(repo.description || repo.name);
                    
                 await dbOps.saveEmbedding({
                     id: repo.name + "_chunk1",
                     project_id: repo.name,
                     chunk_index: 0,
                     chunk_text: repo.description || "",
                     embedding: emb
                 });
                 set(s => ({ logs: [...s.logs, `Embedded repository ${repo.name}`] }));
             }));
         }
      }

      set(s => ({ logs: [...s.logs, "Ingestion Pipeline Complete!"], progress: 100, isRunning: false, currentPhase: "Complete", isWizardComplete: true }));
      await get().fetchEntities();

    } catch (e: any) {
      console.error(e);
      set(s => ({ isRunning: false, logs: [...s.logs, "Error: " + e.message] }));
    }
  },

  processCvAndInterview: async (cvText: string) => {
    set({ isRunning: true, currentPhase: "Extracting Entities" });
    try {
      const parsePrompt = `Extract ALL technical skills and work experiences from the following CV. Do not limit the count. Output as strict JSON formatted like: {"skills": [{"id": "uuid", "name": "Python", "type": "Language"}], "experiences": [{"id": "uuid", "company":"X", "role":"Dev", "start_date":"2020", "end_date":"2021", "description":"Did stuff", "skills":[]}]}.\nCV:\n${cvText}`;
      
      let extractModel = "gemini-flash-latest"; // default
      const { cloudTier } = get();
      if (cloudTier === "smart") extractModel = "gemini-flash-latest";
      if (cloudTier === "balanced") extractModel = "gemini-flash-lite-latest";
      if (cloudTier === "widely") extractModel = "gemini-flash-lite-latest";

      const llmResult = await GeminiInference.generate(parsePrompt, "json", extractModel);
      
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
          console.warn("Failed to parse extracted JSON from Gemini", e);
      }

      // Generate the first interview question
      const interviewPrompt = `Based on this CV:\n${cvText}\n\nGenerate ONE highly technical, deep-dive interview question about system architecture or their specific experiences. Provide only the question text.`;
      const firstQuestion = await GeminiInference.generate(interviewPrompt, "text", extractModel);

      set({ currentPhase: "Interview", currentQuestion: firstQuestion });
      await get().fetchEntities();
    } catch(e) {
      console.error(e);
    }
    set({ isRunning: false });
  },

  submitAnswer: async (answer: string) => {
    // Deprecated for now
    set({ currentQuestion: null });
  },

  startInterview: async (baseCv: string) => {
    // Subsumed by startAgent
  },

  startImprover: async (message: string, extendedCv: string) => {
    set({ isRunning: true, logs: ["Starting Improver..."] });
    try {
        const { cloudTier } = get();
        const prompt = `Improve the following CV using context: ${message}\nCV:\n${extendedCv}`;
        
        let improveModel = "gemini-pro-latest";
        if (cloudTier === "smart") improveModel = "gemini-pro-latest";
        if (cloudTier === "balanced") improveModel = "gemini-flash-latest";
        if (cloudTier === "widely") improveModel = "gemini-pro-latest";
        
        const newCv = await GeminiInference.generate(prompt, "text", improveModel);
          
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
