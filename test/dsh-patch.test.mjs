// Unit tests for the dsh cordis.patch.yml text surgery (Issue #11).
// Pure filesystem/local assertions; no network.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DSH_PATCH_ID,
  dshBackendBase,
  dshHome,
  dshPatchFile,
  dshPatchState,
  findDshPatchEntry,
  isSequenceDocument,
  removeDshPatchEntry,
  renderDshPatchEntry,
  upsertDshPatch,
  validateDshConfig,
  yamlSingleQuoted,
} from '../src/dsh-patch.mjs';

const PROD_BASE = 'https://open-dataset.huaweicloud.com/api/v1/blogservice';

let box;
let savedEnv;

beforeEach(() => {
  box = mkdtempSync(join(tmpdir(), 'hdmng-dsh-patch-'));
  savedEnv = { DSH_HOME: process.env.DSH_HOME, DSH_PROFILE: process.env.DSH_PROFILE, HDCOMMUNITY_BASE: process.env.HDCOMMUNITY_BASE };
  for (const key of Object.keys(savedEnv)) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(box, { recursive: true, force: true });
});

function patchFile(...segments) {
  return join(box, ...segments);
}

describe('paths and rendering', () => {
  test('dshHome falls back to ~/.dsh and honours DSH_HOME', () => {
    process.env.DSH_HOME = join(box, 'custom');
    assert.equal(dshHome(), join(box, 'custom'));
    delete process.env.DSH_HOME;
    assert.match(dshHome(), /\.dsh$/);
  });

  test('dshPatchFile defaults to profiles/web and honours DSH_PROFILE', () => {
    process.env.DSH_HOME = box;
    assert.equal(dshPatchFile(), join(box, 'profiles', 'web', 'cordis.patch.yml'));
    process.env.DSH_PROFILE = 'qa';
    assert.equal(dshPatchFile(), join(box, 'profiles', 'qa', 'cordis.patch.yml'));
  });

  test('renders an insert entry with the mng server and HDCOMMUNITY_BASE', () => {
    const text = renderDshPatchEntry('https://example.test/api/v1/blogservice');
    assert.match(text, /^- insert:$/m);
    assert.match(text, new RegExp(`^\\s+- id: ${DSH_PATCH_ID}$`, 'm'));
    assert.match(text, /name: '@deepseek-ai\/dsh-mcp-client'/);
    assert.match(text, /serverName: hdcommunity/);
    assert.match(text, /transport: stdio/);
    assert.match(text, /command: npx/);
    assert.match(text, /args: \['-y', '-p', 'hdcommunity-mng-toolkit', 'hdcommunity-mng-toolkit-mcp'\]/);
    assert.match(text, /HDCOMMUNITY_BASE: 'https:\/\/example\.test\/api\/v1\/blogservice'/);
  });

  test('uses the production default when HDCOMMUNITY_BASE is unset and env when set', () => {
    assert.equal(dshBackendBase(), PROD_BASE);
    process.env.HDCOMMUNITY_BASE = 'http://127.0.0.1:8080/api/v1/blogservice';
    assert.equal(dshBackendBase(), 'http://127.0.0.1:8080/api/v1/blogservice');
    assert.match(renderDshPatchEntry(), /HDCOMMUNITY_BASE: 'http:\/\/127\.0\.0\.1:8080\/api\/v1\/blogservice'/);
  });

  test('single-quotes YAML scalars and escapes embedded quotes', () => {
    assert.equal(yamlSingleQuoted("a'b"), "'a''b'");
  });
});

describe('entry detection and sequence validation', () => {
  test('findDshPatchEntry accepts bare and quoted ids', () => {
    assert.equal(findDshPatchEntry('- id: mcp-hdcommunity'), true);
    assert.equal(findDshPatchEntry('  - id: "mcp-hdcommunity"'), true);
    assert.equal(findDshPatchEntry('- id: other'), false);
  });

  test('findDshPatchEntry does not match deeply nested unrelated ids', () => {
    assert.equal(findDshPatchEntry('            - id: mcp-hdcommunity'), false);
  });

  test('isSequenceDocument accepts empty and sequence docs, rejects mappings', () => {
    assert.equal(isSequenceDocument(''), true);
    assert.equal(isSequenceDocument('\n# comment\n'), true);
    assert.equal(isSequenceDocument('- insert:\n    - id: x\n'), true);
    assert.equal(isSequenceDocument('---\nmodel: gpt\n'), false);
    assert.equal(isSequenceDocument('model: gpt\n'), false);
    assert.equal(isSequenceDocument('---\nmodel: gpt\n---\n- insert:\n'), true);
  });
});

