import { z } from "zod";

export const TailorRequestSchema = z.object({
  jobDescription: z.string().min(1, "Job description is required"),
  profileId: z.number().int().positive("Invalid Profile ID"),
  employerQuestions: z.string().optional(),
});

export type TailorRequest = z.infer<typeof TailorRequestSchema>;

export const TailorResponseSchema = z.object({
  tailoredCv: z.string(),
  coverLetter: z.string(),
  employerAnswers: z.string(),
});

export type TailorResponse = z.infer<typeof TailorResponseSchema>;
