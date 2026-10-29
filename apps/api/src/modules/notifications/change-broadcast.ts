import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { RealtimeService } from './realtime';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const QUIET_MS = 500;
/** Writes that change nothing a screen shows: sign-in/refresh, push registration, the bell's own read marks. */
const NO_PING = /^\/(auth|push|alerts|notifications)(\/|\?|$)/;

/**
 * After any successful write, nudge every connected screen to refetch (`data:changed`, no payload).
 * Each screen refetches its own, already-scoped queries, so nothing about the change is sent here.
 * Coalesced: a burst of writes is one nudge, sent after the last of them settles for half a second.
 */
@Injectable()
export class ChangeBroadcast implements NestInterceptor {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly realtime: RealtimeService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const { method, url } = context.switchToHttp().getRequest<{ method: string; url: string }>();
    return WRITES.has(method) && !NO_PING.test(url) ? next.handle().pipe(tap(() => this.ping())) : next.handle();
  }

  private ping(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.realtime.broadcast('data:changed');
    }, QUIET_MS);
    this.timer.unref();
  }
}
