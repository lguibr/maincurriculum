import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { useEntityStore } from "../store/useEntityStore";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";
import { fetchEntities } from "./entityActions";
import { fetchGithubCodebase } from "./githubHelpers";

export const startAgent = async (selectedRepos?: any[]) => {
  const { githubUsername, baseCv } = useProfileStore.getState();
  const { setPipelineState, addLog } = usePipelineStore.getState();

  setPipelineState({
    isRunning: true,
    progress: 0,
    currentPhase: "Loading Models",
  });
  addLog("Starting Frontend Agent Pipeline...");
  addLog("Initializing indexedDB and AI Models...");

  try {
    // 1. Initialize Profile
    await dbOps.saveProfile({
      id: "main",
      github_handle: githubUsername,
      base_cv: baseCv,
      extended_cv: "",
      demographics_json: {},
      created_at: Date.now(),
    });

    const { cloudTier } = useProfileStore.getState();
    addLog(`Preparing Pipeline... (Tier: ${cloudTier})`);

    // Process Github Repositories concurrently if selected
    if (selectedRepos && selectedRepos.length > 0) {
      setPipelineState({ currentPhase: "Embedding Repositories" });
      addLog("Fetching Repository Trees from Github...");

      const existingProjects = await dbOps.getProjects();
      const existingMap = new Map();
      for (const p of existingProjects) existingMap.set(p.repo_name, p);

      const targetReposToProcess: any[] = [];
      for (const repo of selectedRepos) {
         const existProj = existingMap.get(repo.name);
         let shouldUpdate = true;
         if (existProj && existProj.last_synced_at && repo.updatedAt) {
            const githubTs = new Date(repo.updatedAt).getTime();
            if (githubTs <= existProj.last_synced_at) {
               shouldUpdate = false;
            }
         }
         if (shouldUpdate) {
            targetReposToProcess.push(repo);
         }
      }

      for (const p of existingProjects) {
        if (!selectedRepos.some(r => r.name === p.repo_name)) {
            await dbOps.deleteProject(p.id);
            addLog(`Garbage collected orphaned project: ${p.repo_name}`);
        }
      }

      const targetRepoNames = selectedRepos.map(r => r.name);
      const initialProgress: any = {};
      targetRepoNames.forEach(name => {
         const isSkipped = !targetReposToProcess.some(t => t.name === name);
         initialProgress[name] = { 
           phase: isSkipped ? "Skipped (No Changes)" : "Pending...", 
           progress: isSkipped ? 100 : 0, 
           currentPhaseProgress: isSkipped ? 100 : 0 
         };
      });
      useEntityStore.getState().setEntityState({
         targetRepos: targetRepoNames,
         reposProgress: initialProgress
      });

      const updateRepoProgress = (name: string, phase: string, progress: number) => {
          const s = useEntityStore.getState();
          const curr = s.reposProgress[name] || { phase: "Pending...", progress: 0, currentPhaseProgress: 0 };
          s.setEntityState({ 
              reposProgress: { 
                  ...s.reposProgress, 
                  [name]: { ...curr, phase, progress, currentPhaseProgress: progress } 
              } 
          });
      };

      const BATCH_SIZE = 2;
      for (let i = 0; i < targetReposToProcess.length; i += BATCH_SIZE) {
        const batch = targetReposToProcess.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (repo) => {
            updateRepoProgress(repo.name, "Initializing Extraction...", 10);
            usePipelineStore.getState().addLog(`Extracting codebase for ${repo.name}...`);

            const token = localStorage.getItem("GITHUB_TOKEN");
            const headers: any = { Accept: "application/vnd.github.v3+json" };
            if (token) headers.Authorization = "Bearer " + token;

            let codebaseStr = await fetchGithubCodebase(repo.name, repo.description || "", headers, (msg, prog) => updateRepoProgress(repo.name, msg, prog));

            const embText = codebaseStr.substring(0, 8000);
            const proj: any = {
              id: repo.name,
              repo_name: repo.name,
              description: repo.description || "",
              raw_text: codebaseStr,
              start_date: repo.createdAt ? repo.createdAt.split('T')[0] : null,
              end_date: repo.updatedAt ? repo.updatedAt.split('T')[0] : null,
              skills: [],
              last_synced_at: Date.now(),
            };

            try {
              updateRepoProgress(repo.name, "Extracting LLM Skills...", 60);
              const skillsPrompt = `List all major technical skills, languages, libraries, and frameworks used in this codebase. Output STRICT JSON: {"skills": [{"id": "uuid", "name": "React"}]}.\nCodebase:\n${embText}`;
              const result = await GeminiInference.generate(
                skillsPrompt,
                "json",
                "gemini-flash-latest"
              );
              const jsonMatch = result.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.skills) {
                  proj.skills = parsed.skills;
                  for (const sk of parsed.skills) {
                    sk.id = sk.name.toLowerCase().trim().replace(/\s+/g, "-");
                    await dbOps.saveSkill(sk);
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to extract skills from project", repo.name, e);
            }

            await dbOps.saveProject(proj);

            try {
              updateRepoProgress(repo.name, "Generating Vector Embeddings...", 80);
              const emb = await GeminiInference.getEmbedding(embText);

              await dbOps.saveEmbedding({
                id: repo.name + "_chunk1",
                project_id: repo.name,
                chunk_index: 0,
                chunk_text: embText,
                embedding: emb,
              });
              updateRepoProgress(repo.name, "Complete", 100);
              usePipelineStore.getState().addLog(`Embedded codebase ${repo.name}`);
            } catch (e) {
              console.error(`Embedding failed for ${repo.name}`, e);
              usePipelineStore.getState().addLog(`Embedding failed for ${repo.name}`);
            }
          })
        );
      }
    }

    usePipelineStore.getState().addLog("Ingestion Pipeline Complete!");
    setPipelineState({
      progress: 100,
      isRunning: false,
      currentPhase: "Complete",
      isWizardComplete: true,
    });
    await fetchEntities();
  } catch (e: any) {
    console.error(e);
    setPipelineState({ isRunning: false });
    usePipelineStore.getState().addLog("Error: " + e.message);
  }
};
