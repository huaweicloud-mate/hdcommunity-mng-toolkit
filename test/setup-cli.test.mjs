// Tests for the installer CLI (src/setup-cli.mjs + bin/setup.cjs).
// Pure local: no network required (update degrades gracefully offline).
// Uses node:test (Node >= 22 built-in).
//
// Seams:
//  - single source of truth: exported TARGETS
//  - CLI end-to-end via bin/setup.cjs with HOME / DSH_HOME pointed at a temp dir,
//    so the assertions cover user-visible behaviour (output + files written).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TARGETS } from '../src/setup-cli.mjs';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(PKG_ROOT, 'bin', 'setup.cjs');
const README = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8');

const EXPECTED = [
  'opencode',
  'codex',
  'codex-desktop',
  'codearts',
  'codearts-work',
  'workbuddy',
  'dsh',
  'hermes',
  'openclaw',
  'atomcode',
];

let home;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'hdmng-setup-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

/** Run the CLI with an isolated HOME so nothing touches the real user env. */
function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, HOME: home, DSH_HOME: join(home, '.dsh') },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

function statusLineFor(out, target) {
  return out.split('\n').find((line) => new RegExp(`^\\s+${target}\\s`).test(line)) || '';
}

const SKILL = 'hd-blog-operator';

describe('targets single source of truth', () => {
  test('TARGETS lists exactly the 10 supported agents', () => {
    assert.equal(TARGETS.length, 10);
    assert.deepEqual([...TARGETS].sort(), [...EXPECTED].sort());
  });
});

describe('help', () => {
  test('prints the correct package name, default target and all 10 targets', () => {
    const { stdout, status } = run(['help']);
    assert.equal(status, 0);
    assert.match(stdout, /hdcommunity-mng-toolkit/);
    // Regression: the help text used to advertise the sibling package name.
    assert.doesNotMatch(stdout, /npx hdcommunity-toolkit installer/);
    assert.doesNotMatch(stdout, /npx hdcommunity-toolkit /);
    assert.match(stdout, /default[^\n]*opencode/i);
    for (const t of TARGETS) {
      assert.ok(stdout.includes(t), `help should list ${t}`);
    }
  });
});

describe('status', () => {
  test('covers all 10 targets, including codex-desktop', () => {
    const { stdout, status } = run(['status']);
    assert.equal(status, 0);
    for (const t of TARGETS) {
      assert.ok(statusLineFor(stdout, t), `status should list ${t}`);
    }
  });

  test('reports codex-desktop as installed after install --target codex-desktop', () => {
    assert.equal(run(['install', '--target', 'codex-desktop']).status, 0);
    assert.ok(existsSync(join(home, '.codex', 'skills', SKILL, 'SKILL.md')));
    const { stdout } = run(['status']);
    assert.match(statusLineFor(stdout, 'codex-desktop'), /installed/);
    assert.match(statusLineFor(stdout, 'codex'), /installed/);
  });
});

