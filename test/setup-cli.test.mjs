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
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, HOME: home, DSH_HOME: join(home, '.dsh'), ...extraEnv },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

function dshPatchPath(profile = 'web', dshHome = join(home, '.dsh')) {
  return join(dshHome, 'profiles', profile, 'cordis.patch.yml');
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

describe('dsh MCP auto-registration', () => {
  test('install --target dsh writes the managed insert entry and no longer prints a snippet', () => {
    const { stdout, status } = run(['install', '--target', 'dsh']);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /MCP config/);
    assert.doesNotMatch(stdout, /For dsh, add this MCP server/);
    const file = dshPatchPath();
    assert.ok(existsSync(file), 'cordis.patch.yml should be created');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^- insert:$/m);
    assert.match(text, /id: mcp-hdcommunity/);
    assert.match(text, /name: '@deepseek-ai\/dsh-mcp-client'/);
    assert.match(text, /serverName: hdcommunity/);
    assert.match(text, /'-y', '-p', 'hdcommunity-mng-toolkit', 'hdcommunity-mng-toolkit-mcp'/);
    assert.ok(existsSync(join(home, '.dsh', 'skills', SKILL, 'SKILL.md')));
  });

  test('reinstall keeps exactly one managed entry', () => {
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    const { stdout, status } = run(['install', '--target', 'dsh']);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /already registered/);
    const text = readFileSync(dshPatchPath(), 'utf8');
    assert.equal((text.match(/^\s+- id: mcp-hdcommunity$/gm) || []).length, 1);
  });

  test('uninstall removes only the managed entry, keeping user content', () => {
    const file = dshPatchPath();
    mkdirSync(join(home, '.dsh', 'profiles', 'web'), { recursive: true });
    writeFileSync(file, '- insert:\n    - id: user-entry\n      name: keep-me\n');
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    const { stdout, status } = run(['uninstall', '--target', 'dsh']);
    assert.equal(status, 0, stdout);
    const text = readFileSync(file, 'utf8');
    assert.match(text, /id: user-entry/);
    assert.doesNotMatch(text, /id: mcp-hdcommunity/);
    assert.equal(existsSync(join(home, '.dsh', 'skills', SKILL)), false);
  });

  test('a hand-written same-id entry is not duplicated by install and survives uninstall', () => {
    const file = dshPatchPath();
    mkdirSync(join(home, '.dsh', 'profiles', 'web'), { recursive: true });
    const handwritten = '- insert:\n    - id: mcp-hdcommunity\n      name: mine\n';
    writeFileSync(file, handwritten);
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    assert.equal(readFileSync(file, 'utf8'), handwritten);
    assert.equal(run(['uninstall', '--target', 'dsh']).status, 0);
    assert.equal(readFileSync(file, 'utf8'), handwritten);
  });

  test('DSH_HOME and DSH_PROFILE overrides are honoured', () => {
    const customHome = join(home, 'custom-dsh');
    const { status } = run(['install', '--target', 'dsh'], { DSH_HOME: customHome, DSH_PROFILE: 'qa' });
    assert.equal(status, 0);
    assert.ok(existsSync(dshPatchPath('qa', customHome)));
    assert.ok(existsSync(join(customHome, 'skills', SKILL, 'SKILL.md')));
    assert.equal(existsSync(join(home, '.dsh')), false);
  });

  test('non-sequence patch file fails fast with guidance and no partial write', () => {
    const file = dshPatchPath();
    mkdirSync(join(home, '.dsh', 'profiles', 'web'), { recursive: true });
    writeFileSync(file, 'model: gpt\n');
    const { stdout, stderr, status } = run(['install', '--target', 'dsh']);
    assert.equal(status, 1);
    const message = `${stdout}\n${stderr}`;
    assert.match(message, /CONFIG_INVALID/);
    assert.match(message, /cordis\.patch\.yml/);
    assert.match(message, /YAML sequence/);
    assert.equal(readFileSync(file, 'utf8'), 'model: gpt\n');
    assert.equal(existsSync(join(home, '.dsh', 'skills')), false, 'skills must not be copied');
  });

  test('DSH_HOME pointing at a file fails fast with guidance and no partial write', () => {
    const badHome = join(home, 'dsh-is-a-file');
    writeFileSync(badHome, 'x');
    const { stdout, stderr, status } = run(['install', '--target', 'dsh'], { DSH_HOME: badHome });
    assert.equal(status, 1);
    const message = `${stdout}\n${stderr}`;
    assert.match(message, /CONFIG_MISSING/);
    assert.match(message, /DSH_HOME/);
    assert.equal(existsSync(join(home, '.dsh', 'skills')), false, 'skills must not be copied');
  });

  test('doctor reports dsh MCP MISSING, OK and INVALID', () => {
    assert.match(run(['doctor']).stdout, /dsh MCP: MISSING/);
    assert.equal(run(['install', '--target', 'dsh']).status, 0);
    assert.match(run(['doctor']).stdout, /dsh MCP: OK/);
    writeFileSync(dshPatchPath(), 'model: gpt\n');
    const invalid = run(['doctor']);
    assert.match(invalid.stdout, /dsh MCP: INVALID/);
    assert.equal(invalid.status, 1);
  });

  test('install --target all registers dsh too', () => {
    assert.equal(run(['install', '--target', 'all']).status, 0);
    assert.match(readFileSync(dshPatchPath(), 'utf8'), /id: mcp-hdcommunity/);
  });
});

