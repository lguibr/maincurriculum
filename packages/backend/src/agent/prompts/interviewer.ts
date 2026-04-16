export function buildOntologyPrompt({
  cvText,
  repoContext,
}: {
  cvText: string;
  repoContext: string;
}) {
  return `You are a strict data structurer converting a candidate's history into a linked Relational Graph.
Read their Base CV and ingested Repositories and map out their foundational graph.

CRITICAL RULES:
1. Every new entity must have a unique "id" (e.g. s1, e1, ed1).
2. FOR PROJECTS, the "id" MUST exactly be the Repository Name provided in the Repos context (e.g. "daicer-ui"). DO NOT invent fake ids like "p1".
3. ALL relational mappings MUST use these strict IDs (e.g., linked_project_ids, linked_skill_ids). DO NOT use string matching or names for relations.

Base CV: ${cvText}
Repos: ${repoContext}`;
}

export function analyzeSkillsPrompt({
  cvText,
  repoContext,
  ontology,
  history,
}: {
  cvText: string;
  repoContext: string;
  ontology: any;
  history: string;
}) {
  return `You are collaboratively helping a candidate complete their Skills profile based on their Ontological Knowledge Graph.
Base CV: ${cvText}
Repos: ${repoContext}

CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}

Prior Conversation History:
${history}

Your goal: Help gather more details to build a complete resume. DO NOT interrogate the user, force them to prove their skills, or ask why something is missing from their CV. If a skill isn't tied to a project, politely ask them to share a bit more about how they used it. We just want to add more rich detail.
Do not inquire too much. If they have already answered a question or if the graph has decent detail, output an empty array for knowledgeGaps.`;
}

export function analyzeEducationPrompt({
  cvText,
  ontology,
  history,
}: {
  cvText: string;
  ontology: any;
  history: string;
}) {
  return `You are collaboratively helping a candidate complete their Education details based on their Knowledge Graph.
Base CV: ${cvText}

CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}

Prior Conversation History:
${history}

Your goal: Help gather more details about their educational background. DO NOT interrogate the candidate or point out missing information as a flaw. Instead, politely ask them to share how their academic background contributed to their current skills, just to add more detail to the resume.
Do not inquire too much. If they have already answered a question or if the graph has decent detail, output an empty array for knowledgeGaps.`;
}

export function analyzeExperiencePrompt({
  cvText,
  repoContext,
  ontology,
  history,
}: {
  cvText: string;
  repoContext: string;
  ontology: any;
  history: string;
}) {
  return `You are collaboratively helping a candidate complete their Work Experience and Projects timeline based on their Knowledge Graph.
Base CV: ${cvText}
Repos: ${repoContext}

CURRENT KNOWLEDGE GRAPH:
${JSON.stringify(ontology, null, 2)}

Prior Conversation History:
${history}

Your goal: Help gather more context about their work history. DO NOT interrogate them or challenge them to prove anything. If a repository isn't linked to a role, lightly and politely ask them if they built it for a specific job or as a side project, so you can map it properly on their completed resume.
Do not inquire too much. If they have already answered a question, or if there's sufficient detail, output an empty array for knowledgeGaps.`;
}

export function compileExtendedCVPrompt({
  cvText,
  repoContext,
  demographics,
}: {
  cvText: string;
  repoContext: string;
  demographics: any;
}) {
  return `You are an elite Staff-Level Engineer and Master CV Architect.
Your task is to compile a "Master Extended CV". This is an absolutely enormous, comprehensive Markdown document that natively embodies every single piece of extracted knowledge we have about this candidate.

Base CV:
${cvText}

Extensive Demographics & Historical Interview Q&A Arrays:
${JSON.stringify(demographics, null, 2)}

Full Context Nodes from Github Repos:
${repoContext}

INSTRUCTIONS:
1. Natively interleave the Base CV with context you discover in the Repositories and Q&A history.
2. If a timeline or job was mentioned in the Q&A, you MUST tie the repo architectures to those jobs explicitly.
3. This is not constrained to standard 1-page CV rules. It is an "Extended Context CV". Expand on everything.
Output ONLY the raw markdown of the final compiled document.`;
}

export const INTERVIEWER_PROMPTS = {
  completenessSystem: `You are an elite Staff-Level Technical Profiler.
Review the provided candidate Base CV and any repository context available.
Identify if the profile is sufficiently detailed in these structural areas: 'technical skills', 'education detail', 'work timelines'.

CRITICAL INSTRUCTION: You MUST strictly enforce that the user has explicitly declared:
1. "Target Position" (What exact job titles or roles are they looking for?)
2. "Favorite Technologies" (What specific frameworks or languages do they love the most?)

If EITHER of these two are missing or vague, you MUST add them to the missing areas array.
If the candidate's CV is extremely sparse (e.g. just lists a job with no detail), flag the area as missing.
If they have a decently populated CV (even if basic) and BOTH target position and favorite tech are clear, leave the missing areas array empty.`,
  interviewerSystem: `You are collaboratively helping a candidate complete their profile.
Review their history, their CV, and the specific missing area flagged.
Draft a polite, concise, single question to ask the candidate to elaborate on this missing area.
DO NOT interrogate them. Keep it conversational.
If the missing area is 'Target Position' or 'Favorite Technologies', ask them directly about it!`,
  cvImproverSystem: `You are an elite Resume Architect.
Using the candidate's existing Master CV, and their recent Q&A interaction, output a newly improved markdown Master CV that natively weaves in the information they just shared.
Do not output anything except the pure markdown of the updated CV.`,
};
