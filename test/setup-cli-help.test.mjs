// Regression tests for Issue #2: `install --help` / `uninstall --help` must only print help.
// Seam: the CLI process boundary — spawn `src/setup-cli.mjs` with an isolated HOME/DSH_HOME and
// assert on user-visible behaviour (stdout, exit code, filesystem effects). No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'src', 'setup-cli.mjs');
const HELP_MARKER = 'Usage:';

function withSandbox(fn) {
  const box = mkdtempSync(join(tmpdir(), 'hdmng-help-'));
  const home = join(box, 'home');
  const dsh = join(box, 'dsh');
  try {
    return fn({ box, home, dsh });
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}

function runCli(args, { home, dsh }) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, DSH_HOME: dsh },
    timeout: 30_000,
  });
}

function assertHelpOnly(res, label) {
  assert.equal(res.status, 0, `${label}: exit code should be 0 (stderr: ${res.stderr})`);
  assert.ok(res.stdout.includes(HELP_MARKER), `${label}: help text expected, got: ${res.stdout}`);
  assert.ok(!res.stdout.includes('skills ->'), `${label}: must not install, got: ${res.stdout}`);
  assert.ok(!res.stdout.includes('removed skills from'), `${label}: must not uninstall, got: ${res.stdout}`);
}

test('install --help prints help only, exits 0, touches nothing', () => {
  withSandbox((env) => {
    const res = runCli(['install', '--help'], env);
    assertHelpOnly(res, 'install --help');
    assert.equal(existsSync(join(env.home, '.config')), false, 'no opencode config dir may be created');
    assert.deepEqual(readdirSync(env.box), [], 'sandbox must stay empty (no filesystem changes)');
  });
});

test('uninstall --help prints help only, removes nothing', () => {
  withSandbox((env) => {
    const res = runCli(['uninstall', '--help'], env);
    assertHelpOnly(res, 'uninstall --help');
    assert.equal(existsSync(join(env.home, '.config')), false, 'no skills dir expected');
  });
});

test('install -h (short flag) also prints help only', () => {
  withSandbox((env) => {
    const res = runCli(['install', '-h'], env);
    assertHelpOnly(res, 'install -h');
    assert.equal(existsSync(join(env.home, '.codex')), false, 'no codex dir may be created');
  });
});

test('help wins over an explicit target: install --help --target codex', () => {
  withSandbox((env) => {
    const res = runCli(['install', '--help', '--target', 'codex'], env);
    assertHelpOnly(res, 'install --help --target codex');
    assert.equal(existsSync(join(env.home, '.codex')), false, 'no codex dir may be created');
  });
});

test('bare --help behaviour is unchanged', () => {
  withSandbox((env) => {
    const res = runCli(['--help'], env);
    assertHelpOnly(res, 'bare --help');
    assert.equal(existsSync(join(env.home, '.config')), false, 'no config dir may be created');
  });
});

test('normal install still installs, normal uninstall still removes', () => {
  withSandbox((env) => {
    const installed = runCli(['install', '--target', 'codex'], env);
    assert.equal(installed.status, 0, `install failed: ${installed.stderr}`);
    assert.ok(installed.stdout.includes('skills ->'), `install output expected, got: ${installed.stdout}`);
    assert.ok(existsSync(join(env.home, '.codex', 'skills')), 'codex skills dir should exist after install');

    const removed = runCli(['uninstall', '--target', 'codex'], env);
    assert.equal(removed.status, 0, `uninstall failed: ${removed.stderr}`);
    assert.ok(removed.stdout.includes('removed skills from'), `uninstall output expected, got: ${removed.stdout}`);
    const leftovers = existsSync(join(env.home, '.codex', 'skills'))
      ? readdirSync(join(env.home, '.codex', 'skills'))
      : [];
    assert.deepEqual(leftovers, [], 'skills dir should be empty after uninstall');
  });
});