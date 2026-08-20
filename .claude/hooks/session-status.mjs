#!/usr/bin/env node
/**
 * session-status - prints the project's actual enforcement + readiness state at
 * session start.
 *
 * Exists because config loads at STARTUP: hooks, MCP servers, skills and agent
 * specs are all read once when the session begins. After editing any of them you
 * must restart, and until now there was no way to confirm the restart took
 * effect except by triggering a rule. This reports it directly.
 *
 * Emits `additionalContext` so the facts land in the agent's context too - which
 * tier of linting is live changes how it should read a block message.
 *
 * Always exits 0. This hook reports; it never blocks.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const p = (...x) => join(ROOT, ...x);

const has = (...x) => existsSync(p(...x));
const count = (dir, re) => {
  try {
    if (!statSync(p(dir)).isDirectory()) return 0;
    return readdirSync(p(dir)).filter((f) => re.test(f)).length;
  } catch {
    return 0;
  }
};
const read = (...x) => {
  try {
    return readFileSync(p(...x), 'utf8');
  } catch {
    return null;
  }
};

/* --- which gates are armed (read settings, do not assume) --- */
let events = [];
try {
  const s = JSON.parse(read('.claude', 'settings.json') ?? '{}');
  events = Object.keys(s.hooks ?? {});
} catch { /* unreadable - report as none */ }

const gates = [];
if (events.includes('PreToolUse')) gates.push('secrets');
if (events.includes('PostToolUse')) gates.push('lint');
if (events.includes('Stop')) gates.push('coverage', 'crawl');

/* --- which lint tier is actually live --- */
const eslintReady = has('node_modules', '.bin', 'eslint') && has('eslint.config.mjs');
const lintTier = !events.includes('PostToolUse')
  ? 'OFF'
  : eslintReady
    ? 'ESLint (AST, full ruleset)'
    : 'regex fallback (bootstrap subset) - run Phase 0 for the full ruleset';

/* --- project readiness --- */
const deps = has('package.json');
const envFile = read('.env');
const envKeys = envFile
  ? Object.fromEntries(
      envFile
        .split('\n')
        .filter((l) => /^\s*[A-Z_]+\s*=/.test(l))
        .map((l) => {
          const [k, ...v] = l.split('=');
          return [k.trim(), v.join('=').trim()];
        }),
    )
  : null;
const missingEnv = envKeys
  ? Object.entries(envKeys).filter(([, v]) => !v).map(([k]) => k)
  : null;

const nBaselines = count('baselines', /\.baseline\.json$/);
const nPlans = count('plan', /\.md$/);
const nSpecs = count('tests', /\.spec\.ts$/);
const nAuth = count('.auth', /\.json$/);

/* --- render --- */
const lines = [];
lines.push(`qa-scripter | gates: ${gates.length ? gates.join(' ') : 'NONE (hooks not loaded - restart?)'}`);
lines.push(`  lint tier : ${lintTier}`);
lines.push(
  `  project   : ${deps ? 'deps installed' : 'NO package.json (Phase 0 pending)'}` +
  ` · baselines ${nBaselines} · plans ${nPlans} · specs ${nSpecs} · auth ${nAuth}`,
);

if (!envFile) {
  lines.push(`  .env      : MISSING - copy .env.example and fill BASE_URL + creds`);
} else if (missingEnv && missingEnv.length) {
  lines.push(`  .env      : ${missingEnv.length} empty key(s): ${missingEnv.slice(0, 6).join(', ')}`);
} else {
  lines.push(`  .env      : filled`);
}

// The one ordering rule the crawl gate imposes, surfaced when it matters.
if (nBaselines === 0 && nPlans > 0) {
  lines.push(`  ! plan/ exists with no baselines/ - capture the baseline FIRST; it is the plan's checklist`);
}
if (nSpecs > 0 && nBaselines === 0) {
  lines.push(`  ! specs exist with no baseline - locators must come from a live crawl, not memory`);
}

const text = lines.join('\n');
process.stdout.write(
  JSON.stringify({
    systemMessage: text,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        `Enforcement state for this session (from .claude/settings.json):\n${text}\n` +
        `Gate details: .claude/hooks/RULES.md. Blocks are fixed in the code, never by editing a hook or config.`,
    },
  }),
);
process.exit(0);
