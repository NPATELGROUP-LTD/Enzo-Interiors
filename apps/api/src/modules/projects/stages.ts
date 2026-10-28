import { BadRequestException } from '@nestjs/common';

import { ProjectStageConfig } from '../../common/types/domain';
import { DatabaseService } from '../../data/database.service';

/** The site_settings row the list lives on. */
export const SITE_ROW = 'site';
export const MAX_STAGES = 20;
const MAX_NAME = 40;

/**
 * The stages a project moves through until the Admin saves their own list
 * (site_settings.project_stages). Computed on read, never written into a row.
 * The last stage is the finished one; `approval` marks where the client
 * approves (moves to the next stage) or asks for changes (back one). Any
 * number of stages may carry it, never the first, the last or two in a row.
 */
export const DEFAULT_STAGES: ProjectStageConfig[] = [
  { name: 'Consultation', progress: 10, approval: false },
  { name: 'Design', progress: 35, approval: false },
  { name: 'Approval', progress: 60, approval: true },
  { name: 'Installation', progress: 80, approval: false },
  { name: 'Completed', progress: 100, approval: false },
];

/** What was saved (checked by parseStages on the way in), else the defaults. */
export function resolveStages(stored: unknown): ProjectStageConfig[] {
  return Array.isArray(stored) && stored.length > 0 ? (stored as ProjectStageConfig[]) : DEFAULT_STAGES;
}

export async function loadStages(db: DatabaseService): Promise<ProjectStageConfig[]> {
  return resolveStages((await db.siteSettings.findById(SITE_ROW))?.project_stages);
}

/** The finished stage: always the last. */
export const doneStage = (stages: ProjectStageConfig[]): string => stages[stages.length - 1]!.name;

/** Where the client decides: any number of stages (none, one or several). */
export const approvalStages = (stages: ProjectStageConfig[]): string[] =>
  stages.filter((stage) => stage.approval).map((stage) => stage.name);

export interface StagePlan {
  stages: ProjectStageConfig[];
  /** [old name, new name]: projects at the old name move to the new one. */
  renames: Array<[string, string]>;
  /** Old names that no longer exist: refused while any project is at one. */
  removed: string[];
}

/**
 * The Admin's new list, checked, against the current one. Each item may carry
 * `was` (the name it had when the editor loaded) so a rename is told apart
 * from a removal plus an addition.
 */
export function planStages(current: ProjectStageConfig[], input: unknown): StagePlan {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_STAGES) {
    throw new BadRequestException(`Keep between 1 and ${MAX_STAGES} stages.`);
  }
  const currentNames = new Set(current.map((stage) => stage.name));
  const seen = new Set<string>();
  const claimed = new Set<string>();
  const stages: ProjectStageConfig[] = [];
  const renames: Array<[string, string]> = [];

  input.forEach((raw: unknown, index) => {
    const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) throw new BadRequestException(`Stage ${index + 1} needs a name.`);
    if (name.length > MAX_NAME) throw new BadRequestException(`"${name.slice(0, MAX_NAME)}…" is too long (${MAX_NAME} characters at most).`);
    if (seen.has(name.toLowerCase())) throw new BadRequestException(`There are two stages called "${name}".`);
    seen.add(name.toLowerCase());

    const progress = item.progress;
    if (typeof progress !== 'number' || !Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw new BadRequestException(`"${name}" needs a progress between 0 and 100.`);
    }
    if (item.approval !== undefined && typeof item.approval !== 'boolean') {
      throw new BadRequestException(`"${name}": client approval must be on or off.`);
    }

    // Unchanged or new: its own name. Renamed: the old name it had.
    const was = typeof item.was === 'string' && currentNames.has(item.was) ? item.was : null;
    const from = was ?? (currentNames.has(name) ? name : null);
    if (from) {
      if (claimed.has(from)) throw new BadRequestException(`Two stages both replace "${from}".`);
      claimed.add(from);
      if (from !== name) renames.push([from, name]);
    }
    stages.push({ name, progress, approval: item.approval === true });
  });

  if (stages[0]!.approval || stages[stages.length - 1]!.approval) {
    throw new BadRequestException('An approval stage needs a stage before it (changes go back there) and one after it.');
  }
  // Changes go back one stage; landing on another approval stage would ask the client again with nothing revised.
  const adjacent = stages.find((stage, i) => stage.approval && stages[i - 1]?.approval);
  if (adjacent) throw new BadRequestException(`"${adjacent.name}" follows another approval stage: put a working stage between them.`);

  return { stages, renames, removed: [...currentNames].filter((name) => !claimed.has(name)) };
}
