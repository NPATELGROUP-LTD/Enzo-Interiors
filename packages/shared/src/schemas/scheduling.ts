import { z } from 'zod';
import { serviceTypeSchema, uuidSchema } from './common';

export const bookingCreateSchema = z.object({
  clientId: uuidSchema,
  serviceType: serviceTypeSchema,
  dateTime: z.string(),
  linkedQuoteId: uuidSchema.nullable().optional(),
});

export const availabilitySettingsSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  slotDurationMins: z.number().int().positive().default(60),
  isClosed: z.boolean().default(false),
});
