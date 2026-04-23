import { z } from "zod";

export const IngestStartRequestSchema = z.object({
  githubUrl: z.string().min(1, "GitHub Handle or URL is required"),
  baseCv: z.string().min(1, "Base CV cannot be empty"),
  selectedRepos: z.array(
    z.object({
      name: z.string(),
      url: z.string().url().optional(),
      description: z.string().nullable().optional(),
      updatedAt: z.string().optional(),
    }).passthrough()
  ).optional(),
  currentPhase: z.string().optional()
});

export type IngestStartRequest = z.infer<typeof IngestStartRequestSchema>;

export const IngestAnswerRequestSchema = z.object({
  answer: z.string().min(1, "Answer cannot be empty"),
});

export type IngestAnswerRequest = z.infer<typeof IngestAnswerRequestSchema>;
