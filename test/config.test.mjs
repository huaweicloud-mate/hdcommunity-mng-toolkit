// Behaviour tests for Issue #9: BACKEND_BASE default domain must be production.
// Seam: the module-loading process boundary. config.mjs resolves env at import time, so
// each case spawns a fresh Node process, optionally injects HDCOMMUNITY_BASE, and asserts
// the exported BACKEND_BASE on stdout. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_URL = pathToFileURL(join(__dirname, '..', 'src', 'config.mjs')).href;
const PROD_BASE = 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

function readBackendBase({ env } = {}) {
  const childEnv = { ...process.env };
  delete childEnv.HDCOMMUNITY_BASE;
  Object.assign(childEnv, env);
  const code = `const m = await import(${JSON.stringify(CONFIG_URL)}); console.log(m.BACKEND_BASE);`;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    env: childEnv,
    timeout: 30_000,
  });
  assert.equal(res.status, 0, `child process failed (stderr: ${res.stderr})`);
  return res.stdout.trim();
}

test('defaults to production open-dataset when HDCOMMUNITY_BASE is unset', () => {
  assert.equal(readBackendBase(), PROD_BASE);
});

test('empty HDCOMMUNITY_BASE falls back to production open-dataset', () => {
  assert.equal(readBackendBase({ env: { HDCOMMUNITY_BASE: '' } }), PROD_BASE);
});

test('explicit test-environment HDCOMMUNITY_BASE is preserved verbatim', () => {
  const testBase = 'https://opentest-dataset.huaweicloud.com/api/v1/blogservice';
  assert.equal(readBackendBase({ env: { HDCOMMUNITY_BASE: testBase } }), testBase);
});

test('arbitrary custom HDCOMMUNITY_BASE is preserved without trimming', () => {
  const custom = 'http://127.0.0.1:8080/api/v1/blogservice';
  assert.equal(readBackendBase({ env: { HDCOMMUNITY_BASE: custom } }), custom);
});

test('default backend base still ends with the blogservice context path', () => {
  assert.ok(readBackendBase().endsWith('/api/v1/blogservice'));
});