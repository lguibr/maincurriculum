import { z } from "zod";

export const UpdateProfileSchema = z.object({
  demographics_json: z.any().optional(),
  base_cv: z.string().optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

export const UpdateExtendedProfileSchema = z.object({
  extended_cv: z.string().min(1, "Extended CV is required"),
});

export type UpdateExtendedProfileRequest = z.infer<typeof UpdateExtendedProfileSchema>;
