import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const moneySchema = z.number().nonnegative();

export const staffRoleSchema = z.enum(['Admin', 'Designer', 'Installer']);
export const clientStatusSchema = z.enum(['Active', 'Inactive']);
export const serviceTypeSchema = z.enum(['Kitchen', 'Bedroom', 'MediaWall', 'Wardrobe']);
export const projectStatusSchema = z.enum([
  'Consultation',
  'Design',
  'Approval',
  'Installation',
  'Completed',
]);
export const componentCategorySchema = z.enum([
  'Worktop',
  'DoorFinish',
  'Lighting',
  'Appliance',
  'StorageAccessory',
  'Electrical',
]);
export const quoteTypeSchema = z.enum(['Simple', 'Detailed']);
export const quoteStatusSchema = z.enum(['Draft', 'Sent', 'Accepted', 'Expired']);
export const invoiceStatusSchema = z.enum(['Draft', 'Sent', 'Outstanding', 'Paid', 'Overdue']);
export const bookingStatusSchema = z.enum(['Pending', 'Confirmed', 'Cancelled']);
export const senderTypeSchema = z.enum(['Client', 'Staff']);
export const documentTypeSchema = z.enum(['Contract', 'Quote', 'Invoice', 'Plan', 'MoodBoard']);
export const contactSubmissionStatusSchema = z.enum([
  'New',
  'Contacted',
  'Converted',
  'Archived',
]);
