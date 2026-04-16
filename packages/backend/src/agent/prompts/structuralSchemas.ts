import { z } from "zod";

export const OnboardingProfileSchema = z.object({
  missing_structural_areas: z
    .array(z.string())
    .describe(
      "A list of areas in the user's CV or profile that are missing or incomplete. Leave empty if the profile is sufficiently detailed."
    ),
});

export const MissingInfoSchema = z.object({
  missing_areas: z.array(z.string()),
});

export const EnhancedInterviewSchema = z.object({
  next_question_to_ask: z
    .string()
    .describe("The next question to ask the user to fill the missing knowledge area."),
});
