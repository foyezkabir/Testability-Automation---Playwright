#!/usr/bin/env node
/**
 * qa-crawl - proves the CRAWL was exhaustive, instead of trusting that it was.
 *
 * The insight that makes this possible: baselines/<module>.baseline.json is
 * ALREADY an exhaustive machine-readable inventory of the page - every action,
 * icon, table column, row action, modal, field, nested menu item and sub-view.
 * So the crawl does not need to be re-done to be checked; it needs to be
 * RECONCILED against what the plan covers.
 *
 *     baseline.json   -> every control that exists on the page
 *     plan/<mod>.md   -> what the agent intends to test
 *     tests/*.spec.ts -> what it actually wrote
 *
 * A control present in the baseline but named in NO plan row is a provable
 * crawl/coverage gap. That is the check.
 *
 * It also detects a SHALLOW crawl - a baseline that is suspiciously thin in the
 * places gaps hide (no expanded ⋮ menus, no modals, no sub-views, tables with no
 * columns), because "I did not look" and "there was nothing there" produce the
 * same empty array. Those are reported as warnings-with-teeth: the agent must
 * either fill them in or state explicitly that the surface does not exist.
 *
 * Runs on Stop, alongside qa-coverage.mjs.
 * Exit 0 = clean / nothing to check. Exit 2 = blocking. Internal error = 0.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const read = (p) => {
  try { return readFileSync(p, 'utf8'); } catch { return null; }
};

const listFiles = (dir, re) => {
  try {
    if (!statSync(dir).isDirectory()) return [];
    return readdirSync(dir).filter((f) => re.test(f)).map((f) => join(dir, f));
  } catch { return []; }
};

/**
 * Normalise a label for matching: case/punctuation/whitespace insensitive.
 *
 * Punctuation collapses to single spaces, which already handles the decorative
 * cases - `Row menu (⋮)` and `disabled/invalid` normalise the same either way.
 *
 * It deliberately does NOT drop parenthetical CONTENT. An earlier version did
 * (to tidy `(⋮)`), which silently erased plan text written in parentheses -
 * `Scenario 1 (populated state)` became `scenario 1`, so a state named there
 * looked untested. Dropping text before matching makes the gate lie about what
 * the plan says, which is worse than a slightly noisier needle.
 */
const key = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* ------------------------------------------------------------------ *
 * Walk the baseline into a flat inventory of controls
 * ------------------------------------------------------------------ */

/**
 * Every testable surface in the baseline, as { kind, name, where }.
 *
 * Deliberately generic: it walks whatever the JSON contains rather than looking
 * for a fixed key list, because SKILL.md tells the agent to add module-specific
 * keys and a generic `other[]`. A control recorded under an unexpected key still
 * gets counted.
 */
function inventory(node, where = 'main', out = [], depth = 0) {
  if (depth > 12 || node == null) return out;

  if (Array.isArray(node)) {
    for (const item of node) inventory(item, where, out, depth + 1);
    return out;
  }
  if (typeof node !== 'object') return out;

  // A view / sub-view re-roots `where`
  const localWhere = node.name && (node.route || node.openedBy) ? `view:${node.name}` : where;

  // Named, testable things.
  // A bare { name } with no role/type still counts - the schema does not force a
  // type, and silently skipping such an entry is exactly the "captured but never
  // demanded" hole this gate exists to close.
  if (node.name && !(node.route || node.openedBy)) {
    out.push({ kind: node.role || node.type || 'element', name: node.name, where: localWhere });
  }
  if (node.label) {
    out.push({ kind: node.type || 'field', name: node.label, where: localWhere });
  }
  if (node.title && node.buttons) {
    out.push({ kind: 'modal', name: node.title, where: localWhere });
  }

  for (const [k, v] of Object.entries(node)) {
    // `states` is walked separately by stateInventory(): a state is not a control,
    // and one marked reached:false is a documented limitation, not a gap.
    if (k === 'changelog' || k === 'buildRef' || k === 'states') continue;

    // Table columns and row actions are testable surfaces in their own right
    if (k === 'tables' && Array.isArray(v)) {
      for (const t of v) {
        if (!t || typeof t !== 'object') continue;
        const tw = `${localWhere} > table:${t.name ?? '?'}`;
        for (const c of t.columns ?? []) out.push({ kind: 'column', name: c, where: tw });
        for (const a of t.rowActions ?? []) out.push({ kind: 'row-action', name: a, where: tw });
        if (t.hasRowMenu) out.push({ kind: 'row-menu', name: `${t.name ?? 'table'} row menu`, where: tw });
        inventory(t, tw, out, depth + 1);
      }
      continue;
    }
    if ((k === 'tabs' || k === 'headings') && Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string') {
          out.push({ kind: k === 'tabs' ? 'tab' : 'heading', name: item, where: localWhere });
        } else inventory(item, localWhere, out, depth + 1);
      }
      continue;
    }
    if (typeof v === 'object') inventory(v, localWhere, out, depth + 1);
  }
  return out;
}