describe('upsert / remove', () => {
  test('creates the patch file and directories for a fresh home', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    const result = upsertDshPatch(file, 'https://base.test');
    assert.equal(result.action, 'created');
    const text = readFileSync(file, 'utf8');
    assert.match(text, new RegExp(`id: ${DSH_PATCH_ID}`));
  });

  test('repeat install is idempotent by id', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    upsertDshPatch(file, 'https://base.test');
    const result = upsertDshPatch(file, 'https://base.test');
    assert.equal(result.action, 'skipped');
    const occurrences = (readFileSync(file, 'utf8').match(new RegExp(`^\\s+- id: ${DSH_PATCH_ID}$`, 'gm')) || []).length;
    assert.equal(occurrences, 1);
  });

  test('reinstall refreshes the managed block with a new base', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    upsertDshPatch(file, 'https://old.test');
    const result = upsertDshPatch(file, 'https://new.test');
    assert.equal(result.action, 'updated');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /HDCOMMUNITY_BASE: 'https:\/\/new\.test'/);
    assert.doesNotMatch(text, /old\.test/);
  });

  test('appends to a user sequence without touching existing entries', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    mkdirSync(join(box, 'profiles', 'web'), { recursive: true });
    writeFileSync(file, '- insert:\n    - id: user-entry\n      name: keep-me\n');
    const result = upsertDshPatch(file, 'https://base.test');
    assert.equal(result.action, 'updated');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /id: user-entry/);
    assert.match(text, new RegExp(`id: ${DSH_PATCH_ID}`));
  });

  test('a hand-written same-id entry is neither duplicated nor removed', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    mkdirSync(join(box, 'profiles', 'web'), { recursive: true });
    const handwritten = '- insert:\n    - id: mcp-hdcommunity\n      name: mine\n';
    writeFileSync(file, handwritten);
    assert.equal(upsertDshPatch(file, 'https://base.test').action, 'skipped');
    assert.equal(readFileSync(file, 'utf8'), handwritten);
    assert.equal(removeDshPatchEntry(file).removed, false);
    assert.equal(readFileSync(file, 'utf8'), handwritten);
  });

  test('remove deletes only the managed block and keeps user entries', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    mkdirSync(join(box, 'profiles', 'web'), { recursive: true });
    writeFileSync(file, '- insert:\n    - id: user-entry\n      name: keep-me\n');
    upsertDshPatch(file, 'https://base.test');
    const result = removeDshPatchEntry(file);
    assert.equal(result.removed, true);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /id: user-entry/);
    assert.doesNotMatch(text, new RegExp(`id: ${DSH_PATCH_ID}`));
  });

  test('remove normalises a file that only held the managed block to empty', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    upsertDshPatch(file, 'https://base.test');
    assert.equal(removeDshPatchEntry(file).removed, true);
    assert.equal(readFileSync(file, 'utf8'), '');
  });

  test('refuses to append to a mapping document and leaves it unchanged', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    mkdirSync(join(box, 'profiles', 'web'), { recursive: true });
    const mapping = 'model: gpt\n';
    writeFileSync(file, mapping);
    assert.equal(upsertDshPatch(file, 'https://base.test').action, 'invalid');
    assert.equal(readFileSync(file, 'utf8'), mapping);
  });
});

describe('state and preflight validation', () => {
  test('dshPatchState reports MISSING, OK and INVALID', () => {
    const file = patchFile('profiles', 'web', 'cordis.patch.yml');
    assert.equal(dshPatchState(file), 'MISSING');
    upsertDshPatch(file, 'https://base.test');
    assert.equal(dshPatchState(file), 'OK');
    writeFileSync(file, 'model: gpt\n');
    assert.equal(dshPatchState(file), 'INVALID');
  });

  test('validateDshConfig accepts a fresh writable home (creates nothing)', () => {
    process.env.DSH_HOME = join(box, 'fresh');
    const result = validateDshConfig();
    assert.equal(result.ok, true);
    assert.equal(existsSync(join(box, 'fresh')), false);
  });

  test('validateDshConfig rejects a DSH_HOME that is a file', () => {
    const home = join(box, 'not-a-dir');
    writeFileSync(home, 'x');
    process.env.DSH_HOME = home;
    const result = validateDshConfig();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'CONFIG_MISSING');
  });

  test('validateDshConfig rejects a non-sequence patch file', () => {
    process.env.DSH_HOME = box;
    const file = dshPatchFile();
    mkdirSync(join(box, 'profiles', 'web'), { recursive: true });
    writeFileSync(file, 'model: gpt\n');
    const result = validateDshConfig(file);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'CONFIG_INVALID');
  });

  test('validateDshConfig rejects a path component that is a file', () => {
    process.env.DSH_HOME = box;
    mkdirSync(join(box, 'profiles'), { recursive: true });
    writeFileSync(join(box, 'profiles', 'web'), 'x');
    const result = validateDshConfig();
    assert.equal(result.ok, false);
    assert.equal(result.code, 'CONFIG_MISSING');
  });
});