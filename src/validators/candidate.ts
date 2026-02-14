import { z } from 'zod';

export const candidateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Name must be at least 2 characters' })
    .max(100, { message: 'Name must be less than 100 characters' }),
  position: z
    .string()
    .trim()
    .min(1, { message: 'Position is required' })
    .max(100, { message: 'Position must be less than 100 characters' }),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Description must be less than 500 characters' })
    .optional(),
  photo: z.string().url().optional(),
});

export type CandidateFormData = z.infer<typeof candidateSchema>;
