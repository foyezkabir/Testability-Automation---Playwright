#!/usr/bin/env node
/**
 * qa-coverage - turns the SKILL.md COMPLETENESS CRITIC gate into a real gate.
 *
 * Runs on Stop (the agent trying to finish its turn), because coverage is a
 * property of the WHOLE suite: judging it per-write would fire constantly while
 * the agent is still partway through generating a module.
 *
 * "Coverage" here is REQUIREMENT coverage, not istanbul/c8 line coverage. A
 * Playwright suite exercises the app, not itself, so line coverage of the spec
 * files is meaningless. What matters is that every planned TC exists, every AC
 * has a test, and the numbers on disk are honest.
 *
 * Reconciles three artifacts the agent already writes:
 *   plan/<module>.md          - view x state x action -> intended TC-XX + tag
 *   tests/*.spec.ts           - the tests actually authored
 *   traceability/<module>.txt - AC -> TC map, GAP-flagged, with a Coverage line
 *
 * Checks:
 *   1. planned TC with no test           (the CRITIC gate, mechanised)
 *   2. test with no plan row             (unplanned drive-by test)
 *   3. duplicate TC number               (two tests claiming TC-04)
 *   4. test with no tier tag             (@smoke/@critical/@regression)
 *   5. GAP line in traceability          (AC with no test)
 *   6. Coverage: N/M line disagreeing with reality
 *
 * Exit codes: 0 = clean / nothing to check. 2 = blocking (stderr -> agent).
 * Any internal failure exits 0 - a broken gate must never trap the agent in a
 * turn it cannot end.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const read = (p) => {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
};

const listFiles = (dir, re) => {
  try {
    if (!statSync(dir).isDirectory()) return [];
    return readdirSync(dir).filter((f) => re.test(f)).map((f) => join(dir, f));
  } catch {
    return [];
  }
};

/** Strip comments/strings so a TC id inside prose is not mistaken for a test. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

const TC = /\bTC-(\d+)\b/;
const norm = (n) => `TC-${String(parseInt(n, 10)).padStart(2, '0')}`;

/**
 * TC ids are unique **per module**, not across the suite - every module starts at
 * TC-01, the way any test-management tool numbers cases. The module is the file
 * stem (`tests/chambers.spec.ts` and `plan/chambers.md` are both `chambers`), so
 * `chambers/TC-01` and `auth/TC-01` are different ids and both are legal.
 *
 * An earlier version keyed on the bare number, which forced later modules to
 * start at arbitrary offsets ("chambers begins at TC-30 because auth took 1-24").
 * That made a module's numbering depend on unrelated modules and broke whenever
 * an earlier module grew.
 */
