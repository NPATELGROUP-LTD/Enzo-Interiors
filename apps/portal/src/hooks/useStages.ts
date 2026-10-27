import { useQuery } from '@/hooks/useApi';
import type { ProjectStageConfig } from '@/types/api';

/** The studio's ordered project stages. The last is done; any number of the others wait on the client. */
export function useStages() {
  const query = useQuery<ProjectStageConfig[]>('/projects/stages');
  const stages = query.data ?? [];
  return { stages, approvals: stages.filter((stage) => stage.approval).map((stage) => stage.name) };
}