/**
 * Every observed state, per view, from the baseline's `states[]`.
 *
 * This is the MODEL half of the gate, and the more valuable one: SKILL.md is
 * explicit that "gaps come from missed states/transitions, not missed buttons."
 * A plan can name every control on a page and still test only the populated
 * happy path - the control check alone would pass it.
 *
 * Only states recorded `reached: true` are required to have coverage. A state
 * marked `reached: false` with a `why` is a documented limitation, not a gap.
 */
function stateInventory(b) {
  const out = [];
  const collect = (node, where) => {
    for (const st of node?.states ?? []) {
      if (!st || typeof st !== 'object' || !st.name) continue;
      out.push({
        name: st.name,
        where,
        reached: st.reached === true,
        why: st.why ?? st.how ?? null,
      });
    }
  };
  collect(b, 'main');
  for (const v of b.views ?? []) collect(v, `view:${v?.name ?? '?'}`);
  return out;
}

/** Shallow-crawl smells: the places where "didn't look" == "nothing there". */
function shallowSmells(b) {
  const smells = [];
  const actions = b.actions ?? [];
  const views = b.views ?? [];
  const tables = [b, ...views].flatMap((v) => v?.tables ?? []);

  const expandable = actions.filter((a) =>
    /menu|kebab|⋮|dropdown|overflow|more|options/i.test(`${a.name ?? ''} ${a.role ?? ''}`),
  );
  const expanded = expandable.filter((a) => a.opens?.items?.length);
  if (expandable.length && !expanded.length) {
    smells.push(
      `${expandable.length} menu-like control(s) recorded, but none has an "opens.items" list - ` +
      `an unexpanded menu is a control you WILL miss. Open each and record its nested items.`,
    );
  }
  // An empty array is ambiguous: "I did not look" and "there is genuinely nothing"
  // serialise identically. The remedy is a POSITIVE declaration - `verifiedAbsent`
  // names each surface the crawl proved absent, with the evidence. That is
  // auditable (it sits in a committed file and a reviewer can challenge it),
  // whereas a bare [] is not. Declaring something absent that later appears is a
  // baseline-drift finding like any other.
  const declared = new Set(
    Array.isArray(b.verifiedAbsent)
      ? b.verifiedAbsent.map((x) => (typeof x === 'string' ? x : x?.surface)).filter(Boolean)
      : [],
  );
  const evidenceFor = (k) =>
    (Array.isArray(b.verifiedAbsent) ? b.verifiedAbsent : [])
      .find((x) => typeof x !== 'string' && x?.surface === k)?.how ?? null;

  if (!(b.modals ?? []).length && !declared.has('modals')) {
    smells.push(
      `"modals": [] - no modal or confirmation captured anywhere. Most modules have at least ` +
      `a create/confirm dialog. If this module genuinely has none, declare it: ` +
      `"verifiedAbsent": [{ "surface": "modals", "how": "<how you proved it>" }].`,
    );
  }
  if (!views.length && !declared.has('views')) {
    smells.push(
      `"views": [] - only the list page was captured. SKILL.md requires navigating INTO a ` +
      `representative record's detail page and every sub-view reachable in the module. ` +
      `A single-view module (e.g. a standalone auth form) declares it: ` +
      `"verifiedAbsent": [{ "surface": "views", "how": "<how you proved it>" }].`,
    );
  }
  // A declaration with no evidence is worthless - demand the `how`.
  for (const k of declared) {
    if (!evidenceFor(k)) {
      smells.push(
        `"verifiedAbsent" declares "${k}" but gives no "how" - an absence claim needs its ` +
        `evidence (what you did that proved nothing is there), or it is just a bare [] with ` +
        `extra steps.`,
      );
    }
  }
  const colless = tables.filter((t) => !(t?.columns ?? []).length);
  if (colless.length) {
    smells.push(
      `${colless.length} table(s) recorded with no columns: ` +
      `${colless.map((t) => t?.name ?? '?').join(', ')} - every table needs its columns and row actions.`,
    );
  }
  if (!(b.fields ?? []).length && !views.some((v) => (v?.fields ?? []).length) && !declared.has('fields')) {
    smells.push(
      `no fields captured in any view - forms/filters/search inputs are testable surfaces. ` +
      `A genuinely read-only module declares it: ` +
      `"verifiedAbsent": [{ "surface": "fields", "how": "<how you proved it>" }].`,
    );
  }

  // The MODEL step, not the CRAWL step: a control list without states means the
  // state machine was never explored. This is where the real gaps live.
  const stateless = [b, ...views].filter((v) => !(v?.states ?? []).length);
  if (stateless.length) {
    const names = stateless.map((v) => (v === b ? 'main view' : v?.name ?? '?'));
    smells.push(
      `no "states": [] recorded for ${names.join(', ')} - controls were captured but the ` +
      `state machine was not. Record which of empty/loading/populated/error/disabled/` +
      `role-gated you reached and how (SKILL.md MODEL step: "you can't see states without data").`,
    );
  }
  return smells;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main() {
  try { readFileSync(0, 'utf8'); } catch { /* no stdin */ }

  const baselines = listFiles(join(ROOT, 'baselines'), /\.baseline\.json$/);
  if (baselines.length === 0) return 0; // nothing captured yet - not this gate's business

  const planSrc = listFiles(join(ROOT, 'plan'), /\.md$/)
    .map((f) => read(f) ?? '')
    .join('\n');
  const testSrc = listFiles(join(ROOT, 'tests'), /\.spec\.ts$/)
    .map((f) => read(f) ?? '')
    .join('\n');

  // Nothing planned or authored yet - the crawl may still be in progress.
  if (!planSrc.trim() && !testSrc.trim()) return 0;

  const haystack = key(planSrc + '\n' + testSrc);
  const reports = [];

  for (const bf of baselines) {
    const raw = read(bf);
    if (raw === null) continue;
    let b;
    try {
      b = JSON.parse(raw);
    } catch (e) {
      reports.push({
        module: bf.replace(/^.*\//, ''),
        broken: `baseline is not valid JSON (${e.message}) - it cannot be verified or diffed for self-healing.`,
      });
      continue;
    }

    const module = b.module ?? bf.replace(/^.*\//, '').replace(/\.baseline\.json$/, '');
    const items = inventory(b);

    // Dedupe by kind+name+where, and ignore trivially short names.
    const seen = new Set();
    const uncovered = [];
    const unmatchable = [];
    for (const it of items) {
      const k = key(it.name);
      // A name too short to match reliably (an icon-only "⋮", "OK", "X") cannot be
      // audited by text. Do NOT silently skip it - that is a control the gate
      // pretends does not exist. Report it so it gets a real accessible name or an
      // explicit out-of-scope note.
      if (k.length < 3) {
        unmatchable.push(it);
        continue;
      }
      const id = `${it.kind}|${k}|${it.where}`;
      if (seen.has(id)) continue;
      seen.add(id);
      // Covered if the plan or a test mentions this control's name at all.
      if (!haystack.includes(k)) uncovered.push(it);
    }

    /* --- states: the MODEL half --------------------------------------- */
    // Matched per-view rather than globally: "empty" is too common a word to
    // match against the whole plan, but "empty" near the view's own name is a
    // real signal. Falls back to a global match for the main view.
    const uncoveredStates = [];
    for (const st of stateInventory(b)) {
      if (!st.reached) continue; // documented as unreachable - not a gap
      const bare = key(st.name).replace(/^role gated\s*/, '');
      if (!bare) continue;

      // role-gated:admin -> look for the role name anywhere in plan/tests
      const isRoleGated = /^role[- ]?gated/i.test(st.name);
      const needle = isRoleGated ? bare : bare;

      const viewName = st.where.startsWith('view:') ? key(st.where.slice(5)) : '';
      const mentionsState = haystack.includes(needle);
      // For a sub-view state, also require the view itself to be planned, so a
      // state named on the list page does not silently cover the detail page.
      const ok = viewName
        ? mentionsState && haystack.includes(viewName)
        : mentionsState;
      if (!ok) uncoveredStates.push(st);
    }

    const smells = shallowSmells(b);
    if (uncovered.length || smells.length || uncoveredStates.length || unmatchable.length) {
      reports.push({ module, uncovered, uncoveredStates, unmatchable, smells, total: seen.size });
    }
  }

  if (reports.length === 0) return 0;

  const out = [`BLOCKED by qa-crawl - the CRAWL is not provably complete`, ``];

  for (const r of reports) {
    if (r.broken) {
      out.push(`  ${r.module}: ${r.broken}`);
      out.push('');
      continue;
    }

    out.push(`  ${r.module} - ${r.total} control(s) in the baseline`);
    out.push('');

    if (r.uncovered.length) {
      out.push(`    NOT COVERED - in the baseline, named in no plan row and no test (${r.uncovered.length}):`);
      // group by location so the gap reads as a place, not a list
      const byWhere = new Map();
      for (const u of r.uncovered) {
        const list = byWhere.get(u.where) ?? [];
        list.push(u);
        byWhere.set(u.where, list);
      }
      for (const [where, list] of [...byWhere].slice(0, 8)) {
        out.push(`      ${where}`);
        for (const u of list.slice(0, 10)) out.push(`        [${u.kind}] ${u.name}`);
        if (list.length > 10) out.push(`        ... and ${list.length - 10} more here`);
      }
      if (byWhere.size > 8) out.push(`      ... and ${byWhere.size - 8} more location(s)`);
      out.push('');
      out.push(`    -> Every control on the page needs a plan row, or an explicit`);
      out.push(`       out-of-scope note saying why it is not tested. Do not delete it`);
      out.push(`       from the baseline to silence this - the baseline is the record of`);
      out.push(`       what EXISTS, not of what you chose to test.`);
      out.push('');
    }

    if (r.uncoveredStates?.length) {
      out.push(`    STATE NOT TESTED - observed live, no plan row or test (${r.uncoveredStates.length}):`);
      for (const s of r.uncoveredStates.slice(0, 12)) {
        out.push(`      ${s.where}  [${s.name}]${s.why ? `  (reached: ${s.why})` : ''}`);
      }
      if (r.uncoveredStates.length > 12) {
        out.push(`      ... and ${r.uncoveredStates.length - 12} more`);
      }
      out.push('');
      out.push(`    -> THIS is where gaps come from - not missed buttons. Each state you`);
      out.push(`       actually reached needs its own test (empty state, error state, the`);
      out.push(`       role-gated view). If a state turned out to be unreachable, set`);
      out.push(`       "reached": false with a "why" - do not delete it.`);
      out.push('');
    }

    if (r.unmatchable?.length) {
      out.push(`    UNMATCHABLE NAME - too short to audit by text (${r.unmatchable.length}):`);
      for (const u of r.unmatchable.slice(0, 10)) {
        out.push(`      ${u.where}  [${u.kind}] ${JSON.stringify(u.name)}`);
      }
      if (r.unmatchable.length > 10) out.push(`      ... and ${r.unmatchable.length - 10} more`);
      out.push('');
      out.push(`    -> The gate cannot tell whether these are covered, so it will not`);
      out.push(`       claim they are. Give each a real accessible name in the baseline`);
      out.push(`       (what a screen reader would announce - "Row menu", "Close dialog"),`);
      out.push(`       which is also what getByRole(role, { name }) needs to target it.`);
      out.push('');
    }

    if (r.smells.length) {
      out.push(`    SHALLOW CRAWL - "did not look" and "nothing there" look identical (${r.smells.length}):`);
      for (const s of r.smells) out.push(`      - ${s}`);
      out.push('');
      out.push(`    -> Re-crawl those surfaces and record what you find. If a surface`);
      out.push(`       genuinely does not exist in this module, note that in the baseline`);
      out.push(`       (e.g. "modals": [] with a comment in changelog) so absence is a`);
      out.push(`       finding rather than a blank.`);
      out.push('');
    }
  }

  out.push(`SKILL.md CRAWL: "done only when the worklist is empty" · "a surface you did`);
  out.push(`not expand is a control you WILL miss." This gate compares the baseline`);
  out.push(`inventory against the plan - it is the mechanical form of that rule.`);

  process.stderr.write(out.join('\n') + '\n');
  return 2;
}

let code = 0;
try {
  code = main();
} catch (err) {
  process.stderr.write(`qa-crawl internal error (ignored): ${err?.message}\n`);
  code = 0;
}
process.exit(code);
