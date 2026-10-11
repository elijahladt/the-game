import { z } from 'zod';

export const UsernameSchema = z
  .string()
  .trim()
  .min(2, 'Username must be at least 2 characters')
  .max(16, 'Username must be at most 16 characters')
  .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Username can only contain letters, numbers, underscores and hyphens');

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(6, 'Room code must be exactly 6 characters');

export const AnswerSubmissionSchema = z.object({
  instanceId: z.string().uuid().or(z.string().min(5)),
  answer: z.string().trim().max(100),
});

export const MatchSettingsSchema = z.object({
  targetRound: z.number().int().min(1).max(20).default(10),
  questionTimeLimitSeconds: z.number().int().min(5).max(120).default(30),
  minPlayersToStart: z.number().int().min(1).max(12).default(2),
  maxPlayers: z.number().int().min(2).max(12).default(12),
  antiCheatEnabled: z.boolean().default(true),
  isTestMode: z.boolean().default(false),
});
