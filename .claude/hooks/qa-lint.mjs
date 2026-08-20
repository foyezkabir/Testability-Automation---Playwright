#!/usr/bin/env node
/**
 * qa-lint - the PostToolUse enforcement entrypoint.
 *
 * Prefers ESLint (AST-accurate) and falls back to qa-guard.mjs (regex) when
 * ESLint is not installed yet. Both report the same rule vocabulary, so the
 * agent sees consistent messages either way.
 *
 * Why two tiers: this repo has no package.json until the qa-scripter agent's
 * Phase 0 scaffolds one. The regex guard needs nothing and works from the first
 * write; ESLint takes over automatically once `npm install` has run and
 * eslint.config.mjs exists at the project root.
 *
 * The two tiers do NOT duplicate each other. ESLint owns every lint rule.
 * qa-guard.mjs owns the PreToolUse secret guard (which has no ESLint analogue)
 * plus a small bootstrap-window subset, and nothing more.
 *
 * The config sits at the PROJECT ROOT and is committed there - ESLint resolves
 * eslint.config.mjs from cwd upward and never searches subdirectories.
 *
 * Exit codes: 0 = clean / out of scope, 2 = blocking (stderr returned to agent).
 * Any internal failure exits 0 - a broken linter must never wedge the agent.
 */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CLAUDE_PROJECT_DIR || join(HERE, '..', '..');

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return null;
  }
}

/** Resolve the local ESLint binary, or null when it is not installed. */
function findEslint() {
  const bin = join(ROOT, 'node_modules', '.bin', 'eslint');
  const config = join(ROOT, 'eslint.config.mjs');
  return existsSync(bin) && existsSync(config) ? bin : null;
}

/** Run the regex guard as a child so its own logic stays the single source. */
function runRegexGuard(payloadRaw) {
  const guard = join(HERE, 'qa-guard.mjs');
  if (!existsSync(guard)) return 0;
  const r = spawnSync(process.execPath, [guard], {
    input: payloadRaw,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 2 ? 2 : 0;
}

function runEslint(bin, filePath) {
  const r = spawnSync(
    bin,
    ['--no-warn-ignored', '--format', 'json', filePath],
    { cwd: ROOT, encoding: 'utf8', timeout: 60_000 },
  );

  // ESLint exits 1 when there are lint errors, 2 on a config/internal error.
  if (r.error || r.status === 2 || !r.stdout) {
    process.stderr.write(
      `qa-lint: ESLint could not run (${r.error?.message || r.stderr?.trim() || 'unknown'}); ` +
      `falling back to the regex guard.\n`,
    );
    return null; // signal fallback
  }

  let results;
  try {
    results = JSON.parse(r.stdout);
  } catch {
    return null;
  }

  const messages = results.flatMap((f) =>
    (f.messages || [])
      .filter((m) => m.severity === 2)
      .map((m) => ({ ...m, filePath: f.filePath })),
  );
  if (messages.length === 0) return 0;

  const rel = filePath.replace(ROOT + '/', '');
  const out = [
    `BLOCKED by qa-lint (ESLint) - ${messages.length} CLAUDE.md violation(s) in ${rel}`,
    '',
  ];
  for (const m of messages.sort((a, b) => a.line - b.line)) {
    out.push(`  ${rel}:${m.line}:${m.column}  [${m.ruleId ?? 'error'}]`);
    out.push(`    ${m.message}`);
    out.push('');
  }
  out.push('These are the "zero tolerance" rules in CLAUDE.md. Fix the file - do not');
  out.push('work around the check, and do not edit the lint config to silence it.');
  out.push('If a rule is genuinely wrong for this case, say so and ask the user.');
  process.stderr.write(out.join('\n') + '\n');
  return 2;
}

function main() {
  const raw = readFileSync(0, 'utf8') || '{}';
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return 0;
  }

  const input = payload.tool_input ?? {};
  const filePath = input.file_path ?? input.filePath ?? '';
  if (!filePath) return 0;

  // PreToolUse (secret guard) has no ESLint equivalent - always the guard.
  if (payload.hook_event_name === 'PreToolUse') return runRegexGuard(raw);

  if (!/\.ts$/.test(filePath)) return 0;
  if (!existsSync(filePath)) return 0;

  const bin = findEslint();
  if (bin) {
    const code = runEslint(bin, filePath);
    if (code !== null) return code;
  }
  return runRegexGuard(raw);
}

let code = 0;
try {
  code = main();
} catch (err) {
  process.stderr.write(`qa-lint internal error (ignored): ${err?.message}\n`);
  code = 0;
}
process.exit(code);
