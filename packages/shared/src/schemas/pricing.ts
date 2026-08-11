import { z } from 'zod';
import {
  componentCategorySchema,
  moneySchema,
  quoteTypeSchema,
  serviceTypeSchema,
  uuidSchema,
} from './common';

export const componentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  category: componentCategorySchema,
  unitPrice: moneySchema,
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const componentUpdateSchema = componentCreateSchema.partial();

/** Input for POST /quotes/estimate — must resolve in <200ms per the TRD. */
export const quoteEstimateInputSchema = z.object({
  serviceType: serviceTypeSchema,
  tier: z.enum(['Essential', 'Premium', 'Luxury']),
  roomSizeSqm: z.number().positive(),
});

export const quoteLineItemInputSchema = z.object({
  componentId: uuidSchema,
  quantity: z.number().positive().default(1),
});

export const quoteCreateSchema = z.object({
  clientId: uuidSchema,
  serviceId: z.string().min(1).max(40),
  type: quoteTypeSchema,
  designFee: moneySchema.default(0),
  lineItems: z.array(quoteLineItemInputSchema).optional(),
});

export const invoiceCreateSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  quoteId: uuidSchema.nullable().optional(),
  amount: moneySchema,
  vatRate: z.number().min(0).max(100).default(20),
  dueDate: z.string(),
});

export const invoiceMarkPaidSchema = z.object({
  invoiceId: uuidSchema,
});