describe('install', () => {
  test('omitting --target defaults to opencode and says so', () => {
    const { stdout, status } = run(['install']);
    assert.equal(status, 0);
    assert.match(stdout, /default/i);
    assert.match(stdout, /opencode/);
    assert.ok(existsSync(join(home, '.config', 'opencode', 'skills', SKILL, 'SKILL.md')));
  });

  test('--target all installs every target (including codex-desktop)', () => {
    const { stdout, status } = run(['install', '--target', 'all']);
    assert.equal(status, 0);
    for (const t of TARGETS) {
      assert.ok(stdout.includes(t), `install all should mention ${t}`);
    }
    // 9 unique destinations (codex and codex-desktop share ~/.codex/skills).
    assert.ok(existsSync(join(home, '.config', 'opencode', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.codex', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.codeartsdoer', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.codeartswork', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.workbuddy', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.dsh', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.hermes', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.openclaw', 'skills', SKILL)));
    assert.ok(existsSync(join(home, '.atomcode', 'skills', SKILL)));
    // all/status must agree: every target reads "installed" right after install.
    const { stdout: out } = run(['status']);
    for (const t of TARGETS) {
      assert.match(statusLineFor(out, t), /installed/, `${t} should be installed`);
    }
  });

  test('rejects an unknown target, lists legal values and writes nothing', () => {
    const { stdout, stderr, status } = run(['install', '--target', 'bogus']);
    assert.equal(status, 1);
    const message = `${stdout}\n${stderr}`;
    assert.match(message, /bogus/);
    for (const t of TARGETS) {
      assert.ok(message.includes(t), `error should list legal target ${t}`);
    }
    assert.equal(existsSync(join(home, '.bogus')), false);
  });

  test('opencode gets the MCP config merged; other targets only get a snippet', () => {
    const opencode = run(['install', '--target', 'opencode']).stdout;
    assert.match(opencode, /MCP config/);
    const cfg = JSON.parse(readFileSync(join(home, '.config', 'opencode', 'opencode.json'), 'utf8'));
    assert.ok(cfg.mcp['hdcommunity-mng-toolkit']);

    const hermes = run(['install', '--target', 'hermes']).stdout;
    assert.match(hermes, /mcpServers/);
    assert.match(hermes, /hdcommunity-mng-toolkit-mcp/);
  });
});

describe('uninstall', () => {
  test('--target all removes every installed target', () => {
    assert.equal(run(['install', '--target', 'all']).status, 0);
    assert.equal(run(['uninstall', '--target', 'all']).status, 0);
    assert.equal(existsSync(join(home, '.config', 'opencode', 'skills', SKILL)), false);
    assert.equal(existsSync(join(home, '.codex', 'skills', SKILL)), false);
    assert.equal(existsSync(join(home, '.dsh', 'skills', SKILL)), false);
  });

  test('rejects an unknown target', () => {
    const { status } = run(['uninstall', '--target', 'bogus']);
    assert.equal(status, 1);
  });
});

describe('doctor', () => {
  test('runs read-only and reports node / package / targets', () => {
    const { stdout, status } = run(['doctor']);
    assert.equal(status, 0);
    assert.match(stdout, /node/i);
    assert.match(stdout, new RegExp(TARGETS[0]));
    assert.match(stdout, /skills/i);
    // read-only: no config or skills directories are created by doctor.
    assert.equal(existsSync(join(home, '.config')), false);
    assert.equal(existsSync(join(home, '.hermes')), false);
  });
});

describe('update', () => {
  test('prints an upgrade hint and never touches the environment', () => {
    const { stdout, status } = run(['update']);
    assert.equal(status, 0);
    assert.match(stdout, /npx --yes hdcommunity-mng-toolkit@latest/);
    assert.deepEqual(readdirSync(home), []);
  });
});

describe('argument parsing', () => {
  test('install --help --target all only prints help and writes nothing', () => {
    const { stdout, status } = run(['install', '--help', '--target', 'all']);
    assert.equal(status, 0);
    assert.match(stdout, /Usage:/);
    assert.doesNotMatch(stdout, /skills ->/);
    assert.deepEqual(readdirSync(home), [], 'no target directory may be created');
  });

  test('--target=<value> (equals form) is honoured, not silently ignored', () => {
    const { stdout, status } = run(['install', '--target=all']);
    assert.equal(status, 0);
    assert.ok(existsSync(join(home, '.atomcode', 'skills', SKILL)), `equals form should install all targets, got: ${stdout}`);
  });

  test('--target=all equals form on uninstall removes every target', () => {
    assert.equal(run(['install', '--target', 'all']).status, 0);
    const { stdout, status } = run(['uninstall', '--target=all']);
    assert.equal(status, 0, `uninstall failed: ${stdout}`);
    assert.equal(existsSync(join(home, '.atomcode', 'skills', SKILL)), false, 'equals form must uninstall all targets, not just opencode');
    assert.equal(existsSync(join(home, '.config', 'opencode', 'skills', SKILL)), false);
  });

  test('--target without a value is an error, not a silent default', () => {
    const { stdout, stderr, status } = run(['install', '--target']);
    assert.equal(status, 1);
    assert.match(`${stdout}\n${stderr}`, /--target/);
    assert.deepEqual(readdirSync(home), [], 'no target directory may be created');
  });

  test('--target= (empty value) is an error, not a silent default', () => {
    const { status } = run(['install', '--target=']);
    assert.equal(status, 1);
    assert.deepEqual(readdirSync(home), []);
  });
});

describe('README / TARGETS consistency', () => {
  test('README documents every target with its install command', () => {
    for (const t of TARGETS) {
      const occurrences = README.split(`--target ${t}`).length - 1;
      assert.ok(occurrences >= 2, `README should reference --target ${t} at least twice (table + section)`);
    }
    // Regression: the install section used to hide targets behind "...".
    assert.doesNotMatch(README, /或 codex \/ codearts \/ \.\.\. \/ all/);
    assert.match(README, /### Other Agents/);
    assert.match(README, /DSH/);
  });
});