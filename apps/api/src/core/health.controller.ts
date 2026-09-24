import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../common/decorators';
import { PrismaService } from '../data/prisma.service';

/**
 * Readiness, for the container runtime and nothing else.
 *
 * It touches the database rather than returning a constant. The Nest process
 * stays up and answering when Postgres goes away, so a check that only proves
 * "the port is open" would report healthy through an outage — and compose
 * would go on treating the API as a dependency the site may start against.
 *
 * Deliberately says nothing beyond ok/not-ok: this is an unauthenticated
 * endpoint, and version numbers, migration state and connection counts are
 * reconnaissance, not diagnostics.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('Database unreachable.');
    }
    return { status: 'ok' };
  }
}
