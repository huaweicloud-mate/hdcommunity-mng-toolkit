// dsh MCP registration: managed `insert:` entries in the per-profile patch layer.
//
// DSH composes its effective config from patch layers; the per-profile layer is
// `$DSH_HOME/profiles/<profile>/cordis.patch.yml` (web UI profile: `web`). MCP
// servers must be added with the `insert:` key syntax — a bare `- id:` entry
// targets an existing entry and makes dsh warn "patch: entry not found".
//
// The managed block below is written by `install --target dsh` and removed by
// `uninstall --target dsh`. Idempotence is by entry id (so a hand-written entry
// with the same id is never duplicated); removal is by the managed comment
// marker (so a hand-written entry is never deleted).
//
// The text surgery lives in its own module (not inside setup-cli.mjs) so it can
// be unit-tested without importing the CLI entry point. Zero runtime
// dependencies: the patch text is edited directly, no YAML parser is pulled in.

import { accessSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { BACKEND_BASE } from './config.mjs';

export const DSH_DEFAULT_PROFILE = 'web';
export const DSH_PATCH_ID = 'mcp-hdcommunity';
export const DSH_PATCH_MANAGED_COMMENT =
  '# hdcommunity-mng-toolkit: managed MCP patch entry (id: mcp-hdcommunity) — removed by `hdcommunity-mng-toolkit uninstall --target dsh`';

export function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

export function dshPatchFile() {
  const profile = process.env.DSH_PROFILE || DSH_DEFAULT_PROFILE;
  return join(dshHome(), 'profiles', profile, 'cordis.patch.yml');
}

/** Single-quote a YAML scalar ('' escapes a quote inside single quotes). */
export function yamlSingleQuoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Effective backend base for the managed entry (explicit env wins over the production default). */
export function dshBackendBase() {
  return process.env.HDCOMMUNITY_BASE || BACKEND_BASE;
}

/** Render the managed patch block (comment marker + insert: entry). */
export function renderDshPatchEntry(base = dshBackendBase()) {
  return [
    DSH_PATCH_MANAGED_COMMENT,
    '- insert:',
    `    - id: ${DSH_PATCH_ID}`,
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: hdcommunity',
    '        transport: stdio',
    '        command: npx',
    "        args: ['-y', '-p', 'hdcommunity-mng-toolkit', 'hdcommunity-mng-toolkit-mcp']",
    '        env:',
    `          HDCOMMUNITY_BASE: ${yamlSingleQuoted(base)}`,
    '',
    '',
  ].join('\n');
}

/** True when the patch text already registers our entry id (any origin). */
export function findDshPatchEntry(text) {
  // Accept the id bare or quoted (users hand-write both) and bound the
  // indentation so a deeply nested unrelated `id:` field can't match.
  const re = new RegExp(`^[ ]{0,8}-[ ]+id:[ ]*["']?${DSH_PATCH_ID}["']?[ ]*$`, 'm');
  return re.test(text);
}

/** Split the managed block (comment marker + insert: entry + trailing blank). */
function splitDshPatchManagedBlock(lines) {
  const start = lines.findIndex((l) => l.trim() === DSH_PATCH_MANAGED_COMMENT);
  if (start === -1) return null;
  // The managed entry must start on the very next line; if the user deleted or
  // replaced it, only the stale comment is left to remove.
  if (start + 1 >= lines.length || !/^- insert:\s*$/.test(lines[start + 1])) {
    return { start, end: start + 1 };
  }
  let end = start + 2;
  // Every line of the managed entry is indented (or blank); any top-level line
  // — including our own `- insert:` head is already consumed, and a user entry
  // appended without a separating blank line — marks the block end.
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === '' || /^\S/.test(line)) break;
    end++;
  }
  // Only claim the block when it really carries our entry id; otherwise the
  // user replaced our entry with their own and it must be preserved.
  if (!lines.slice(start, end).some((l) => findDshPatchEntry(l))) {
    return { start, end: start + 1 };
  }
  if (end < lines.length && lines[end].trim() === '') end++; // include the blank line
  return { start, end };
}

/**
 * First real content line of the last YAML document (after the final `---`),
 * skipping blanks and comments. `undefined` means the document is empty.
 */
function firstContentLineOfLastDocument(lines) {
  let docStart = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '---') {
      docStart = i + 1;
      break;
    }
  }
  return lines
    .slice(docStart)
    .map((l) => l.trim())
    .find((l) => l !== '' && !l.startsWith('#'));
}

/**
 * Whether the text can take an appended sequence item: the last YAML document
 * must be empty or a sequence. A mapping document (e.g. `model: gpt`) would turn
 * into an illegal mixed document if we appended `- insert:`, so it is refused.
 */
export function isSequenceDocument(text) {
  const first = firstContentLineOfLastDocument(text.split('\n'));
  return first === undefined || first.startsWith('- ');
}

/**
 * Create/update the managed block in the dsh patch file.
 * The managed block is refreshed in place when it already exists (so a changed
 * HDCOMMUNITY_BASE is picked up on reinstall); a hand-written same-id entry is
 * never duplicated nor rewritten.
 * Returns { action: 'created' | 'updated' | 'skipped' | 'invalid' }.
 * `invalid` means the existing file is not a YAML sequence and was left as is.
 */
