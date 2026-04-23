import { z } from "zod";

export const ImproverChatRequestSchema = z.object({
  message: z.string().optional(),
  extendedCv: z.string().optional(),
});

export type ImproverChatRequest = z.infer<typeof ImproverChatRequestSchema>;

export const ImproveRequestSchema = z.object({
  profileId: z.number().int().positive("Invalid Profile ID"),
  instruction: z.string().optional(),
  currentCv: z.string().optional(),
});

export type ImproveRequest = z.infer<typeof ImproveRequestSchema>;
