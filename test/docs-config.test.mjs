// Consistency guard for Issue #9: the default backend domain lives in src/config.mjs and
// must not leak the retired test-environment default into user-facing docs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROD_BASE = 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

test('src/config.mjs default BACKEND_BASE is the production address', () => {
  const source = read('src/config.mjs');
  const match = source.match(/export const BACKEND_BASE = process\.env\.HDCOMMUNITY_BASE \|\| '([^']+)'/);
  assert.ok(match, 'BACKEND_BASE default assignment not found in src/config.mjs');
  assert.equal(match[1], PROD_BASE);
});

test('README.md no longer mentions opentest-dataset', () => {
  assert.ok(!read('README.md').includes('opentest-dataset'));
});

test('skills/hd-blog-operator/SKILL.md no longer mentions opentest-dataset', () => {
  assert.ok(!read('skills/hd-blog-operator/SKILL.md').includes('opentest-dataset'));
});