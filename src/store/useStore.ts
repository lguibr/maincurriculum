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
  interviewHistory: [],
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
         set(s => ({ currentPhase: "Embedding Repositories", logs: [...s.logs, "Fetching Repository Trees from Github..."] }));
         
         const BATCH_SIZE = 2; // Reduced batch size due to heavy file fetching
         for (let i = 0; i < selectedRepos.length; i += BATCH_SIZE) {
             const batch = selectedRepos.slice(i, i + BATCH_SIZE);
             
             await Promise.all(batch.map(async (repo) => {
                 set(s => ({ logs: [...s.logs, `Extracting codebase for ${repo.name}...`] }));

                 // 1. Fetch entire codebase recursively
                 const token = localStorage.getItem("GITHUB_TOKEN");
                 const headers: any = { Accept: "application/vnd.github.v3+json" };
                 if (token) headers.Authorization = "Bearer " + token;

                 let codebaseStr = `Repository: ${repo.name}\nDescription: ${repo.description || ""}\n\n`;
                 try {
                     const treeRes = await fetch(`https://api.github.com/repos/${repo.name}/git/trees/main?recursive=1`, { headers });
                     let treeData = await treeRes.json();
                     if (treeRes.status === 404 || treeData.message?.includes("Not Found")) {
                         const masterRes = await fetch(`https://api.github.com/repos/${repo.name}/git/trees/master?recursive=1`, { headers });
                         treeData = await masterRes.json();
                     }

                     if (Array.isArray(treeData.tree)) {
                         const exclusions = ['.png', '.jpg', '.jpeg', '.gif', '.mp4', '.webp', '.lock', 'node_modules/', 'dist/', 'build/', '.git', 'package-lock.json', 'yarn.lock', '.svg', '.min.js'];
                         let files = treeData.tree.filter((t: any) => t.type === "blob" && !exclusions.some(ex => t.path.toLowerCase().includes(ex)));
                         
                         // Limit to top 15 files to avoid API rate limits & extreme token counts
                         files = files.slice(0, 15);

                         for (const file of files) {
                             let text = "";
                             const fileHeaders = { ...headers, Accept: "application/vnd.github.v3.raw" };
                             let fileRes = await fetch(`https://api.github.com/repos/${repo.name}/contents/${file.path}?ref=main`, { headers: fileHeaders });
                             if (fileRes.ok) {
                                 text = await fileRes.text();
                             } else {
                                 fileRes = await fetch(`https://api.github.com/repos/${repo.name}/contents/${file.path}?ref=master`, { headers: fileHeaders });
                                 if (fileRes.ok) text = await fileRes.text();
                             }
                             if (text) {
                                 codebaseStr += `\n--- FILE: ${file.path} ---\n${text.substring(0, 3000)}\n`; 
                             }
                         }
                     }
                 } catch(e) {
                     console.warn(`Failed codebase fetch for ${repo.name}`, e);
                 }

                 // 2. Extract Skills and Save Project and Embedding
                 const embText = codebaseStr.substring(0, 8000);
                 const proj: any = { id: repo.name, repo_name: repo.name, description: repo.description || "", raw_text: codebaseStr, skills: [] };

                 try {
                     const skillsPrompt = `List all major technical skills, languages, libraries, and frameworks used in this codebase. Output STRICT JSON: {"skills": [{"id": "uuid", "name": "React"}]}.\nCodebase:\n${embText}`;
                     const result = await GeminiInference.generate(skillsPrompt, "json", "gemini-3.0-flash-latest");
                     const jsonMatch = result.match(/\{[\s\S]*\}/);
                     if (jsonMatch) {
                         const parsed = JSON.parse(jsonMatch[0]);
                         if (parsed.skills) {
                             proj.skills = parsed.skills;
                             for (const sk of parsed.skills) await dbOps.saveSkill(sk);
                         }
                     }
                 } catch (e) {
                     console.warn("Failed to extract skills from project", repo.name, e);
                 }

                 await dbOps.saveProject(proj);
                 
                 // 3. Generate Embedding (Chunk 1) - Warning: using whole codebase may exceed embedding limits if massive, but Gemini supports up to 10k+ typically.
                 try {
                   const emb = await GeminiInference.getEmbedding(embText);
                      
                   await dbOps.saveEmbedding({
                       id: repo.name + "_chunk1",
                       project_id: repo.name,
                       chunk_index: 0,
                       chunk_text: embText,
                       embedding: emb
                   });
                   set(s => ({ logs: [...s.logs, `Embedded codebase ${repo.name}`] }));
                 } catch(e) {
                   console.error(`Embedding failed for ${repo.name}`, e);
                   set(s => ({ logs: [...s.logs, `Embedding failed for ${repo.name}`] }));
                 }
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
    set({ isRunning: true, currentPhase: "Extracting Entities", interviewHistory: [] });
    try {
      const parsePrompt = `Extract ALL technical skills and work experiences from the following CV. Do not limit the count. Output as strict JSON formatted like: {"skills": [{"id": "uuid", "name": "Python", "type": "Language"}], "experiences": [{"id": "uuid", "company":"X", "role":"Dev", "start_date":"2020", "end_date":"2021", "description":"Did stuff", "skills":[]}]}.\nCV:\n${cvText}`;
      
      let extractModel = "gemini-3.0-flash-latest"; // default
      const { cloudTier } = get();
      if (cloudTier === "smart") extractModel = "gemini-3.0-flash-latest";
      if (cloudTier === "balanced") extractModel = "gemini-3.0-flash-lite-latest";
      if (cloudTier === "widely") extractModel = "gemini-3.0-flash-lite-latest";

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
    const state = get();
    const prevQ = state.currentQuestion || "";
    const newHistory = [...state.interviewHistory, { q: prevQ, a: answer }];
    
    // Clear question to trigger loading state in UI
    set({ currentQuestion: null, interviewHistory: newHistory, currentPhase: `Interview ${newHistory.length + 1}/3` });

    try {
        let extractModel = "gemini-3.0-flash-latest"; 
        if (state.cloudTier === "smart") extractModel = "gemini-3.0-flash-latest";
        if (state.cloudTier === "balanced") extractModel = "gemini-3.0-flash-lite-latest";
        if (state.cloudTier === "widely") extractModel = "gemini-3.0-flash-lite-latest";

        if (newHistory.length < 3) {
            // Generate next question
            const historyText = newHistory.map((h, i) => `Q${i+1}: ${h.q}\nA${i+1}: ${h.a}`).join('\n\n');
            const interviewPrompt = `Based on this CV:\n${state.baseCv}\n\nAnd the previous Interview Q&A:\n${historyText}\n\nGenerate ONE highly technical, deep-dive interview question. Do not repeat previous questions. Provide only the question text.`;
            const nextQuestion = await GeminiInference.generate(interviewPrompt, "text", extractModel);
            set({ currentQuestion: nextQuestion });
        } else {
            // End of interview. Generate Extended CV!
            set({ currentPhase: "Generating Final CV" });
            const historyText = newHistory.map((h, i) => `Q${i+1}: ${h.q}\nA${i+1}: ${h.a}`).join('\n\n');
            await get().startImprover(`The candidate had a technical interview answering 3 questions deeply about their background. Incorporate this deeper knowledge into their CV implicitly by strengthening their bullet points or summary:\n\n${historyText}`, state.baseCv);
            
            set({ currentPhase: "Complete", isWizardComplete: true });
        }
    } catch(e) {
        console.error("Interview flow error:", e);
        // Revert on error tightly
        set({ currentQuestion: prevQ, interviewHistory: state.interviewHistory, currentPhase: state.currentPhase }); 
    }
  },

  startInterview: async (baseCv: string) => {
    // Subsumed by startAgent
  },

  startImprover: async (message: string, extendedCv: string) => {
    set({ isRunning: true, logs: ["Starting Improver..."] });
    try {
        const { cloudTier } = get();
        const prompt = `Improve the following CV using context: ${message}\nCV:\n${extendedCv}`;
        
        let improveModel = "gemini-3.0-pro-latest";
        if (cloudTier === "smart") improveModel = "gemini-3.0-pro-latest";
        if (cloudTier === "balanced") improveModel = "gemini-3.0-flash-latest";
        if (cloudTier === "widely") improveModel = "gemini-3.0-pro-latest";
        
        const newCv = await GeminiInference.generate(prompt, "text", improveModel);
          
        set(s => ({ isRunning: false, logs: [...s.logs, "Improver generation complete."] }));
        console.log("Improved CV:", newCv);
        
        // Save to database
        const prof = await dbOps.getProfile("main");
        if (prof) {
            prof.extended_cv = newCv;
            prof.interview_history = get().interviewHistory;
            await dbOps.saveProfile(prof);
        }
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
