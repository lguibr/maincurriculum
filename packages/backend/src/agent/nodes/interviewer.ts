import { ProfileGraphState } from "../state";
import { pool } from "../../db/client";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { GoogleGenAI } from "@google/genai";
import { RunnableConfig } from "@langchain/core/runnables";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { interrupt } from "@langchain/langgraph";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function buildOntology(state: ProfileGraphState, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Constructing Initial Relational Ontology..." }, config);
  const repoContext = await getRepoContext(state.userProfileId as number);
  
  const prompt = `You are a strict data structurer converting a candidate's history into a linked Graph JSON.
Read their Base CV and ingested Repositories and output a STRICT JSON string matching exactly this format:
{
  "skills": [{"id": "s1", "name": "React", "linked_project_ids": ["dashboard-repo-name"], "linked_experience_ids": ["e1"]}],
  "experience": [{"id": "e1", "role": "Frontend Eng", "linked_project_ids": ["dashboard-repo-name"]}],
  "education": [{"id": "ed1", "degree": "CS", "linked_skill_ids": ["s1"]}]
}

CRITICAL RULES:
1. Every new entity must have a unique "id" (e.g. s1, e1, ed1).
2. FOR PROJECTS, the "id" MUST literally exactly be the Repository Name provided in the Repos context (e.g. "daicer-ui"). DO NOT invent fake ids like "p1".
3. ALL relational mappings MUST use these strict IDs (e.g., linked_project_ids, linked_skill_ids). DO NOT use string matching or names for relations.
4. You do not need to output the "projects" array. The system will natively graft it. Just map them using linked_project_ids!

Base CV: ${state.baseCv}
Repos: ${repoContext}

OUTPUT ONLY VALID JSON. No markdown wrappings.`;

  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  const rawOutput = response.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || "{}";
  
  try {
     const parsed = JSON.parse(rawOutput);
     
     // CRITICAL FIX: Do not overwrite the native projects array from the ingestor
     const prevRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
     const existingJson = prevRes.rows[0]?.demographics_json || {};
     
     parsed.projects = existingJson.projects || [];

     await pool.query(
        "UPDATE user_profiles SET demographics_json = $1 WHERE id = $2",
        [parsed, state.userProfileId]
     );
  } catch(e) {
     console.error("Ontology Construction Parsing Error", e);
  }
  
  return { currentPhase: "Ontology Construction Phase" };
}

async function getRepoContext(userProfileId: number) {
  const res = await pool.query(`
    SELECT pr.repo_name, substring(pr.raw_text from 1 for 1500) as preview
    FROM projects_raw_text pr
    WHERE user_profile_id = $1
  `, [userProfileId]);
  
  let repoContext = "Ingested Repositories:\n";
  for (const row of res.rows) {
    repoContext += `\n--- Repository: ${row.repo_name} ---\n${row.preview}\n...`;
  }
  return repoContext;
}

