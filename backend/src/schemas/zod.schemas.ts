import { z } from "zod";
import { ladderSchema } from "../domain/ladder";
import { Platform, Role } from "../config/constants";

export const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(Role),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(Platform),
  budget: z.number().int().positive(),
  ladder: ladderSchema,
});

export const createSubmissionSchema = z.object({
  url: z.url(),
});

export const updateViewsSchema = z.object({
  views: z.number().int().nonnegative(),
});
