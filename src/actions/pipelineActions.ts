import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { useInterviewStore } from "../store/useInterviewStore";
import { useEntityStore } from "../store/useEntityStore";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";

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

            let codebaseStr = `Repository: ${repo.name}\nDescription: ${repo.description || ""}\n\n`;
            try {
              const treeRes = await fetch(
                `https://api.github.com/repos/${repo.name}/git/trees/main?recursive=1`,
                { headers }
              );
              let treeData = await treeRes.json();
              if (treeRes.status === 404 || treeData.message?.includes("Not Found")) {
                const masterRes = await fetch(
                  `https://api.github.com/repos/${repo.name}/git/trees/master?recursive=1`,
                  { headers }
                );
                treeData = await masterRes.json();
              }

              if (Array.isArray(treeData.tree)) {
                const exclusions = [
                  ".png",
                  ".jpg",
                  ".jpeg",
                  ".gif",
                  ".mp4",
                  ".webp",
                  ".lock",
                  "node_modules/",
                  "dist/",
                  "build/",
                  ".git",
                  "package-lock.json",
                  "yarn.lock",
                  ".svg",
                  ".min.js",
                ];
                let files = treeData.tree.filter(
                  (t: any) =>
                    t.type === "blob" && !exclusions.some((ex) => t.path.toLowerCase().includes(ex))
                );
                files = files.slice(0, 15);

                for (let j = 0; j < files.length; j++) {
                  const file = files[j];
                  updateRepoProgress(repo.name, `Reading file ${j+1}/${files.length}...`, 20 + Math.round((j / files.length) * 30));
                  let text = "";
                  const fileHeaders = { ...headers, Accept: "application/vnd.github.v3.raw" };
                  let fileRes = await fetch(
                    `https://api.github.com/repos/${repo.name}/contents/${file.path}?ref=main`,
                    { headers: fileHeaders }
                  );
                  if (fileRes.ok) {
                    text = await fileRes.text();
                  } else {
                    fileRes = await fetch(
                      `https://api.github.com/repos/${repo.name}/contents/${file.path}?ref=master`,
                      { headers: fileHeaders }
                    );
                    if (fileRes.ok) text = await fileRes.text();
                  }
                  if (text) {
                    codebaseStr += `\n--- FILE: ${file.path} ---\n${text.substring(0, 3000)}\n`;
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed codebase fetch for ${repo.name}`, e);
            }

            const embText = codebaseStr.substring(0, 8000);
            const proj: any = {
              id: repo.name,
              repo_name: repo.name,
              description: repo.description || "",
              raw_text: codebaseStr,
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

export const fetchEntities = async () => {
  try {
    const skills = await dbOps.getSkills();
    const exps = await dbOps.getExperiences();
    const projs = await dbOps.getProjects();
    const edus = await dbOps.getEducations();
    useEntityStore
      .getState()
      .setEntityState({ entities: { skills, experiences: exps, projects: projs, educations: edus } });
  } catch (e) {
    console.error("Failed to fetch entities", e);
  }
};

export const deleteEntity = async (type: "skill" | "experience" | "education" | "project", id: string | number) => {
  try {
    if (type === "skill") await dbOps.deleteSkill(id as string);
    if (type === "experience") await dbOps.deleteExperience(id as string);
    if (type === "education") await dbOps.deleteEducation(id as string);
    if (type === "project") await dbOps.deleteProject(id as string);
    await fetchEntities();
  } catch (e) {
    console.error("Failed to delete entity", e);
  }
};

export const processCvAndInterview = async (cvText: string) => {
  const { setPipelineState } = usePipelineStore.getState();
  const { setInterviewState } = useInterviewStore.getState();
  const { cloudTier } = useProfileStore.getState();

  setPipelineState({
    isRunning: true,
    currentPhase: "Extracting Entities",
    isWizardComplete: false,
  });
  setInterviewState({ interviewHistory: [] });
  useProfileStore.getState().setExtendedCv("");

  // Clear extended_cv in DB so App.tsx doesn't prematurely mark it as complete
  dbOps.getProfile("main").then(prof => {
      if (prof) {
          prof.extended_cv = "";
          dbOps.saveProfile(prof);
      }
  });

  try {
    const parsePrompt = `Extract ALL technical skills, work experiences, and academic educations from the following CV. Do not limit the count. Output as strict JSON formatted exactly like: {"skills": [{"id": "uuid", "name": "Python", "type": "Language"}], "experiences": [{"id": "uuid", "company":"X", "role":"Dev", "start_date":"2020", "end_date":"2021", "description":"Did stuff", "skills":[]}], "educations": [{"id": "uuid", "school": "X", "degree": "BSCS", "start_date": "2015", "end_date": "2019", "description": "Studied computer science"}]}.\nCV:\n${cvText}`;

    let extractModel = "gemini-flash-latest"; // default
    if (cloudTier === "smart") extractModel = "gemini-flash-latest";
    if (cloudTier === "balanced") extractModel = "gemini-flash-lite-latest";
    if (cloudTier === "widely") extractModel = "gemini-flash-lite-latest";

    const llmResult = await GeminiInference.generate(parsePrompt, "json", extractModel);

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
        if (parsed.educations) {
          for (const edu of parsed.educations) await dbOps.saveEducation(edu);
        }
      }
    } catch (e) {
      console.warn("Failed to parse extracted JSON from Gemini", e);
    }

    const interviewPrompt = `Based on this CV:\n${cvText}\n\nGenerate ONE highly technical, deep-dive interview question about system architecture or their specific experiences. Provide only the question text.`;
    const firstQuestion = await GeminiInference.generate(interviewPrompt, "text", extractModel);

    setPipelineState({ currentPhase: "Interview" });
    setInterviewState({ currentQuestion: firstQuestion });
    await fetchEntities();
  } catch (e) {
    console.error(e);
  }
  setPipelineState({ isRunning: false });
};

export const startImprover = async (message: string, cvText: string): Promise<boolean> => {
  const { setPipelineState } = usePipelineStore.getState();
  const { setExtendedCv, extendedCv, cloudTier } = useProfileStore.getState();

  try {
    let improveModel = "gemini-pro-latest";
    if (cloudTier === "balanced") improveModel = "gemini-flash-latest";
    if (cloudTier === "widely") improveModel = "gemini-flash-lite-latest";

    const baseForPrompt = extendedCv ? extendedCv : cvText;
    const rewriteMethod = extendedCv 
        ? "You are updating an already Mastered CV. Surgically seamlessly insert, improve, or append the new context described in the USER MESSAGE without destroying the existing layout, structure, or tone. Reply EXCLUSIVELY with the updated raw Markdown string."
        : "Completely rewrite and expand this CV in Markdown format. Enhance descriptions, highlight architectural impact, clarify system depth, and format exactly as a master professional curriculum. Incorporate the interview insights directly as an Addendum at the end. DO NOT format this as JSON. Reply EXCLUSIVELY with the new raw Markdown string.";

    const rewritePrompt = `USER MESSAGE:\n${message}\n\nORIGINAL CV:\n${baseForPrompt}\n\nYou are a senior technical writer and principal engineer. ${rewriteMethod}`;

    const newCv = await GeminiInference.generate(rewritePrompt, "text", improveModel);

    setExtendedCv(newCv);

    await dbOps.saveProfile({
      id: "main",
      github_handle: useProfileStore.getState().githubUsername,
      base_cv: cvText,
      extended_cv: newCv,
      demographics_json: {},
      created_at: Date.now(),
    });

    return true;
  } catch (e) {
    console.error("Improver error", e);
    return false;
  }
};

export const submitAnswer = async (answer: string) => {
  const { currentQuestion, interviewHistory, setInterviewState } = useInterviewStore.getState();
  const { setPipelineState } = usePipelineStore.getState();
  const { baseCv, cloudTier } = useProfileStore.getState();

  const prevQ = currentQuestion || "";
  const newHistory = [...interviewHistory, { q: prevQ, a: answer }];

  // Clear question to trigger loading state in UI
  setInterviewState({ currentQuestion: null, interviewHistory: newHistory });
  setPipelineState({ currentPhase: `Interview ${newHistory.length}/10` }); // Fixed 1-based indexing glitch

  try {
    let extractModel = "gemini-flash-latest";
    if (cloudTier === "smart") extractModel = "gemini-flash-latest";
    if (cloudTier === "balanced") extractModel = "gemini-flash-lite-latest";
    if (cloudTier === "widely") extractModel = "gemini-flash-lite-latest";

    if (newHistory.length < 10) {
      const historyText = newHistory
        .map((h, i) => `Q${i + 1}: ${h.q}\nA${i + 1}: ${h.a}`)
        .join("\n\n");
      const interviewPrompt = `Based on this CV:\n${baseCv}\n\nAnd the previous Interview Q&A:\n${historyText}\n\nGenerate ONE highly technical, deep-dive interview question. Do not repeat previous questions. Provide only the question text.`;
      const nextQuestion = await GeminiInference.generate(interviewPrompt, "text", extractModel);
      setInterviewState({ currentQuestion: nextQuestion });
    } else {
      setPipelineState({ currentPhase: "Generating Final CV" });
      const historyText = newHistory
        .map((h, i) => `Q${i + 1}: ${h.q}\nA${i + 1}: ${h.a}`)
        .join("\n\n");
      const success = await startImprover(
        `The candidate had a technical interview answering 10 questions deeply about their background. Incorporate this deeper knowledge into their CV implicitly by strengthening their bullet points or summary:\n\n${historyText}`,
        baseCv
      );

      if (success) {
        setPipelineState({ currentPhase: "Complete", isWizardComplete: true });
      } else {
        setPipelineState({ currentPhase: "Failed to generate CV. Please try again." });
        setInterviewState({ currentQuestion: prevQ, interviewHistory });
      }
    }
  } catch (e) {
    console.error("Interview flow error:", e);
    setInterviewState({ currentQuestion: prevQ, interviewHistory });
  }
};
