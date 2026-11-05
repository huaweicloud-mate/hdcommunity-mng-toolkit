// hdcommunity-mng-toolkit installer CLI.
// Commands: install | uninstall | status | doctor | update | help
//
// TARGETS is the single source of truth for supported agent targets: install('all'),
// status(), doctor() and printHelp() all derive from it, so a new target only has to
// be added in one place. README.md mirrors this list and test/setup-cli.test.mjs locks
// the two together.

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readPackageVersion } from './version.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const SKILLS_SRC = join(PKG_ROOT, 'skills');
const PKG_NAME = 'hdcommunity-mng-toolkit';
const MCP_BIN = 'hdcommunity-mng-toolkit-mcp';
const DEFAULT_TARGET = 'opencode';
const NODE_MIN_MAJOR = 22;
const REGISTRY_TIMEOUT_MS = 2500;

/** Targets whose MCP config this CLI writes automatically (all others print a snippet). */
const MCP_AUTO_TARGETS = Object.freeze(['opencode']);

/**
 * Single source of truth for the supported agent targets.
 * `codex` and `codex-desktop` share `~/.codex/skills`.
 */
export const TARGETS = Object.freeze([
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
]);

const home = homedir();

function skillsDirFor(target) {
  switch (target) {
    case 'opencode':
      return join(home, '.config', 'opencode', 'skills');
    case 'codex':
    case 'codex-desktop':
      return join(home, '.codex', 'skills');
    case 'codearts':
      return join(home, '.codeartsdoer', 'skills');
    case 'codearts-work':
      return join(home, '.codeartswork', 'skills');
    case 'workbuddy':
      return join(home, '.workbuddy', 'skills');
    case 'dsh':
      return join(process.env.DSH_HOME || join(home, '.dsh'), 'skills');
    case 'hermes':
      return join(home, '.hermes', 'skills');
    case 'openclaw':
      return join(home, '.openclaw', 'skills');
    case 'atomcode':
      return join(home, '.atomcode', 'skills');
    default:
      throw new Error(`unknown target: ${target}`);
  }
}

function listSkills() {
  if (!existsSync(SKILLS_SRC)) return [];
  return readdirSync(SKILLS_SRC).filter((n) => existsSync(join(SKILLS_SRC, n, 'SKILL.md')));
}

function installedSkills(destDir) {
  if (!existsSync(destDir)) return [];
  return listSkills().filter((s) => existsSync(join(destDir, s, 'SKILL.md')));
}

function copySkills(destDir) {
  const skills = listSkills();
  mkdirSync(destDir, { recursive: true });
  for (const s of skills) {
    cpSync(join(SKILLS_SRC, s), join(destDir, s), { recursive: true });
  }
  return skills;
}

function opencodeConfigFile() {
  const candidates = [
    join(home, '.config', 'opencode', 'opencode.json'),
    join(home, '.config', 'opencode', 'opencode.jsonc'),
  ];
  return candidates.find((f) => existsSync(f)) || candidates[0];
}

function mcpServerEntry() {
  return { type: 'local', command: ['npx', '-y', '-p', PKG_NAME, MCP_BIN], environment: {}, enabled: true };
}

function mergeOpencodeConfig() {
  const file = opencodeConfigFile();
  let cfg = {};
  if (existsSync(file)) {
    try {
      cfg = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { merged: false, file, reason: 'existing config not valid JSON' };
    }
  }
  cfg.mcp = cfg.mcp || {};
  cfg.mcp[PKG_NAME] = mcpServerEntry();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2));
  return { merged: true, file };
}

function hasOpencodeMcpEntry() {
  const file = opencodeConfigFile();
  if (!existsSync(file)) return false;
  try {
    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    return Boolean(cfg.mcp && cfg.mcp[PKG_NAME]);
  } catch {
    return false;
  }
}

function printGenericSnippet(targets) {
  const snippet = {
    mcpServers: {
      [PKG_NAME]: { command: 'npx', args: ['-y', '-p', PKG_NAME, MCP_BIN] },
    },
  };
  const label = targets.length === 1 ? targets[0] : 'these agents';
  console.log(
    `MCP is auto-registered only for ${MCP_AUTO_TARGETS.join(', ')}. ` +
      `For ${label}, add this MCP server to the agent config:\n`,
  );
  console.log(JSON.stringify(snippet, null, 2));
}

function mergeMcp(target) {
  const r = mergeOpencodeConfig();
  if (r.merged) {
    console.log(`[${target}] MCP config -> ${r.file}`);
  } else {
    console.log(`[${target}] could not merge MCP config (${r.reason}); add manually:`);
    printGenericSnippet([target]);
  }
}

/** Group targets by destination directory (codex / codex-desktop share one). */
function groupBySkillsDir(targets) {
  const groups = new Map();
  for (const t of targets) {
    const dest = skillsDirFor(t);
    if (!groups.has(dest)) groups.set(dest, []);
    groups.get(dest).push(t);
  }
  return groups;
}

function installAll() {
  for (const [dest, names] of groupBySkillsDir(TARGETS)) {
    const skills = copySkills(dest);
    console.log(`[${names.join(', ')}] skills -> ${dest} (${skills.length} skills)`);
  }
  for (const t of TARGETS) {
    if (MCP_AUTO_TARGETS.includes(t)) mergeMcp(t);
  }
  printGenericSnippet(TARGETS.filter((t) => !MCP_AUTO_TARGETS.includes(t)));
}

function install(target) {
  if (target === 'all') {
    installAll();
  } else {
    const dest = skillsDirFor(target);
    const skills = copySkills(dest);
    console.log(`[${target}] skills -> ${dest} (${skills.length} skills)`);
    if (MCP_AUTO_TARGETS.includes(target)) mergeMcp(target);
    else printGenericSnippet([target]);
  }
  console.log(`\nRestart the ${target === 'all' ? 'agent' : target} session so the new skills and MCP tools are loaded.`);
}

