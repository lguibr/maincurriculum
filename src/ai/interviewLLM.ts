import { GeminiInference } from "./GeminiInference";
import { dbOps } from "../db/indexedDB";
import { fetchEntities } from "../actions/entityActions";
import { useEntityStore } from "../store/useEntityStore";
import { usePipelineStore } from "../store/usePipelineStore";

export async function getInterviewTargetForIndex(idx: number): Promise<{topic: string, context: string}> {
  const exps = await dbOps.getExperiences();
  const projs = await dbOps.getProjects();
  const edus = await dbOps.getEducations();
  
  // Sort descending by date
  exps.sort((a,b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
  projs.sort((a,b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
  
  const ctxBase = "Base DB Graph Context:\\n";

  if (idx === 0) {
     return { topic: "Education and Academic Background", context: ctxBase + JSON.stringify(edus) };
  } else if (idx === 1) {
     const p = projs.length > 0 ? projs[0] : null;
     return { topic: p ? `Specific Project Architecture: ${p.repo_name}` : "Software Architecture on recent projects", context: ctxBase + (p ? JSON.stringify(p) : "No specific project found.") };
  } else if (idx === 2) {
     const p = projs.length > 1 ? projs[projs.length - 1] : (projs.length > 0 ? projs[0] : null);
     return { topic: p ? `Older Project Evolution: ${p.repo_name}` : "Software Architecture on past projects", context: ctxBase + (p ? JSON.stringify(p) : "No specific project found.") };
  } else if (idx === 3) {
     const e = exps.length > 2 ? exps[2] : (exps.length > 0 ? exps[0] : null);
     return { topic: e ? `Experience Impact: ${e.role} at ${e.company}` : "Professional Experience Impact", context: ctxBase + (e ? JSON.stringify(e) : "No specific experience found.") };
  } else if (idx === 4) {
     const e = exps.length > 1 ? exps[1] : (exps.length > 0 ? exps[0] : null);
     return { topic: e ? `Experience Impact: ${e.role} at ${e.company}` : "Professional Experience Impact", context: ctxBase + (e ? JSON.stringify(e) : "No specific experience found.") };
  } else if (idx === 5) {
     const e = exps.length > 0 ? exps[0] : null;
     return { topic: e ? `Most Recent Role Systems Design: ${e.role} at ${e.company}` : "Recent Systems Design", context: ctxBase + (e ? JSON.stringify(e) : "No specific experience found.") };
  } else {
     const e = exps.length > 0 ? exps[0] : null;
     return { topic: e ? `Most Recent Role Leadership & Tradeoffs: ${e.role} at ${e.company}` : "Recent Leadership", context: ctxBase + (e ? JSON.stringify(e) : "No specific experience found.") };
  }
}

export async function generateValidatedQuestion(topic: string, specificContext: string, history: string, model: string): Promise<string> {
  const maxLoops = 3;
  let finalQuestion = "";
  
  for (let attempts = 0; attempts < maxLoops; attempts++) {
      const qPrompt = `Topic focus: ${topic}. 
Target Context: ${specificContext}
History: ${history}

Generate ONE incredibly direct, highly technical, concise question probing architectural decisions, trade-offs, or complexities related SPECIFICALLY to the Target Context. No fluff, no personas, be stark and direct (e.g. 'How did you handle concurrency in project X?'). Output ONLY the question text.`;
      
      const candidateQ = await GeminiInference.generate(qPrompt, "text", model);
      
      const answerPrompt = `You are a strict evaluator. Attempt to thoroughly answer the following question relying EXCLUSIVELY on the provided Candidate Entity Context.
Context: ${specificContext}
Question: ${candidateQ}

If the context lacks the specific technical depth, metrics, or architectural details to answer fully, reply EXACTLY with "INSUFFICIENT_CONTEXT". Otherwise, provide the answer.`;
      
      const aiAnswer = await GeminiInference.generate(answerPrompt, "text", model);
      
      if (aiAnswer.includes("INSUFFICIENT_CONTEXT")) {
         const restructurePrompt = `A gap was found in the context regarding this question: ${candidateQ}
Rewrite the question to directly ask the candidate to fill in this missing technical knowledge. Be stark, direct, and concise. Output ONLY the question text.`;
         finalQuestion = await GeminiInference.generate(restructurePrompt, "text", model);
         break;
      } else {
         if (attempts === maxLoops - 1) {
            finalQuestion = candidateQ; 
         }
      }
  }
  return finalQuestion;
}

export async function refineUserAnswer(question: string, rawAnswer: string, model: string): Promise<string> {
  const prompt = `The user was asked an elite technical interview question: "${question}"
They provided this raw answer: "${rawAnswer}"

Act as a Principal Engineer. Rewrite, sharpen, and professionalize this answer so it fits perfectly as a dense, high-impact bullet point or executive summary snippet in a Master CV context flow. Improve the vocabulary but preserve the core truth. Output ONLY the refined answer text.`;
  return await GeminiInference.generate(prompt, "text", model);
}

export async function updateEntitiesFromInterview(historyText: string, model: string) {
    const { entities } = useEntityStore.getState();
    const currentData = JSON.stringify(entities, null, 2).substring(0, 10000); 
    
    usePipelineStore.getState().setPipelineState({ currentPhase: "Syncing Knowledge Graph..." });

    const prompt = `You are an AI synchronizing a database.
Current Database Context:
${currentData}

Recent Interview Insights:
${historyText}

Based on the Interview Insights, output a STRICT JSON object containing ONLY new or updated entities.
If a project gained a new skill, return that project object with the updated skills array.
If a new skill was discovered, return the skill object.
If an experience needs its description improved with details from the interview, return it.
Must follow this exact schema (only returning what changed/added):
{"skills": [...], "experiences": [...], "projects": [...]}
Do not return identical untouched entities. Reply tightly with JSON only.`;

    const result = await GeminiInference.generate(prompt, "json", "gemini-flash-latest"); // fast matching
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
         const parsed = JSON.parse(jsonMatch[0]);
         if (parsed.skills) {
            for (const sk of parsed.skills) await dbOps.saveSkill(sk);
         }
         if (parsed.experiences) {
            for (const exp of parsed.experiences) await dbOps.saveExperience(exp);
         }
         if (parsed.projects) {
            for (const proj of parsed.projects) await dbOps.saveProject(proj);
         }
         await fetchEntities();
      }
    } catch(e) {
      console.warn("Failed to sync knowledge graph from interview", e);
    }
}
