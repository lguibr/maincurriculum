import { z } from "zod";

export const SkillSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  type: z.string().optional(),
});

export const ExperienceSchema = z.object({
  id: z.number().optional(),
  user_profile_id: z.number().optional(),
  company: z.string(),
  role: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(SkillSchema).optional(),
});

export const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  repo_name: z.string().optional(),
  associated_context: z.string().optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional()
});

export const EntitiesExtractionSchema = z.object({
  skills: z.array(SkillSchema),
  experiences: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  // Project mappings will map project names to a list of skill names
  project_mappings: z.array(
    z.object({
      repository_name: z.string(),
      skills_used: z.array(z.string()),
    })
  ).optional(),
});

export type Skill = z.infer<typeof SkillSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type ProjectEntity = z.infer<typeof ProjectSchema>;
export type EntitiesExtraction = z.infer<typeof EntitiesExtractionSchema>;
