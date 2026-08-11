import type {
  ContactSubmissionStatus,
  DocumentType,
  ISODateString,
  ServiceType,
  UUID,
} from './common';

export interface Document {
  id: UUID;
  clientId: UUID;
  projectId: UUID | null;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  uploadDate: ISODateString;
  clientVisible: boolean;
  /** S3/MinIO object key only — never a full URL. Resolve to a signed URL via the API at request time. */
  storageKey: string;
}

export interface Testimonial {
  id: UUID;
  clientName: string;
  rating: number;
  reviewText: string;
  projectId: UUID | null;
  isPublished: boolean;
  createdAt: ISODateString;
}

export interface PortfolioItem {
  id: UUID;
  projectId: UUID | null;
  title: string;
  category: ServiceType;
  location: string | null;
  year: number | null;
  durationWeeks: number | null;
  description: string | null;
  materialsUsed: string | null;
  imageUrls: string[];
  isPublished: boolean;
}

export interface ContactSubmission {
  id: UUID;
  name: string;
  email: string;
  phone: string | null;
  serviceInterest: string | null;
  message: string;
  status: ContactSubmissionStatus;
  createdAt: ISODateString;
}

export interface BusinessSettings {
  id: UUID;
  businessName: string;
  vatRate: number;
  logoUrl: string | null;
  brandPrimaryColor: string;
  emailFromAddress: string | null;
}
