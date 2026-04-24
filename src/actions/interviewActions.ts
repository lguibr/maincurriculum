import { useProfileStore } from "../store/useProfileStore";
import { usePipelineStore } from "../store/usePipelineStore";
import { useInterviewStore } from "../store/useInterviewStore";
import { dbOps } from "../db/indexedDB";
import { GeminiInference } from "../ai/GeminiInference";
import { fetchEntities } from "./entityActions";
import { getInterviewTargetForIndex, generateValidatedQuestion, refineUserAnswer, updateEntitiesFromInterview } from "../ai/interviewLLM";
import { startImprover } from "./cvGenerationActions";
import { runCritiqueOrchestrationLoop } from "../ai/critiqueOrchestrator";

export const processCvAndInterview = async (cvText: string) => {
  const { setPipelineState, addLog } = usePipelineStore.getState();
  const { setInterviewState } = useInterviewStore.getState();

  setPipelineState({
    isRunning: true,
    currentPhase: "Extracting Entities...",
    progress: 10,
    isWizardComplete: false,
  });
  setInterviewState({ interviewHistory: [], currentQuestion: null });
  useProfileStore.getState().setExtendedCv("");

  dbOps.getProfile("main").then(prof => {
      if (prof) {
          prof.extended_cv = "";
          dbOps.saveProfile(prof);
      }
  });

  try {
    const promptEducation = `Extract ALL academic educations from the following CV. Output as strict JSON formatted exactly like: {"educations": [{"id": "uuid", "school": "X", "degree": "BSCS", "start_date": "2015-01-01", "end_date": "2019-12-01", "description": "Studied computer science"}]}. For dates, you MUST use 'YYYY-MM-DD' format. If month is unknown, default to '-01-01'. Use 'Present' or null if ongoing.\nCV:\n${cvText}`;
    
    const promptExperience = `Extract ALL work experiences and standalone projects from the following CV. Output as strict JSON formatted exactly like: {"experiences": [{"id": "uuid", "company":"X", "role":"Dev", "start_date":"2020-01-01", "end_date":"2021-12-01", "description":"Did stuff", "skills":[]}]}. For dates, you MUST use 'YYYY-MM-DD' format. If month is unknown, default to '-01-01'. Use 'Present' or null if ongoing.\nCV:\n${cvText}`;

    const promptSkills = `Extract ALL technical skills and tools from the following CV. Output as strict JSON formatted exactly like: {"skills": [{"id": "uuid", "name": "Python", "type": "Language"}]}.\nCV:\n${cvText}`;

    // 1. Fast extraction
    const extractModel = "gemini-1.5-flash-latest";
    const [eduResult, expResult, skillsResult] = await Promise.all([
      GeminiInference.generate(promptEducation, "json", extractModel),
      GeminiInference.generate(promptExperience, "json", extractModel),
      GeminiInference.generate(promptSkills, "json", extractModel)
    ]);

    const saveParsedJsonAndEmbed = async (llmResult: string) => {
      try {
        const jsonMatch = llmResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.skills) {
            for (const sk of parsed.skills) await dbOps.saveSkill(sk);
          }
          if (parsed.experiences) {
            for (const exp of parsed.experiences) {
                await dbOps.saveExperience(exp);
                try {
                    const textToEmbed = JSON.stringify(exp);
                    const emb = await GeminiInference.getEmbedding(textToEmbed);
                    await dbOps.saveEmbedding({
                        id: `exp_${exp.id}_embed`,
                        project_id: exp.id,
                        chunk_index: 0,
                        chunk_text: textToEmbed,
                        type: "entity",
                        entity_type: "experience",
                        embedding: emb
                    });
                } catch(e) {}
            }
          }
          if (parsed.educations) {
            for (const edu of parsed.educations) {
                await dbOps.saveEducation(edu);
                try {
                    const textToEmbed = JSON.stringify(edu);
                    const emb = await GeminiInference.getEmbedding(textToEmbed);
                    await dbOps.saveEmbedding({
                        id: `edu_${edu.id}_embed`,
                        project_id: edu.id,
                        chunk_index: 0,
                        chunk_text: textToEmbed,
                        type: "entity",
                        entity_type: "education",
                        embedding: emb
                    });
                } catch(e) {}
            }
          }
        }
      } catch (e) {
        console.warn("Failed to parse extracted JSON from Gemini snippet", e);
      }
    };

    setPipelineState({ currentPhase: "Forming Semantic Knowledge Graph...", progress: 30 });
    await Promise.all([
      saveParsedJsonAndEmbed(eduResult),
      saveParsedJsonAndEmbed(expResult),
      saveParsedJsonAndEmbed(skillsResult)
    ]);
    await fetchEntities();

    // 2. Run the 5-Layer Critique
    setPipelineState({ currentPhase: "Running 5-Layer Semantic Critique...", progress: 60 });
    const orchestratorResult = await runCritiqueOrchestrationLoop("");
    
    if (orchestratorResult.status === "USER_INPUT_REQUIRED") {
        setPipelineState({ currentPhase: "Orchestrator Validation", progress: 80 });
        setInterviewState({ currentQuestion: orchestratorResult.assistant_message });
    } else {
        setPipelineState({ currentPhase: "Technical Architecture Interview", progress: 90 });
        const targetQ = await getInterviewTargetForIndex(0);
        const firstQuestion = await generateValidatedQuestion(targetQ.topic, targetQ.context, "", "gemini-1.5-pro-latest");
        setInterviewState({ currentQuestion: firstQuestion });
    }
  } catch (e) {
    console.error(e);
  }
  setPipelineState({ isRunning: false });
};

