import { useQuery } from '@/hooks/useApi';
import type { ProjectStageConfig } from '@/types/api';

/** The studio's ordered project stages. The last is done; at most one waits on the client. */
export function useStages() {
  const query = useQuery<ProjectStageConfig[]>('/projects/stages');
  const stages = query.data ?? [];
  return { stages, approval: stages.find((stage) => stage.approval)?.name ?? null };
}
