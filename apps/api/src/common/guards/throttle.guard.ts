import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

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
 */
@Injectable()
export class FriendlyThrottlerGuard extends ThrottlerGuard {
  protected async getErrorMessage(_context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<string> {
    return `Too many attempts. Try again in ${waitFor(detail.timeToBlockExpire * 1000)}.`;
  }
}
