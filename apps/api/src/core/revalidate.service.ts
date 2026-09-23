import { Injectable, Logger } from '@nestjs/common';

/**
 * Tells apps/web that the published content changed.
 *
 * The public site renders statically and re-reads content on a timer, which is
 * what keeps it fast and keeps it up if this API is down. Publishing therefore
 * has to poke it, or an edit would sit invisible until the timer expired.
 *
 * A revalidation failure must never fail the publish: the content IS published,
 * and reporting an error for work that succeeded would push the editor into
 * publishing again. The site self-heals on its next scheduled revalidation, so
 * the failure is logged and swallowed.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  async ping(reason: string): Promise<void> {
    const url = process.env.WEB_REVALIDATE_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!url || !secret) {
      this.logger.warn(
        `Published (${reason}) but WEB_REVALIDATE_URL / REVALIDATE_SECRET are unset, so the public site will not update until its next scheduled revalidation.`,
      );
      return;
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ reason }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`Revalidation returned ${response.status} for ${reason}`);
        return;
      }
      this.logger.log(`Revalidated the public site (${reason})`);
    } catch (error) {
      this.logger.warn(
        `Could not reach the public site to revalidate (${reason}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
