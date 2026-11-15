import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parsePatroni, parseRedisInfo, redisBehind } from './cluster';

test('Patroni: roles, timeline and lag, and "unknown" lag is not a number', () => {
  const members = parsePatroni({
    members: [
      { name: 'd1', role: 'leader', state: 'running', timeline: 3 },
      { name: 'd2', role: 'sync_standby', state: 'streaming', timeline: 3, lag: 1048 },
      { name: 'd3', role: 'replica', state: 'streaming', lag: 'unknown' },
    ],
  });
  assert.deepEqual(members.map((m) => [m.role, m.lag_bytes]), [['leader', null], ['sync_standby', 1048], ['replica', null]]);
  assert.deepEqual(parsePatroni(null), []);
  assert.deepEqual(parsePatroni({ members: 'x' }), []);
});

test('Redis: master offset, replica offset and the gap between them', () => {
  const master = parseRedisInfo('# Replication\r\nrole:master\r\nconnected_slaves:1\r\nmaster_repl_offset:5000\r\n');
  const replica = parseRedisInfo('role:slave\r\nmaster_link_status:up\r\nslave_repl_offset:4200\r\nmaster_repl_offset:5000\r\n');
  assert.equal(master.offset, 5000);
  assert.equal(replica.offset, 4200);
  assert.equal(replica.link_up, true);
  assert.deepEqual(redisBehind([master, replica]), [0, 800]);
  assert.deepEqual(redisBehind([replica, { role: 'down', offset: null, link_up: null }]), [null, null], 'no master to compare with');
  assert.equal(parseRedisInfo('role:slave\r\nmaster_link_status:down\r\n').link_up, false);
});
