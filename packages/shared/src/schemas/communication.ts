import { z } from 'zod';
import { senderTypeSchema, uuidSchema } from './common';

export const messageCreateSchema = z.object({
  conversationId: uuidSchema,
  senderType: senderTypeSchema,
  body: z.string().min(1),
  attachments: z.array(z.string()).nullable().optional(),
});

export const savedReplyTemplateCreateSchema = z.object({
  staffId: uuidSchema.nullable().optional(),
  title: z.string().min(1).max(120),
  body: z.string().min(1),
});

export const notificationPreferenceUpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});
