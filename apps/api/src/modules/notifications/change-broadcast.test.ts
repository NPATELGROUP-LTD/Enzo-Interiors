import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { of } from 'rxjs';

import { ChangeBroadcast } from './change-broadcast';
import { RealtimeService } from './realtime';

const context = (method: string, type = 'http') =>
  ({ getType: () => type, switchToHttp: () => ({ getRequest: () => ({ method }) }) }) as never;
const handler = { handle: () => of('done') };

test('a write nudges everyone once, however many writes; reads and sockets never do', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const sent: string[] = [];
  const realtime = new RealtimeService();
  realtime.broadcast = (event) => void sent.push(event);
  const interceptor = new ChangeBroadcast(realtime);

  for (const method of ['GET', 'HEAD', 'OPTIONS']) interceptor.intercept(context(method), handler).subscribe();
  interceptor.intercept(context('POST', 'ws'), handler).subscribe();
  mock.timers.tick(1000);
  assert.deepEqual(sent, []);

  for (const method of ['POST', 'PATCH', 'DELETE']) interceptor.intercept(context(method), handler).subscribe();
  mock.timers.tick(499);
  assert.deepEqual(sent, []);
  mock.timers.tick(1);
  assert.deepEqual(sent, ['data:changed']);

  interceptor.intercept(context('PUT'), handler).subscribe();
  mock.timers.tick(500);
  assert.equal(sent.length, 2);
  mock.timers.reset();
});
