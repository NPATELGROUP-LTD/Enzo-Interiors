import type { ProjectStatus, ServiceType, Timestamps, UUID } from './common';

export interface Project extends Timestamps {
  id: UUID;
  clientId: UUID;
  name: string;
  type: ServiceType;
  status: ProjectStatus;
  progressPct: number;
  currentStage: string | null;
  assignedDesignerId: UUID | null;
  clientVisible: boolean;
}