function uninstall(target) {
  const targets = target === 'all' ? TARGETS : [target];
  for (const [dest, names] of groupBySkillsDir(targets)) {
    for (const s of listSkills()) {
      const p = join(dest, s);
      if (existsSync(p)) rmSync(p, { recursive: true, force: true });
    }
    console.log(`[${names.join(', ')}] removed skills from ${dest}`);
  }
}

function status() {
  const skills = listSkills();
  console.log(`package: ${PKG_NAME}@${readPackageVersion()}`);
  console.log(`skills source: ${SKILLS_SRC} (${skills.length} skills)`);
  for (const t of TARGETS) {
    const dest = skillsDirFor(t);
    const n = installedSkills(dest).length;
    console.log(`  ${t.padEnd(14)} ${n ? `installed (${n}/${skills.length})` : '-'}  ${dest}`);
  }
}

function doctor() {
  const problems = [];

  console.log(`package: ${PKG_NAME}@${readPackageVersion()}`);

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeOk = nodeMajor >= NODE_MIN_MAJOR;
  console.log(`node:    v${process.versions.node} ${nodeOk ? 'ok' : `too old (need >= ${NODE_MIN_MAJOR})`}`);
  if (!nodeOk) problems.push(`Node.js >= ${NODE_MIN_MAJOR} required, found v${process.versions.node}`);

  const skills = listSkills();
  const srcOk = skills.length > 0;
  console.log(`skills:  ${SKILLS_SRC} (${skills.length} skills) ${srcOk ? 'ok' : 'missing'}`);
  if (!srcOk) problems.push('skills source is missing or empty');

  const installed = TARGETS.filter((t) => installedSkills(skillsDirFor(t)).length > 0);
  console.log(`targets: ${installed.length}/${TARGETS.length} installed${installed.length ? ` (${installed.join(', ')})` : ''}`);
  for (const t of TARGETS) {
    const n = installedSkills(skillsDirFor(t)).length;
    console.log(`  ${t.padEnd(14)} ${n ? `${n}/${skills.length}` : '-'}  ${skillsDirFor(t)}`);
  }

  const cfgFile = opencodeConfigFile();
  console.log(`opencode MCP: ${hasOpencodeMcpEntry() ? 'configured' : 'not configured'} (${cfgFile})`);

  if (problems.length) {
    console.error(`doctor: ${problems.length} problem(s) found`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  if (!installed.length) {
    console.log(`doctor: environment ok, no target installed yet — run \`npx --yes ${PKG_NAME} install --target <agent>\`.`);
  } else {
    console.log('doctor: environment ok');
  }
}

async function update() {
  const current = readPackageVersion();
  console.log(`current: ${PKG_NAME}@${current}`);

  let latest = null;
  try {
    const res = await fetch(`https://registry.npmjs.org/${PKG_NAME}/latest`, {
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = await res.json();
      latest = data.version || null;
    }
  } catch {
    // Offline or registry blocked: fall through to the manual upgrade hint.
  }

  if (latest) console.log(`latest:  ${latest}${latest === current ? ' (up to date)' : ''}`);
  else console.log('latest:  unknown (npm registry unreachable — offline or blocked)');
  console.log(`to update: npx --yes ${PKG_NAME}@latest install --target <agent>`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') args.target = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

/**
 * Validate a --target value. Returns null (and sets exitCode) when it is unknown.
 * An omitted --target resolves to DEFAULT_TARGET.
 */
function resolveTarget(raw) {
  if (!raw) return DEFAULT_TARGET;
  if (raw === 'all' || TARGETS.includes(raw)) return raw;
  console.error(`Unknown target: ${raw}`);
  console.error(`Valid targets: ${TARGETS.join(', ')}, all`);
  console.error(`Omit --target to use the default target (${DEFAULT_TARGET}).`);
  process.exitCode = 1;
  return null;
}

function printHelp() {
  const rows = TARGETS.map((t) => `  ${t.padEnd(14)} ${skillsDirFor(t)}`).join('\n');
  console.log(`${PKG_NAME} installer

Usage:
  npx --yes ${PKG_NAME} install   --target <agent|all>   # default: ${DEFAULT_TARGET}
  npx --yes ${PKG_NAME} uninstall --target <agent|all>
  npx --yes ${PKG_NAME} status
  npx --yes ${PKG_NAME} doctor
  npx --yes ${PKG_NAME} update
  npx --yes ${PKG_NAME} help

Targets (${TARGETS.length}):
${rows}

Omitting --target installs for ${DEFAULT_TARGET}. Unknown targets are rejected.
MCP is auto-registered only for ${MCP_AUTO_TARGETS.join(', ')}; other targets print a snippet to add manually.`);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const cmd = args._[0] || (args.help ? 'help' : undefined);
  const needsTarget = cmd === 'install' || cmd === 'uninstall';
  const target = needsTarget ? resolveTarget(args.target) : undefined;
  if (needsTarget && !target) return;

  switch (cmd) {
    case 'install':
      if (!args.target) console.log(`No --target given; defaulting to ${DEFAULT_TARGET}.`);
      install(target);
      break;
    case 'uninstall':
      if (!args.target) console.log(`No --target given; defaulting to ${DEFAULT_TARGET}.`);
      uninstall(target);
      break;
    case 'status':
      status();
      break;
    case 'doctor':
      doctor();
      break;
    case 'update':
      await update();
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exitCode = 1;
  }
}

// Run only when executed directly (bin/setup.cjs imports and calls main itself,
// tests import TARGETS without triggering a full CLI run).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}