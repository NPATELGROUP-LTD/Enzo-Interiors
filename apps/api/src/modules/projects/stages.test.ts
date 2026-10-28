// npm test — node's own runner through tsx, no framework.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_STAGES, approvalStages, doneStage, planStages, resolveStages } from './stages';

const keep = DEFAULT_STAGES.map((stage) => ({ ...stage, was: stage.name }));

test('stages: the default five until a list is saved', () => {
  assert.equal(resolveStages(null), DEFAULT_STAGES);
  assert.equal(resolveStages([]), DEFAULT_STAGES);
  assert.equal(doneStage(DEFAULT_STAGES), 'Completed');
  assert.deepEqual(approvalStages(DEFAULT_STAGES), ['Approval']);
});

test('stages: renames move, missing stages are removals, new ones are neither', () => {
  const next = [
    { name: ' Survey ', progress: 5, was: 'Consultation' },
    { name: 'Design', progress: 35, was: 'Design' },
    { name: 'Sign-off', progress: 60, approval: true, was: 'Approval' },
    { name: 'Fitting', progress: 80 },
    { name: 'Completed', progress: 100, was: 'Completed' },
  ];
  const plan = planStages(DEFAULT_STAGES, next);
  assert.equal(plan.stages[0]!.name, 'Survey');
  assert.deepEqual(plan.renames, [['Consultation', 'Survey'], ['Approval', 'Sign-off']]);
  assert.deepEqual(plan.removed, ['Installation']);

  // A swap is two renames, not a merge.
  const swapped = planStages(DEFAULT_STAGES, [
    { ...keep[0]!, name: 'Design', was: 'Consultation' },
    { ...keep[1]!, name: 'Consultation', was: 'Design' },
    ...keep.slice(2),
  ]);
  assert.deepEqual(swapped.renames, [['Consultation', 'Design'], ['Design', 'Consultation']]);
  assert.deepEqual(swapped.removed, []);
});

test('stages: several approval stages, each with a working stage between', () => {
  const plan = planStages(DEFAULT_STAGES, keep.map((stage) => ({ ...stage, approval: stage.name === 'Design' || stage.name === 'Installation' })));
  assert.deepEqual(approvalStages(plan.stages), ['Design', 'Installation']);
});

test('stages: bad lists are refused with a reason', () => {
  assert.throws(() => planStages(DEFAULT_STAGES, []), /between 1 and 20/);
  assert.throws(() => planStages(DEFAULT_STAGES, Array.from({ length: 21 }, (_, i) => ({ name: `S${i}`, progress: 0 }))), /between 1 and 20/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: '  ', progress: 0 }]), /needs a name/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'x'.repeat(41), progress: 0 }]), /too long/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'A', progress: 0 }, { name: 'a', progress: 1 }]), /two stages called/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'A', progress: 101 }]), /between 0 and 100/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'A', progress: 10.5 }]), /between 0 and 100/);
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'A', progress: 0, approval: true }, { name: 'B', progress: 1 }]), /stage before it/);
  assert.throws(() => planStages(DEFAULT_STAGES, keep.map((stage) => ({ ...stage, approval: stage.name === 'Completed' }))), /stage before it/);
  // Two in a row would send "request changes" to another approval stage.
  assert.throws(
    () => planStages(DEFAULT_STAGES, keep.map((stage) => ({ ...stage, approval: stage.name === 'Design' || stage.name === 'Approval' }))),
    /follows another approval stage/,
  );
  assert.throws(() => planStages(DEFAULT_STAGES, [{ name: 'A', progress: 0, was: 'Design' }, { name: 'B', progress: 0, was: 'Design' }]), /both replace/);
});
