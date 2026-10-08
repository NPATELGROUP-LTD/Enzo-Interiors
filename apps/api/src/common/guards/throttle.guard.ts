import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

import { clientIp } from '../../core/client-ip';

/** "a few seconds", "40 seconds", "3 minutes", "1 hour" — how long to wait, for people. */
export function waitFor(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 10) return 'a few seconds';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * The stock throttler, saying how long to wait in words the admin and the
 * website can show as they are, instead of "ThrottlerException: Too Many
 * Requests". Retry-After and the RateLimit headers are still set as before.
 * Counts per clientIp(), so behind Cloudflare each visitor has their own limit.
 * HTTP only: the stock guard sets response headers, which a socket event has not.
 */
@Injectable()
export class FriendlyThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientIp(req as unknown as Parameters<typeof clientIp>[0]);
  }

  protected async getErrorMessage(_context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<string> {
    return `Too many attempts. Try again in ${waitFor(detail.timeToBlockExpire * 1000)}.`;
  }
}
