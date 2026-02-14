import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: 'Email or username is required' })
    .max(255, { message: 'Email must be less than 255 characters' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .max(128, { message: 'Password must be less than 128 characters' }),
});

export const studentLoginSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, { message: 'Student ID is required' })
    .max(50, { message: 'Student ID must be less than 50 characters' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .max(128, { message: 'Password must be less than 128 characters' }),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type StudentLoginFormData = z.infer<typeof studentLoginSchema>;
