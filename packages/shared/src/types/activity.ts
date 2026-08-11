import type { ISODateString, UUID } from './common';

export interface ActivityLog {
  id: UUID;
  staffId: UUID;
  action: string;
  targetTable: string;
  targetId: UUID;
  details: Record<string, unknown> | null;
  createdAt: ISODateString;
}
