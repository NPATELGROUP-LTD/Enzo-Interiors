import type {
  ComponentCategory,
  ISODateString,
  InvoiceStatus,
  Money,
  QuoteStatus,
  QuoteType,
  Timestamps,
  UUID,
} from './common';

export interface Component extends Timestamps {
  id: UUID;
  name: string;
  category: ComponentCategory;
  unitPrice: Money;
  description: string | null;
  isActive: boolean;
}

export interface Quote extends Timestamps {
  id: UUID;
  clientId: UUID;
  serviceId: string;
  type: QuoteType;
  designFee: Money;
  subtotal: Money;
  vatRate: number;
  total: Money;
  status: QuoteStatus;
  invoiceId: UUID | null;
}

/** `unitPrice` is a snapshot of `Component.unitPrice` at quote time — never re-derive from the live component. */
export interface QuoteLineItem {
  id: UUID;
  quoteId: UUID;
  componentId: UUID;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface Invoice {
  id: UUID;
  number: string;
  clientId: UUID;
  projectId: UUID | null;
  quoteId: UUID | null;
  amount: Money;
  vatRate: number;
  status: InvoiceStatus;
  dueDate: ISODateString;
  /** Set only via the Admin's manual "Mark Paid" action — no payment gateway ever writes this. */
  paidAt: ISODateString | null;
  createdAt: ISODateString;
}
