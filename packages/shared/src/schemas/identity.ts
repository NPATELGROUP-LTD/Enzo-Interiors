import { z } from 'zod';
import { clientStatusSchema, staffRoleSchema, uuidSchema } from './common';

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const portalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const staffUserCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  role: staffRoleSchema.default('Designer'),
});

export const clientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().nullable().optional(),
  status: clientStatusSchema.default('Active'),
  assignedStaffId: uuidSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();
