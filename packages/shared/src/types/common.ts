/**
 * Money and date fields mirror Postgres `decimal` / `timestamptz` columns.
 * They arrive over JSON as `number` and ISO-8601 `string` respectively —
 * the `decimal`-never-`float` rule applies to storage in apps/api, not to
 * this wire representation.
 */
export type UUID = string;
export type ISODateString = string;
export type Money = number;

export type StaffRole = 'Admin' | 'Designer' | 'Installer';
export type ClientStatus = 'Active' | 'Inactive';
export type ServiceType = 'Kitchen' | 'Bedroom' | 'MediaWall' | 'Wardrobe';
export type ProjectStatus = 'Consultation' | 'Design' | 'Approval' | 'Installation' | 'Completed';
export type ComponentCategory =
  | 'Worktop'
  | 'DoorFinish'
  | 'Lighting'
  | 'Appliance'
  | 'StorageAccessory'
  | 'Electrical';
export type QuoteType = 'Simple' | 'Detailed';
export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Expired';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Outstanding' | 'Paid' | 'Overdue';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';
export type SenderType = 'Client' | 'Staff';
export type DocumentType = 'Contract' | 'Quote' | 'Invoice' | 'Plan' | 'MoodBoard';
export type ContactSubmissionStatus = 'New' | 'Contacted' | 'Converted' | 'Archived';

export interface Timestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
