// Task update convenience wrapper: dirty-only fields, automatic field_group.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskUpdatePayload } from '../src/tools/grow-admin-tools.mjs';

test('task update: requires at least one editable field', () => {
  const r = buildTaskUpdatePayload({ id: 't1', reason: 'noop' });
  assert.equal(r.ok, false);
  assert.match(r.message, /至少提供一个/);
});

test('task update: description-only edit is non-money (basic)', () => {
  const r = buildTaskUpdatePayload({ id: 't1', task_desc: 'new desc', reason: 'desc' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.body.after, { task_desc: 'new desc' });
  assert.equal(r.body.field_group, 'basic');
  assert.equal(r.body.target_id, 't1');
});

test('task update: money fields switch the group to points', () => {
  const r = buildTaskUpdatePayload({ id: 't1', points: 50, task_guide: '<ol><li>x</li></ol>' });
  assert.equal(r.ok, true);
  assert.equal(r.body.field_group, 'points');
  assert.deepEqual(Object.keys(r.body.after).sort(), ['points', 'task_guide']);
});

test('task update: task_tag is not editable through this tool', () => {
  const r = buildTaskUpdatePayload({ id: 't1', task_tag: 'hacked', task_desc: 'x' });
  assert.equal(r.ok, true);
  assert.equal(r.body.after.task_tag, undefined);
});