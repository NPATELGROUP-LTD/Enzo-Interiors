import type { ClientStatus, ISODateString, Money, StaffRole, Timestamps, UUID } from './common';

export interface StaffUser extends Timestamps {
  id: UUID;
  name: string;
  email: string;
  role: StaffRole;
}

export interface Client extends Timestamps {
  id: UUID;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  assignedStaffId: UUID | null;
  joinedDate: ISODateString;
  totalSpent: Money;
  notes: string | null;
}