export async function analyzeSkills(state: ProfileGraphState, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Phase 1: Analyzing Relational Skills Match..." }, config);
  const repoContext = await getRepoContext(state.userProfileId as number);
  
  // Extract the live JSON ontology
  const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
  const ontology = dbRes.rows[0].demographics_json || {};
  
  const history = state.messages.map(m => `${m._getType() === 'human' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join("\n");
  
  const prompt = `You are collaboratively helping a candidate complete their Skills profile based on their Ontological Knowledge Graph.
Base CV: ${state.baseCv}
Repos: ${repoContext}
CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}
Prior Conversation History:
${history}

Your goal: Help gather more details to build a complete resume. DO NOT interrogate the user, force them to prove their skills, or ask why something is missing from their CV. If a skill isn't tied to a project, politely ask them to share a bit more about how they used it. We just want to add more rich detail.
Do not inquire too much. If they have already answered a question or if the graph has decent detail, output ONLY the string "NO_GAPS".`;

  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  const text = response.text?.trim() || "NO_GAPS";

  return {
     currentPhase: "Skills Phase",
     knowledgeGaps: text !== "NO_GAPS" ? [text] : []
  };
}

export async function skillsInterview(state: ProfileGraphState, config?: RunnableConfig) {
  if (state.knowledgeGaps.length > 0) {
     const q = state.knowledgeGaps[0];
     await dispatchCustomEvent("progress", { msg: "Awaiting Relational Skills input..." }, config);
     const answer = interrupt({ phase: "Skills Phase", question: q });
     
     const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
     const ontology = dbRes.rows[0].demographics_json || {};
     
     const prompt = `You are a strict data patcher.
CURRENT GRAPH:
${JSON.stringify(ontology)}
The candidate was asked: "${q}"
Their answer: "${answer}"

Patch the CURRENT GRAPH JSON with any new relational mappings they provided (e.g. mapping a skill to a project).
CRITICAL: The graph uses strict numeric/string 'id' fields and 'linked_project_ids' style arrays. You MUST NOT break this structure. Generate new IDs for any new items, and link them matching the strict ID schema only.
OUTPUT ONLY VALID JSON. No markdown wrappings.`;

     const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
     const rawOutput = response.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || "{}";
     try {
       const patched = JSON.parse(rawOutput);
        patched.projects = ontology.projects || [];
       await pool.query("UPDATE user_profiles SET demographics_json = $1 WHERE id = $2", [patched, state.userProfileId]);
     } catch (e) {
       console.error("Failed to patch ontology", e);
     }
     
     return { 
         messages: [new AIMessage(q), new HumanMessage(answer)]
     };
  }
  return {};
}

export async function analyzeEducation(state: ProfileGraphState, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Phase 2: Analyzing Ontological Education Mapping..." }, config);
  
  const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
  const ontology = dbRes.rows[0].demographics_json || {};
  
  const history = state.messages.map(m => `${m._getType() === 'human' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join("\n");
  
  const prompt = `You are collaboratively helping a candidate complete their Education details based on their Knowledge Graph.
Base CV: ${state.baseCv}
CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}
Prior Conversation History:
${history}

Your goal: Help gather more details about their educational background. DO NOT interrogate the candidate or point out missing information as a flaw. Instead, politely ask them to share how their academic background contributed to their current skills, just to add more detail to the resume.
Do not inquire too much. If they have already answered a question or if the graph has decent detail, output ONLY the string "NO_GAPS".`;

  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  const text = response.text?.trim() || "NO_GAPS";

  return {
     currentPhase: "Education Phase",
     knowledgeGaps: text !== "NO_GAPS" ? [text] : []
  };
}

export async function educationInterview(state: ProfileGraphState, config?: RunnableConfig) {
   if (state.knowledgeGaps.length > 0) {
     const q = state.knowledgeGaps[0];
     await dispatchCustomEvent("progress", { msg: "Awaiting Education input..." }, config);
     const answer = interrupt({ phase: "Education Phase", question: q });
     
     const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
     const ontology = dbRes.rows[0].demographics_json || {};
     
     const prompt = `You are a strict data patcher.
CURRENT GRAPH:
${JSON.stringify(ontology)}
The candidate was asked: "${q}"
Their answer: "${answer}"

Patch the CURRENT GRAPH JSON with any new educational or foundational skill relationships they provided.
CRITICAL: The graph uses strict numeric/string 'id' fields and 'linked_skill_ids' style arrays. You MUST NOT break this structure. Generate new IDs for any new items, and link them using the strict ID schema only.
OUTPUT ONLY VALID JSON. No markdown wrappings.`;

     const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
     const rawOutput = response.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || "{}";
     try {
       const patched = JSON.parse(rawOutput);
        patched.projects = ontology.projects || [];
       await pool.query("UPDATE user_profiles SET demographics_json = $1 WHERE id = $2", [patched, state.userProfileId]);
     } catch (e) { console.error(e); }
     
     return {
         messages: [new AIMessage(q), new HumanMessage(answer)]
     };
  }
  return {};
}

export async function analyzeExperience(state: ProfileGraphState, config?: RunnableConfig) {
  await dispatchCustomEvent("progress", { msg: "Phase 3: Analyzing Experience Graph Intersections..." }, config);
  const repoContext = await getRepoContext(state.userProfileId as number);
  
  const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
  const ontology = dbRes.rows[0].demographics_json || {};
  
  const history = state.messages.map(m => `${m._getType() === 'human' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join("\n");
  const prompt = `You are collaboratively helping a candidate complete their Work Experience and Projects timeline based on their Knowledge Graph.
Base CV: ${state.baseCv}
CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}
Repos: ${repoContext}
Prior Conversation History:
${history}

Your goal: Help gather more context about their work history. DO NOT interrogate them or challenge them to prove anything. If a repository isn't linked to a role, lightly and politely ask them if they built it for a specific job or as a side project, so you can map it properly on their completed resume.
Do not inquire too much. If they have already answered a question, or if there's sufficient detail, output ONLY the string "NO_GAPS".`;

  const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  const text = response.text?.trim() || "NO_GAPS";

  return {
     currentPhase: "Experience Phase",
     knowledgeGaps: text !== "NO_GAPS" ? [text] : []
  };
}

export async function experienceInterview(state: ProfileGraphState, config?: RunnableConfig) {
  if (state.knowledgeGaps.length > 0) {
     const q = state.knowledgeGaps[0];
     await dispatchCustomEvent("progress", { msg: "Awaiting Experience context..." }, config);
     const answer = interrupt({ phase: "Experience Phase", question: q });
     
     const dbRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
     const ontology = dbRes.rows[0].demographics_json || {};
     
     const prompt = `You are a strict data patcher.
CURRENT GRAPH:
${JSON.stringify(ontology)}
The candidate was asked: "${q}"
Their answer: "${answer}"

Patch the CURRENT GRAPH JSON with any new experience, job, or project mappings they provided.
CRITICAL: The graph uses strict numeric/string 'id' fields and 'linked_project_ids' style arrays. You MUST NOT break this JSON structure. Generate new IDs for any new items, and link them using the strict ID schema only.
OUTPUT ONLY VALID JSON. No markdown wrappings.`;

     const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
     const rawOutput = response.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || "{}";
     try {
       const patched = JSON.parse(rawOutput);
        patched.projects = ontology.projects || [];
       await pool.query("UPDATE user_profiles SET demographics_json = $1 WHERE id = $2", [patched, state.userProfileId]);
     } catch (e) { console.error(e); }
     
     return {
         messages: [new AIMessage(q), new HumanMessage(answer)]
     };
  }
  
  return { 
     knowledgeGaps: []
  };
}

export async function compileExtendedCV(state: ProfileGraphState, config?: RunnableConfig) {
   await dispatchCustomEvent("progress", { msg: "Compiling Master Extended CV from entire timeline dataset..." }, config);
   
   const profileRes = await pool.query("SELECT demographics_json FROM user_profiles WHERE id = $1", [state.userProfileId]);
   const demographics = profileRes.rows[0]?.demographics_json || {};
   
   const repoContext = await getRepoContext(state.userProfileId as number);
   
   const prompt = `You are an elite Staff-Level Engineer and Master CV Architect.
Your task is to compile a "Master Extended CV". This is an absolutely enormous, comprehensive Markdown document that natively embodies every single piece of extracted knowledge we have about this candidate.

Base CV:
${state.baseCv}

Extensive Demographics & Historical Interview Q&A Arrays:
${JSON.stringify(demographics, null, 2)}

Full Context Nodes from Github Repos:
${repoContext}

INSTRUCTIONS:
1. Natively interleave the Base CV with context you discover in the Repositories and Q&A history.
2. If a timeline or job was mentioned in the Q&A, you MUST tie the repo architectures to those jobs explicitly.
3. This is not constrained to standard 1-page CV rules. It is an "Extended Context CV". Expand on everything.
Output ONLY the raw markdown of the final compiled document.`;

   const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
   const extendedCvText = response.text?.trim() || "";
   
   await pool.query(
      `UPDATE user_profiles SET extended_cv = $1 WHERE id = $2`,
      [extendedCvText, state.userProfileId]
   );
   
   await dispatchCustomEvent("progress", { msg: "Master Extended Pipeline Completed." }, config);
   return {
     wizardCompleted: true,
     currentPhase: "Complete"
   };
}
