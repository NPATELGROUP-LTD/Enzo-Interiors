import { useQuery } from '@/hooks/useApi';
import type { ProjectStageConfig } from '@/types/api';

/**
 * The Admin's ordered project stages (Settings › Project stages). The last is
 * the finished one; any number of the others are where the client approves.
 */
export function useStages() {
  const query = useQuery<ProjectStageConfig[]>('/projects/stages');
  const stages = query.data ?? [];
  return {
    ...query,
    stages,
    names: stages.map((stage) => stage.name),
    approvals: stages.filter((stage) => stage.approval).map((stage) => stage.name),
  };
}