export const submitAnswer = async (answer: string) => {
  const { currentQuestion, interviewHistory, setInterviewState } = useInterviewStore.getState();
  const { currentPhase, setPipelineState } = usePipelineStore.getState();
  const { baseCv } = useProfileStore.getState();

  const prevQ = currentQuestion || "";
  const isOrchestratorCritique = currentPhase.includes("Orchestrator") || currentPhase.includes("Validation");
  
  if (isOrchestratorCritique) {
      const tempHistory = [...interviewHistory, { q: prevQ, a: answer, type: "critique" as const }];
      setInterviewState({ currentQuestion: null, interviewHistory: tempHistory });
      setPipelineState({ currentPhase: "Re-evaluating Data Constraints...", progress: 75 });
      
      const historyStr = tempHistory.map(h => `AGENT: ${h.q}\nUSER: ${h.a}`).join("\n\n");
      const orchestratorResult = await runCritiqueOrchestrationLoop(historyStr);
      
      if (orchestratorResult.status === "USER_INPUT_REQUIRED") {
         setPipelineState({ currentPhase: "Orchestrator Validation", progress: 80 });
         setInterviewState({ currentQuestion: orchestratorResult.assistant_message });
      } else {
         await fetchEntities();
         setPipelineState({ currentPhase: "Technical Architecture Interview", progress: 90 });
         const targetQ = await getInterviewTargetForIndex(0);
         const firstQuestion = await generateValidatedQuestion(targetQ.topic, targetQ.context, "", "gemini-1.5-pro-latest");
         setInterviewState({ currentQuestion: firstQuestion });
      }
      return;
  }

  // Normal Interview Mode
  const tempHistory = [...interviewHistory, { q: prevQ, a: answer, type: "interview" as const }];
  setInterviewState({ currentQuestion: null, interviewHistory: tempHistory });
  
  const interviewItems = tempHistory.filter(h => h.type === "interview");
  setPipelineState({ currentPhase: `Refining Architect Sync ${interviewItems.length}/5...`, progress: 95 });

  try {
    const rawAnswer = answer;
    const proModel = "gemini-1.5-pro-latest";

    // Refine the Answer instantly using the LLM 
    const refinedAnswer = await refineUserAnswer(prevQ, rawAnswer, proModel);
    
    // Replace the raw answer with the refined one in our history map
    const newHistory = [...tempHistory];
    newHistory[newHistory.length - 1].a = refinedAnswer;
    
    setInterviewState({ interviewHistory: newHistory });
    setPipelineState({ currentPhase: `Technical Architecture Interview ${interviewItems.length}/5`, progress: 95 });

    if (interviewItems.length < 5) {
      const historyText = interviewItems
        .map((h, i) => `Q${i + 1}: ${h.q}\nA${i + 1}: ${h.a}`)
        .join("\n\n");
      
      const targetQ = await getInterviewTargetForIndex(interviewItems.length);
      const nextQuestion = await generateValidatedQuestion(targetQ.topic, targetQ.context, historyText, proModel);
      setInterviewState({ currentQuestion: nextQuestion });
    } else {
      const historyText = interviewItems
        .map((h, i) => `Q${i + 1}: ${h.q}\nA${i + 1}: ${h.a}`)
        .join("\n\n");
      
      // Update the structural database before we rewrite the visual CV
      await updateEntitiesFromInterview(historyText, proModel);

      setPipelineState({ currentPhase: "Generating Master Profile Extrapolations", progress: 98 });
      const success = await startImprover(
        `The candidate had a technical architecture interview answering 5 deep-dive questions connecting to their database entity graph. Incorporate this precise knowledge into their CV implicitly by strengthening their bullet points or summary:\n\n${historyText}`,
        baseCv
      );

      if (success) {
        setPipelineState({ currentPhase: "Complete", progress: 100, isWizardComplete: true });
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
