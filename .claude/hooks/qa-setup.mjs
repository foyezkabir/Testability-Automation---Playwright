#!/usr/bin/env node
/**
 * qa-setup - the deterministic half of Phase 0, run by the harness.
 *
 * Phase 0 in SKILL.md mixes two kinds of work:
 *   - MECHANICAL: npm install, copy the lint config, write tsconfig.json, seed
 *     .env from .env.example. No judgement; identical every time.
 *   - JUDGEMENT: writing playwright.config.ts / fixtures / global-setup to suit
 *     the app, deciding roles, proving the smoke test green.
 *
 * This hook owns the mechanical half so it cannot be half-done or skipped. The
 * agent's Phase 0 then only VERIFIES.
 *
 * The failure it exists to close: if the agent forgets to copy
 * eslint.config.mjs + qa-rules.mjs to the project root, the AST lint tier never
 * activates and enforcement silently degrades to the regex fallback. Nothing
 * warns you. That copy is two lines of shell - it should never depend on memory.
 *
 * SAFETY: `npm install` is not something to run speculatively. This refuses to
 * act unless the directory positively identifies as THIS project (see isOurs()).
 * Everything is idempotent - safe to re-run, and it self-skips when satisfied.
 *
 * Exit codes: always 0 or 1. Never 2 - setup is not a gate and must not block a
 * session. Failures are reported and the agent's Phase 0 picks them up.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const p = (...x) => join(ROOT, ...x);
const has = (...x) => existsSync(p(...x));

const log = [];
const note = (s) => log.push(s);

/**
 * Only touch a directory that is unmistakably this project.
 *
 * Requires the qa-scripter skill AND the enforcement hooks - a combination no
 * unrelated repo will have. Without this, a stray CLAUDE_PROJECT_DIR could
 * trigger npm install somewhere it does not belong.
 */
function isOurs() {
  return has('.claude', 'skills', 'qa-scripter', 'SKILL.md') && has('.claude', 'hooks', 'qa-lint.mjs');
}

const DEV_DEPS = [
  '@playwright/test',
  'typescript',
  '@types/node',
  '@faker-js/faker',
  'dotenv',
  'playwright-smart-reporter',
  'eslint',
  'typescript-eslint',
];

/** tsconfig.json exactly as Phase 0 specifies it (verified working 2026-07-15). */
const TSCONFIG = {
  compilerOptions: {
    strict: true,
    target: 'ES2020',
    lib: ['ESNext', 'DOM'],
    module: 'commonjs',
    esModuleInterop: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    types: ['node'],
    outDir: './dist',
    rootDir: './',
  },
  include: ['**/*.ts'],
  exclude: ['node_modules', 'dist'],
};

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', timeout: 600_000, encoding: 'utf8' });
}

function main() {
  try {
    readFileSync(0, 'utf8');
  } catch { /* no stdin */ }

  if (!isOurs()) return 0; // not this project - do nothing, silently

  /* --- 1. lint config sanity check ---------------------------------------- */
  // eslint.config.mjs + qa-rules.mjs live at the project root and are COMMITTED
  // there - ESLint only resolves its config from the cwd upward, never a
  // subdirectory, so the root is the only place they can work. Nothing to copy;
  // just report if they went missing, because their absence silently downgrades
  // enforcement to the narrower regex guard.
  for (const f of ['eslint.config.mjs', 'qa-rules.mjs']) {
    if (!has(f)) note(`WARNING: ${f} missing from the project root - the AST lint tier is OFF (regex fallback only). Restore it from git.`);
  }

  /* --- 1b. fixtures/evidence.ts - the one file with a committed template --- */
  // CLAUDE.md requires this be scaffolded VERBATIM from the template, and
  // evidence-drift.sh blocks any divergence. Copying it here removes the only
  // way that rule can be broken. playwright.config.ts / base.ts /
  // global-setup.ts stay the agent's job: they are written from SKILL.md and
  // then adapted per app, so a hook must not own them.
  if (existsSync(p('.claude', 'templates', 'evidence.ts')) && !has('fixtures', 'evidence.ts')) {
    if (!existsSync(p('fixtures'))) mkdirSync(p('fixtures'), { recursive: true });
    copyFileSync(p('.claude', 'templates', 'evidence.ts'), p('fixtures', 'evidence.ts'));
    note('copied fixtures/evidence.ts from .claude/templates/evidence.ts');
  }

  /* --- 2. tsconfig.json ---------------------------------------------------- */
  if (!has('tsconfig.json')) {
    writeFileSync(p('tsconfig.json'), JSON.stringify(TSCONFIG, null, 2) + '\n');
    note('wrote tsconfig.json');
  }

  /* --- 3. .env seeded from the committed template -------------------------- */
  // Values stay empty: credentials cannot be invented, only the user fills them.
  if (!has('.env') && has('.env.example')) {
    copyFileSync(p('.env.example'), p('.env'));
    note('seeded .env from .env.example (values left empty - fill them in)');
  }

  /* --- 4. deps ------------------------------------------------------------- */
  // Only install when the marker dep is absent, so a warm project self-skips.
  const playwrightInstalled = has('node_modules', '@playwright', 'test');
  if (!playwrightInstalled) {
    try {
      if (!has('package.json')) {
        run('npm', ['init', '-y']);
        note('npm init -y');
      }
      run('npm', ['install', '--save-dev', ...DEV_DEPS]);
      note(`npm install --save-dev (${DEV_DEPS.length} dev deps)`);
    } catch (e) {
      note(`npm install FAILED: ${String(e.message).split('\n')[0]} - Phase 0 must retry`);
    }
  }

  /* --- 5. lint script in package.json ------------------------------------- */
  if (has('package.json')) {
    try {
      const pkgPath = p('package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      pkg.scripts ??= {};
      let changed = false;
      if (!pkg.scripts.lint) {
        pkg.scripts.lint = 'eslint .';
        changed = true;
      }
      if (!pkg.scripts.typecheck) {
        pkg.scripts.typecheck = 'tsc --noEmit';
        changed = true;
      }
      if (changed) {
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        note('added npm scripts: lint, typecheck');
      }
    } catch { /* malformed package.json - leave it to Phase 0 */ }
  }

  /* --- 6. companion dirs the gates read ----------------------------------- */
  for (const d of ['baselines', 'plan', 'traceability', 'findings']) {
    if (!has(d)) {
      mkdirSync(p(d), { recursive: true });
      note(`created ${d}/`);
    }
  }

  if (log.length === 0) return 0; // already satisfied - stay quiet

  const text =
    `qa-setup (mechanical half of Phase 0):\n` +
    log.map((l) => `  - ${l}`).join('\n');

  process.stdout.write(
    JSON.stringify({
      systemMessage: text,
      hookSpecificOutput: {
        hookEventName: 'Setup',
        additionalContext:
          `${text}\n` +
          `These steps are DONE - Phase 0 should verify, not repeat them. ` +
          `Still yours: playwright.config.ts, fixtures/, global-setup.ts, ` +
          `browser binaries (npx playwright install), and proving the smoke test green.`,
      },
    }),
  );
  return 0;
}

let code = 0;
try {
  code = main();
} catch (err) {
  process.stderr.write(`qa-setup error (non-blocking): ${err?.message}\n`);
  code = 0;
}
process.exit(code);
