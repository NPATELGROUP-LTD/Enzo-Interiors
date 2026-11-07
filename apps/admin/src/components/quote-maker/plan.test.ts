/**
 * Quote maker placement helpers.
 *
 *     npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampX, firstFree, overlaps, withLayout, type Plan } from './plan.ts';

test('a dragged unit stays on its wall and snaps to 10 mm', () => {
  assert.equal(clampX(-40, 600, 3000), 0);
  assert.equal(clampX(1234, 600, 3000), 1230);
  assert.equal(clampX(2900, 600, 3000), 2400);
  assert.equal(clampX(100, 3600, 3000), 0, 'wider than the wall: pinned left');
});

test('a new unit goes in the first gap of its band; wall units ignore floor units', () => {
  const floor: Array<[number, number, 'floor' | 'wall' | 'tall' | 'gap']> = [[0, 600, 'floor'], [1200, 600, 'gap']];
  assert.equal(firstFree(floor, 600, 'floor', 3000), 600);
  assert.equal(firstFree(floor, 700, 'floor', 3000), 1800);
  assert.equal(firstFree(floor, 600, 'wall', 3000), 0);
  assert.equal(firstFree([[0, 600, 'tall']], 600, 'wall', 3000), 600, 'a tall unit blocks both bands');
  assert.equal(firstFree([[0, 3000, 'floor']], 300, 'floor', 3000), null);
});

test('overlaps are found within a band only', () => {
  const found = overlaps([
    { id: 'a', x: 0, w: 600, mount: 'floor' },
    { id: 'b', x: 500, w: 600, mount: 'floor' },
    { id: 'c', x: 0, w: 600, mount: 'wall' },
    { id: 'd', x: 1100, w: 600, mount: 'floor' },
  ]);
  assert.deepEqual([...found].sort(), ['a', 'b']);
});

test('changing layout keeps the walls that still exist', () => {
  const plan: Plan = { layout: 'U', height_mm: 2400, walls: [{ length_mm: 1, units: [] }, { length_mm: 2, units: [] }, { length_mm: 3, units: [] }], island: null };
  assert.deepEqual(withLayout(plan, 'L').walls.map((w) => w.length_mm), [1, 2]);
  assert.deepEqual(withLayout(withLayout(plan, 'single'), 'galley').walls.map((w) => w.length_mm), [1, 3000]);
});
