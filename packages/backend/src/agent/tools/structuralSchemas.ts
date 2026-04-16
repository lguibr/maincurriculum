import { z } from "zod";

const BaseEntitySchema = z.object({
  id: z
    .string()
    .describe(
      "Unique identifier for this entity (e.g. 's1', 'e1'). For projects, MUST be exactly the repository name."
    ),
});

export const SkillSchema = BaseEntitySchema.extend({
  name: z.string(),
  linked_project_ids: z
    .array(z.string())
    .describe("IDs (repo names) of projects where this skill was used"),
  linked_experience_ids: z
    .array(z.string())
    .describe("IDs of experiences where this skill was used"),
});

export const ExperienceSchema = BaseEntitySchema.extend({
  role: z.string(),
  company: z.string().optional(),
  linked_project_ids: z
    .array(z.string())
    .describe("IDs (repo names) of projects built during this experience"),
});

export const EducationSchema = BaseEntitySchema.extend({
  degree: z.string(),
  institution: z.string().optional(),
  linked_skill_ids: z.array(z.string()).describe("IDs of skills learned here"),
});

export const OntologyGraphSchema = z
  .object({
    skills: z.array(SkillSchema).default([]),
    experience: z.array(ExperienceSchema).default([]),
    education: z.array(EducationSchema).default([]),
  })
  .describe("Strictly typed relational ontological graph.");

export const GapAnalysisSchema = z.object({
  knowledgeGaps: z
    .array(z.string())
    .describe("List of questions to ask the candidate to fill gaps. Empty array if NO_GAPS."),
});