export function upsertDshPatch(file, base = dshBackendBase()) {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderDshPatchEntry(base));
    return { action: 'created' };
  }
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const block = splitDshPatchManagedBlock(lines);
  const body = renderDshPatchEntry(base);
  // Our managed entry is still there: replace exactly that block.
  if (block && block.end > block.start + 1) {
    const replacement = [...body.replace(/\n+$/, '').split('\n'), ''];
    const next = [...lines.slice(0, block.start), ...replacement, ...lines.slice(block.end)].join('\n');
    if (next === text) return { action: 'skipped' };
    writeFileSync(file, next);
    return { action: 'updated' };
  }
  if (findDshPatchEntry(text)) return { action: 'skipped' };
  // The marker survived but our entry was removed by the user: drop the stale
  // comment so appending below does not leave it stranded above their content.
  if (block) {
    lines.splice(block.start, 1);
    return appendDshPatch(file, lines.join('\n'), body);
  }
  return appendDshPatch(file, text, body);
}

/** Append the managed block to a sequence document; refuse anything else. */
function appendDshPatch(file, text, body) {
  // Only append to YAML sequence documents; refuse anything else (e.g. a
  // plain mapping) instead of corrupting the user's patch file. The append
  // lands in the last document, so leading comments/blank lines and `---`
  // separators are skipped and the first real content line of that document
  // must still be a sequence item.
  if (!isSequenceDocument(text)) return { action: 'invalid' };
  const base = text.length > 0 && !text.endsWith('\n') ? `${text}\n` : text;
  const sep = base.endsWith('\n\n') || base === '' ? '' : '\n';
  writeFileSync(file, `${base}${sep}${body}`);
  return { action: 'updated' };
}

/**
 * Remove the managed block from the dsh patch file.
 * Returns { removed: boolean }; a hand-written same-id entry is kept.
 */
export function removeDshPatchEntry(file) {
  if (!existsSync(file)) return { removed: false };
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const block = splitDshPatchManagedBlock(lines);
  if (!block) return { removed: false };
  lines.splice(block.start, block.end - block.start);
  // Trim a leading blank left behind when the file began with the block.
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  let out = lines.join('\n');
  if (out.trim() === '') out = '';
  writeFileSync(file, out);
  return { removed: true };
}

/**
 * Registration state for `doctor`: 'OK' (managed or hand-written entry),
 * 'MISSING' (no file / no entry), 'INVALID' (file is not a YAML sequence patch).
 */
export function dshPatchState(file = dshPatchFile()) {
  if (!existsSync(file)) return 'MISSING';
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return 'INVALID';
  }
  if (findDshPatchEntry(text)) return 'OK';
  return isSequenceDocument(text) ? 'MISSING' : 'INVALID';
}

/** Deepest existing ancestor of `target` (target itself when it exists). */
function nearestExisting(target) {
  let current = target;
  for (;;) {
    if (existsSync(current)) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Validate the dsh patch destination before any install write.
 * Returns { ok: true, file } or { ok: false, code: 'CONFIG_MISSING' | 'CONFIG_INVALID', file, reason }.
 * The caller prints remediation guidance and must not write anything when ok is false.
 */
export function validateDshConfig(file = dshPatchFile()) {
  const home = dshHome();
  if (existsSync(home)) {
    let st;
    try {
      st = statSync(home);
    } catch {
      return { ok: false, code: 'CONFIG_MISSING', file, reason: `cannot stat DSH_HOME: ${home}` };
    }
    if (!st.isDirectory()) {
      return { ok: false, code: 'CONFIG_MISSING', file, reason: `DSH_HOME is not a directory: ${home}` };
    }
  }

  const ancestor = nearestExisting(dirname(file));
  if (!ancestor) {
    return { ok: false, code: 'CONFIG_MISSING', file, reason: `no existing parent directory for ${file}` };
  }
  let ancestorStat;
  try {
    ancestorStat = statSync(ancestor);
  } catch {
    return { ok: false, code: 'CONFIG_MISSING', file, reason: `cannot stat ${ancestor}` };
  }
  if (!ancestorStat.isDirectory()) {
    return { ok: false, code: 'CONFIG_MISSING', file, reason: `path component is not a directory: ${ancestor}` };
  }
  try {
    accessSync(ancestor, constants.W_OK);
  } catch {
    return { ok: false, code: 'CONFIG_MISSING', file, reason: `directory is not writable: ${ancestor}` };
  }

  if (existsSync(file)) {
    let st;
    try {
      st = statSync(file);
    } catch {
      return { ok: false, code: 'CONFIG_INVALID', file, reason: `cannot stat patch file: ${file}` };
    }
    if (!st.isFile()) {
      return { ok: false, code: 'CONFIG_INVALID', file, reason: `patch path is not a regular file: ${file}` };
    }
    try {
      accessSync(file, constants.W_OK);
    } catch {
      return { ok: false, code: 'CONFIG_INVALID', file, reason: `patch file is not writable: ${file}` };
    }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      return { ok: false, code: 'CONFIG_INVALID', file, reason: `cannot read patch file: ${file}` };
    }
    if (!isSequenceDocument(text)) {
      return {
        ok: false,
        code: 'CONFIG_INVALID',
        file,
        reason: 'existing cordis.patch.yml is not a YAML sequence document',
      };
    }
  }

  return { ok: true, file };
}