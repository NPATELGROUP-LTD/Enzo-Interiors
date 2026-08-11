import { z } from 'zod';
import { projectStatusSchema, serviceTypeSchema, uuidSchema } from './common';

export const projectCreateSchema = z.object({
  clientId: uuidSchema,
  name: z.string().min(1).max(160),
  type: serviceTypeSchema,
  assignedDesignerId: uuidSchema.nullable().optional(),
  clientVisible: z.boolean().default(true),
});

export const projectStageUpdateSchema = z.object({
  status: projectStatusSchema,
  progressPct: z.number().int().min(0).max(100).optional(),
  currentStage: z.string().max(80).nullable().optional(),
});
