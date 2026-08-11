import { z } from 'zod';
import { contactSubmissionStatusSchema, documentTypeSchema, serviceTypeSchema, uuidSchema } from './common';

export const documentUploadSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(160),
  type: documentTypeSchema,
  sizeBytes: z.number().int().positive(),
  clientVisible: z.boolean().default(true),
});

export const testimonialCreateSchema = z.object({
  clientName: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(1),
  projectId: uuidSchema.nullable().optional(),
  isPublished: z.boolean().default(false),
});

export const portfolioItemCreateSchema = z.object({
  projectId: uuidSchema.nullable().optional(),
  title: z.string().min(1).max(160),
  category: serviceTypeSchema,
  location: z.string().max(120).nullable().optional(),
  year: z.number().int().nullable().optional(),
  durationWeeks: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
  materialsUsed: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).min(1),
  isPublished: z.boolean().default(true),
});

export const contactSubmissionCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  phone: z.string().max(30).nullable().optional(),
  serviceInterest: z.string().max(60).nullable().optional(),
  message: z.string().min(1),
});

export const contactSubmissionStatusUpdateSchema = z.object({
  status: contactSubmissionStatusSchema,
});

export const businessSettingsUpdateSchema = z.object({
  businessName: z.string().min(1).max(160).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  logoUrl: z.string().nullable().optional(),
  brandPrimaryColor: z.string().max(10).optional(),
  emailFromAddress: z.string().email().nullable().optional(),
});