describe('uninstall', () => {
  const opencodeConfigPath = () => join(home, '.config', 'opencode', 'opencode.json');

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

  test('--target opencode removes the managed MCP entry, leaving valid JSON (Issue #13)', () => {
    assert.equal(run(['install', '--target', 'opencode']).status, 0);
    assert.match(readFileSync(opencodeConfigPath(), 'utf8'), /hdcommunity/);

    const { stdout, status } = run(['uninstall', '--target', 'opencode']);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /MCP config removed from/);

    const text = readFileSync(opencodeConfigPath(), 'utf8');
    assert.equal((text.match(/hdcommunity/g) || []).length, 0, `residual managed entries: ${text}`);
    const cfg = JSON.parse(text);
    assert.equal(cfg.mcp['hdcommunity-mng-toolkit'], undefined);
    assert.equal(existsSync(join(home, '.config', 'opencode', 'skills', SKILL)), false);
  });

  test('uninstall keeps the user other MCP entries and top-level fields (Issue #13)', () => {
    const file = opencodeConfigPath();
    mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
    const userConfig = {
      theme: 'dark',
      mcp: { 'user-server': { type: 'local', command: ['npx', 'user-mcp'] } },
    };
    writeFileSync(file, JSON.stringify(userConfig, null, 2));
    assert.equal(run(['install', '--target', 'opencode']).status, 0);
    assert.equal(run(['uninstall', '--target', 'opencode']).status, 0);

    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(cfg.theme, 'dark');
    assert.deepEqual(cfg.mcp['user-server'], userConfig.mcp['user-server']);
    assert.equal(cfg.mcp['hdcommunity-mng-toolkit'], undefined);
  });

  test('uninstall without an install is harmless and creates no file (Issue #13)', () => {
    const { stdout, status } = run(['uninstall', '--target', 'opencode']);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /MCP config not found in/);
    assert.equal(existsSync(opencodeConfigPath()), false, 'must not create an empty config file');
  });

  test('install after uninstall keeps exactly one managed MCP entry (Issue #13)', () => {
    assert.equal(run(['install', '--target', 'opencode']).status, 0);
    assert.equal(run(['uninstall', '--target', 'opencode']).status, 0);
    assert.equal(run(['install', '--target', 'opencode']).status, 0);
    const cfg = JSON.parse(readFileSync(opencodeConfigPath(), 'utf8'));
    assert.ok(cfg.mcp['hdcommunity-mng-toolkit']);
    const text = readFileSync(opencodeConfigPath(), 'utf8');
    assert.equal((text.match(/"hdcommunity-mng-toolkit"\s*:/g) || []).length, 1);
  });

  test('uninstall --target all removes the opencode MCP entry too (Issue #13)', () => {
    assert.equal(run(['install', '--target', 'all']).status, 0);
    assert.match(readFileSync(opencodeConfigPath(), 'utf8'), /hdcommunity/);
    assert.equal(run(['uninstall', '--target', 'all']).status, 0);
    const cfg = JSON.parse(readFileSync(opencodeConfigPath(), 'utf8'));
    assert.equal(cfg.mcp['hdcommunity-mng-toolkit'], undefined);
    assert.equal((readFileSync(opencodeConfigPath(), 'utf8').match(/hdcommunity/g) || []).length, 0);
  });

  test('a config without the managed entry is left untouched (Issue #13)', () => {
    const file = opencodeConfigPath();
    mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
    const text = JSON.stringify({ mcp: { 'user-server': { type: 'local', command: ['npx', 'x'] } } }, null, 2);
    writeFileSync(file, text);
    const { stdout, status } = run(['uninstall', '--target', 'opencode']);
    assert.equal(status, 0, stdout);
    assert.equal(readFileSync(file, 'utf8'), text, 'file must not be rewritten when there is nothing to remove');
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