const stemOf = (file) =>
  file.replace(/^.*\//, '').replace(/\.spec\.ts$/, '').replace(/\.md$/, '');

/**
 * Map a spec file to the module that owns it.
 *
 * A module's specs are often SPLIT across several files - `chambers-list.spec.ts`,
 * `chambers-empty.spec.ts`, `chambers.crud.spec.ts` all belong to `plan/chambers.md`.
 * Matching on the exact stem would scope each file to its own pseudo-module, so
 * every test reads as "unplanned" AND every plan row as "missing" at the same time.
 *
 * So: pick the LONGEST plan name that the spec stem starts with, on a segment
 * boundary (`-`, `.`, `_`). `chambers-list` -> `chambers`; `chambers` -> `chambers`.
 * Longest-wins so `chambers-billing` prefers a `chambers-billing` plan over
 * `chambers` when both exist. No alias table to maintain - the naming convention
 * IS the mapping, and a spec that matches no plan keeps its own stem so it still
 * shows up as unplanned rather than being silently absorbed.
 */
function moduleOf(file, planNames = []) {
  const stem = stemOf(file);
  let best = null;
  for (const p of planNames) {
    if (stem === p) return p;
    if (stem.startsWith(p) && /[-._]/.test(stem.charAt(p.length))) {
      if (!best || p.length > best.length) best = p;
    }
  }
  return best ?? stem;
}
const qualify = (module, id) => `${module}/${id}`;

/* ------------------------------------------------------------------ *
 * Parse the three artifacts
 * ------------------------------------------------------------------ */

/** Every TC id declared in plan/<module>.md, with its row text. */
function parsePlan(file) {
  const src = read(file);
  if (src === null) return null;
  const out = new Map();
  for (const line of src.split('\n')) {
    // skip fenced code and obvious headings
    if (/^\s*(```|#)/.test(line)) continue;
    const m = line.match(/\bTC-(\d+)\b/g);
    if (!m) continue;
    for (const raw of m) {
      const id = norm(raw.slice(3));
      if (!out.has(id)) {
        out.set(id, line.trim().replace(/\s+/g, ' ').slice(0, 100));
      }
    }
  }
  return out;
}

/** Every test authored in tests/, keyed by TC id. */
function parseTests(planNames = []) {
  const files = listFiles(join(ROOT, 'tests'), /\.spec\.ts$/);
  const byId = new Map();
  const problems = [];

  for (const file of files) {
    const raw = read(file);
    if (raw === null) continue;
    const clean = codeOnly(raw);
    const rel = file.replace(ROOT + '/', '');

    // test('...', { tag: [...] }, async (...) => {})   |   test('...', async () => {})
    const re = /(^|[^.\w])test\s*(?:\.\s*(?:only|skip|fixme)\s*)?\(\s*(['"`])/g;
    let m;
    while ((m = re.exec(clean)) !== null) {
      const quote = m[2];
      const start = m.index + m[0].length;
      let j = start;
      while (j < raw.length && raw[j] !== quote) {
        if (raw[j] === '\\') j++;
        j++;
      }
      const title = raw.slice(start, j);
      const line = raw.slice(0, m.index).split('\n').length;

      // the options object, if any, sits between the title and the callback
      const after = raw.slice(j + 1, j + 400);
      const tags = [...after.matchAll(/@(smoke|critical|regression)\b/g)].map((t) => t[0]);

      const idm = title.match(TC);
      const entry = { file: rel, line, title, tags };

      if (!idm) {
        problems.push({ ...entry, kind: 'no-tc-id' });
        continue;
      }
      // Qualify by module so every module may start at TC-01. A duplicate is only
      // a duplicate WITHIN one module's specs.
      const id = qualify(moduleOf(rel, planNames), norm(idm[1]));
      if (byId.has(id)) {
        problems.push({ ...entry, kind: 'duplicate', id, other: byId.get(id) });
      } else {
        byId.set(id, entry);
      }
      if (tags.length === 0) problems.push({ ...entry, kind: 'no-tag', id });
    }
  }
  return { byId, problems, fileCount: files.length };
}

/** GAP lines and the Coverage: N/M claim from traceability/<module>.txt. */
function parseTraceability(file) {
  const src = read(file);
  if (src === null) return null;
  const gaps = [];
  let claimed = null;
  const acs = new Set();

  for (const line of src.split('\n')) {
    const ac = line.match(/^\s*(AC-[\w.]+)\b/);
    if (ac) {
      acs.add(ac[1]);
      if (/\bGAP\b/i.test(line) || /→\s*\(none\)/.test(line) || /->\s*\(none\)/.test(line)) {
        gaps.push(line.trim().replace(/\s+/g, ' ').slice(0, 110));
      }
    }
    const cov = line.match(/Coverage:\s*(\d+)\s*\/\s*(\d+)/i);
    if (cov) claimed = { covered: +cov[1], total: +cov[2], line: line.trim() };
  }
  return { gaps, claimed, acTotal: acs.size };
}

/* ------------------------------------------------------------------ *
 * Reconcile
 * ------------------------------------------------------------------ */

function main() {
  // Read the Stop payload but do not depend on its contents.
  try {
    readFileSync(0, 'utf8');
  } catch { /* no stdin - fine */ }

  const planFiles = listFiles(join(ROOT, 'plan'), /\.md$/);
  const testsDir = join(ROOT, 'tests');

  // Nothing authored yet (bootstrap, or a non-authoring turn) - nothing to gate.
  if (!existsSync(testsDir)) return 0;
  const planNames = planFiles.map((f) => stemOf(f));
  const { byId: tests, problems, fileCount } = parseTests(planNames);
  if (fileCount === 0) return 0;
  if (planFiles.length === 0 && tests.size === 0) return 0;

  const sections = [];

  /* --- per-module: plan vs tests --- */
  const plannedAll = new Set();
  for (const pf of planFiles) {
    const module = pf.replace(/^.*\//, '').replace(/\.md$/, '');
    const planned = parsePlan(pf);
    if (!planned || planned.size === 0) continue;

    const missing = [];
    for (const [id, row] of planned) {
      const qid = qualify(module, id);
      plannedAll.add(qid);
      if (!tests.has(qid)) missing.push({ id, row });
    }
    if (missing.length) {
      sections.push({
        title: `MISSING - planned in plan/${module}.md, never written (${missing.length})`,
        lines: missing.map((m) => `${m.id}  ${m.row}`),
        fix: 'Write these tests. If one is genuinely out of scope, remove the plan row and say why in the plan - do not leave it dangling.',
      });
    }

    const tr = parseTraceability(join(ROOT, 'traceability', `${module}.txt`));
    if (tr) {
      if (tr.gaps.length) {
        sections.push({
          title: `GAP - AC with no test in traceability/${module}.txt (${tr.gaps.length})`,
          lines: tr.gaps,
          fix: 'The CRITIC gate in SKILL.md is "proceed only at zero-missing". Cover each AC, or record it as explicitly out of scope with a reason.',
        });
      }
      if (tr.claimed) {
        const actualCovered = tr.claimed.total - tr.gaps.length;
        if (tr.claimed.covered !== actualCovered) {
          sections.push({
            title: `DISHONEST COVERAGE LINE in traceability/${module}.txt`,
            lines: [
              `claims:  ${tr.claimed.line}`,
              `actual:  ${actualCovered}/${tr.claimed.total} (${tr.gaps.length} GAP line(s) counted)`,
            ],
            fix: 'Regenerate the matrix from the real TC list. A wrong number is worse than a missing one - it reads as covered when it is not.',
          });
        }
      }
    }
  }

  /* --- tests with no plan row --- */
  if (plannedAll.size > 0) {
    const unplanned = [...tests.entries()].filter(([id]) => !plannedAll.has(id));
    if (unplanned.length) {
      sections.push({
        title: `UNPLANNED - in tests/, absent from its module's plan (${unplanned.length})`,
        lines: unplanned.map(([id, t]) => `${id}  ${t.file}:${t.line}  "${t.title.slice(0, 62)}"`),
        fix: 'Add a plan row (view x state x action -> TC + tag) so the plan stays the source of truth, then regenerate traceability.',
      });
    }
  }

  /* --- structural problems --- */
  const dupes = problems.filter((p) => p.kind === 'duplicate');
  if (dupes.length) {
    sections.push({
      title: `DUPLICATE TC NUMBER within one module (${dupes.length})`,
      lines: dupes.map((d) => `${d.id}  ${d.file}:${d.line}  collides with ${d.other.file}:${d.other.line}`),
      fix: 'TC ids must be unique WITHIN a module (they are namespaced by module, so auth/TC-01 and chambers/TC-01 are both fine - every module starts at TC-01). Two tests in the same module claiming the same number silently hides one from coverage.',
    });
  }

  const noId = problems.filter((p) => p.kind === 'no-tc-id');
  if (noId.length) {
    sections.push({
      title: `NO TC ID (${noId.length})`,
      lines: noId.map((p) => `${p.file}:${p.line}  "${p.title.slice(0, 62)}"`),
      fix: 'Every test name starts `TC-XX: Verify that ...` - without an id it cannot be traced to an AC or a plan row.',
    });
  }

  const noTag = problems.filter((p) => p.kind === 'no-tag');
  if (noTag.length) {
    sections.push({
      title: `NO TIER TAG (${noTag.length})`,
      lines: noTag.map((p) => `${p.id ?? '??'}  ${p.file}:${p.line}`),
      fix: 'Tag each test via { tag: [...] } - @smoke (proves-it-works, ~1-3/module) · @critical (auth/payment/data/permissions) · @regression (default). Decide by scenario role.',
    });
  }

  if (sections.length === 0) return 0;

  const out = [
    `BLOCKED by qa-coverage - the COMPLETENESS CRITIC gate is not satisfied`,
    ``,
    `  ${tests.size} test(s) across ${fileCount} spec file(s); ${plannedAll.size} planned TC(s).`,
    ``,
  ];
  for (const s of sections) {
    out.push(`  ${s.title}`);
    for (const l of s.lines.slice(0, 12)) out.push(`    ${l}`);
    if (s.lines.length > 12) out.push(`    ... and ${s.lines.length - 12} more`);
    out.push(`    -> ${s.fix}`);
    out.push('');
  }
  out.push(`SKILL.md step 6: "Fail and loop ... Proceed only at zero-missing."`);
  out.push(`Finish the coverage before ending the turn. Do not delete plan rows or`);
  out.push(`edit the Coverage line to make this pass - fix the tests.`);

  process.stderr.write(out.join('\n') + '\n');
  return 2;
}

let code = 0;
try {
  code = main();
} catch (err) {
  process.stderr.write(`qa-coverage internal error (ignored): ${err?.message}\n`);
  code = 0;
}
process.exit(code);
