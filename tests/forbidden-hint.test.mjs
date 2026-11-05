// Tests for the gateway 403 troubleshooting hint on hdgrow_* business calls (Issue #3).
// Pure local: spins an in-process HTTP server as a fake gateway. Uses node:test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { CODES, mapBackendError, withForbiddenHint } from '../src/errors.mjs';
import { callGrow } from '../src/tools/http-client.mjs';

const HINT_MARKS = ['auth_type', '白名单', 'hdgrow_admin_whitelist_page', 'appcode'];

test('mapBackendError keeps mapping 403 to FORBIDDEN', () => {
  assert.equal(mapBackendError(403, null), CODES.FORBIDDEN);
  assert.equal(mapBackendError(200, 10002), CODES.FORBIDDEN);
  assert.equal(mapBackendError(200, null), CODES.UPSTREAM_ERROR); // non-403 path unchanged
});

test('withForbiddenHint appends whitelist/auth_type guidance only to FORBIDDEN failures', () => {
  const forbidden = { ok: false, error: { code: CODES.FORBIDDEN, message: 'denied' } };
  const hinted = withForbiddenHint(forbidden);
  assert.equal(hinted.error.code, CODES.FORBIDDEN); // code/structure unchanged
  for (const m of HINT_MARKS) assert.ok(hinted.error.message.includes(m), `missing ${m}`);

  const other = { ok: false, error: { code: CODES.UNAUTHORIZED, message: 'x' } };
  assert.equal(withForbiddenHint(other), other); // untouched
  const success = { ok: true, data: {} };
  assert.equal(withForbiddenHint(success), success); // untouched
});

test('callGrow attaches the 403 hint when the gateway rejects with 403', async () => {
  const server = createServer((req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 10002, message: 'FORBIDDEN' }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const prevBase = process.env.HDGROW_BASE;
  const prevAk = process.env.HW_ACCESS_KEY;
  const prevSk = process.env.HW_SECRET_KEY;
  process.env.HDGROW_BASE = `http://127.0.0.1:${port}/api/v1/hdgrowservice`;
  process.env.HW_ACCESS_KEY = 'test-ak';
  process.env.HW_SECRET_KEY = 'test-sk';
  try {
    const r = await callGrow('GET', '/agent/grow/points');
    assert.equal(r.ok, false);
    assert.equal(r.error.code, CODES.FORBIDDEN);
    for (const m of HINT_MARKS) assert.ok(r.error.message.includes(m), `missing ${m}`);
  } finally {
    if (prevBase === undefined) delete process.env.HDGROW_BASE; else process.env.HDGROW_BASE = prevBase;
    if (prevAk === undefined) delete process.env.HW_ACCESS_KEY; else process.env.HW_ACCESS_KEY = prevAk;
    if (prevSk === undefined) delete process.env.HW_SECRET_KEY; else process.env.HW_SECRET_KEY = prevSk;
    server.close();
  }
});

test('non-403 gateway statuses stay untouched by the hint wrapper', () => {
  // Non-gateway / non-403 regression guard: the hint wrapper only decorates
  // FORBIDDEN failures; everything else (incl. 401/429/5xx results) passes
  // through by reference, so paths other than callGrow are unaffected.
  const cases = [
    { ok: false, error: { code: CODES.UNAUTHORIZED, message: 'unauthorized' } },
    { ok: false, error: { code: CODES.UPSTREAM_ERROR, message: 'boom' } },
    { ok: true, data: { affected: 1 } },
  ];
  for (const c of cases) assert.equal(withForbiddenHint(c), c);
});
