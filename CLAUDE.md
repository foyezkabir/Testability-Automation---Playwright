# CLAUDE.md

Playwright end-to-end automation project built around the **`qa-scripter`** agent.

## CORE RESTRICTIONS (read first - zero tolerance)

**In test spec files (`tests/*.spec.ts`) these are PROHIBITED:**
- NO `if / else` (branching)
- NO `for` / `while` loops
- NO `try / catch` (silent error catching)
- NO data-building / string logic
→ Specs must be **linear and deterministic**. Put any of the above in `helpers/` (Loop/Conditional/Error/Data).

**Locators come ONLY from live site navigation - STRICT, no compromise.** Every selector is captured by navigating the real site. Jira / Figma / Gherkin / AC are **NEVER a source of locators** - use them only to verify the live UI against intent and flag drift. Never derive, guess, or "hint" a selector from them. No live build yet → you do NOT write locators; wait until it exists, then capture them.

**Locator priority (STRICT order):**
`getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId` (no accessible name) → **chain any mix** → `XPath` → `CSS` (last resort, + comment).
Never drop to XPath/CSS while a chained semantic locator is still possible.
**Disambiguate by CONTEXT, not position:** `.filter({ hasText })` · `.filter({ has: <child> })` · scoping/chaining. `.nth()`/`.first()`/`.last()` are a **last resort** (order-dependent → flaky on re-sort/pagination) + comment why.
**Iframes:** step into the frame, then chain a semantic locator inside it. Prefer `<semantic>.contentFrame()` (e.g. `getByTitle('Payment form').contentFrame().getByRole(...)`); fall back to `frameLocator('<css>')` only when nothing semantic identifies the frame (+ comment). Never index a frame unless order-stable.

**WAITING - no sleeps, no loops (zero tolerance).** Wait declaratively; pick by *what* you're waiting on:
- **On the page (DOM/locator)** → web-first assertion, it auto-polls: `expect(locator).toBeVisible()` / `.toHaveText()` / `.toHaveCount()`. Do **NOT** wrap these in `expect.poll`.
- **`expect.poll(fn).toBe(x)` - USE when** waiting on an **off-page value that settles later**: an API/DB status, a `page.evaluate()` value, storage/cookie/URL. `fn` only *reads* (runs many times - no side effects).
- **`expect(async () => { …asserts… }).toPass({ timeout })` - USE when** several things must *eventually all* hold together.
- **`LoopHelper` - USE when** repeating an **action** N times. It is NOT a waiter.
- **NEVER** `waitForTimeout` (a fixed sleep). **NEVER** a `while` in a spec.

**Also:** no direct login (use `storageState` from `.auth/<role>.json`) · test names = `TC-XX: Verify that ...`.

## Explore before you script - NO GAPS (mandatory sequence)

Run **before any locator or test**. Gaps come from missed **states/transitions**, not missed buttons - and you can't see states without data.
1. **MAP** - enumerate every route/view/entry point (nav + AC + Figma) before going deep.
2. **CRAWL** - worklist of surfaces; expand every ⋮/menu/dropdown/tab/accordion/modal; new surfaces re-queue; done only at empty worklist.
3. **MODEL** - per view: states (empty/loading/populated/error/disabled/role-gated/terminal), transitions + preconditions, data in/out, validation. **Seed data via API to force non-happy states.**
4. **TRIANGULATE** - AC ↔ Figma ↔ live: in AC/Figma not live = missing/bug; in live not AC = unspec'd; Figma≠live = drift.
5. **PLAN (persisted)** - write `plan/<module>.md` (view × state × action → `TC-XX` + tag); on disk, not just in context (survives compaction; feeds traceability).
6. **CRITIC (gate)** - FAIL & loop if any AC / observed state / transition / error / validation / role-gated element has 0 tests. Proceed only at zero-missing.
7. **GENERATE** the 4 tiers from the plan.

## What this project is
QA automation for our web app: turn a **Jira ticket** (business + acceptance criteria), Figma, Gherkin, pasted requirements, or the live UI into maintainable Playwright tests using a **Strict Decoupled Page Object Model**. All test-authoring work goes through the agent.

## Inputs the agent accepts (combine any)
Jira (`getJiraIssue` - AC drives the TC list) · Figma (`get_design_context` - intended UI, **never a locator source**) · Gherkin (scenario → TC) · pasted text/tables/screenshots · live UI (Chrome DevTools MCP - **the only source of locators**).

## How to work here
- **Invoke:** `/qa-scripter <task>` (e.g. "automate the <module> module at staging"). **Every invocation - bare or with a task - runs Phase 0 (bootstrap) then Phase 1 (smoke to green) FIRST; both need zero input.** Only after they pass green does it STOP and ask for what's missing: a task answers "what to automate" (so it asks only for the remaining gaps - URL/creds/sources); a bare call asks for the task too. It never picks a module or guesses URL/creds itself.
- The full spec lives in `.claude/skills/qa-scripter/SKILL.md` - **read it before writing any test code.** This file is only orientation.
- Do NOT hand-write specs that bypass the agent's rules below.

## Architecture - 4 code tiers + companions
| Tier / artifact | Path | Holds |
|---|---|---|
| Locators | `locators/*Locators.ts` | selectors only, no logic |
| Pages | `pages/*Page.ts` | interactions only, no assertions |
| Data | `datas/<module>/<Module>Data.ts` | static values + faker factories, one sub-folder per module (shared → `datas/common/`) |
| Spec | `tests/*.spec.ts` | deterministic test logic |
| Fixtures (support) | `fixtures/*.ts` | DI - page objects + seeded state + teardown; specs import `base.ts` only |
| Auth sessions | `.auth/<role>.json` | per-role `storageState` (generated by global-setup, **gitignored**) |
| Baseline (companion) | `baselines/*.baseline.json` | git-versioned UI snapshot for self-healing |
| Helpers (support) | `helpers/*.ts` | control flow (Loop/Conditional/Error/Data) + generic stateless helpers (date/tz, env, file parse, matchers) - no separate `utils/` |
| Setup (companion) | `setup/*Setup.ts` | API state seeding + teardown [lazy - only if a module needs it] |
| Findings (companion) | `findings/*.txt` | local defect notes - NEVER auto-filed to Jira [committed] |
| Traceability (companion) | `traceability/*.txt` | generated TC↔AC coverage map, GAP-flagged [committed; only with a Jira ticket] |
| Plan (companion) | `plan/*.md` | persisted test plan (view × state × action → TC), pre-code gate [committed] |
| Evidence (companion) | `failures/<module>/` | auto-captured proof per failed test: `<TC-XX>_<date>_<time>.png` + `log.txt` with error + toast lines [entirely gitignored] |

## Tier rules (beyond the core restrictions above)
- **Pages:** action-named methods that act and return values; assertions belong in specs (use state getters). Drag-drop (wrap in a page method): element→element `dragTo()`; external file/clipboard drop `locator.drop({ files } | { data })` (PW ≥1.60); standard file input `setInputFiles()`.
- **Data:** never inline `faker` in a spec - factories in `datas/`. Static for assertions/edge/reference values. **One sub-folder per module** (`datas/<module>/<Module>Data.ts` + fixtures); shared/cross-module data → `datas/common/`.
- **Assertions:** attach a short intent message to every non-obvious assertion - 2nd arg to `expect`, shown in the report on pass/fail (hard or soft): `expect(locator, 'why this matters').toBeVisible()`. Hard `expect` for critical paths; `expect.soft(...)` for validations (optionally `expect.configure({ soft: true })`).
- **Baseline:** capture from a11y snapshot (not pixels), text-only (no committed screenshots), **exhaustive + recursive** (every view, table, nested ⋮ menu), self-verified to zero-missing. Update only on human-confirmed intended change; log it in `changelog[]`.
- **Setup (lazy):** set up state via API · test via UI · tear down via API. Endpoints from network capture (docs optional, never invent). Seeding/teardown ONLY - never assert on an API response in a spec. Teardown ladder: `DELETE` → soft-delete → UI delete → unique naming → backend reset → log the leak.
- **Fixtures:** deliver a test its ready-made world, then clean up - the spec exercises only the behavior under test. Specs import `fixtures/base.ts` ONLY (never `new PageObject()`). Spec top = imports only (no `beforeEach`/setup blocks); request fixtures per-test in the callback args (`{ <module>Page, seeded<Entity> | cleanup }`) - never defined in the spec. Per-test scope (isolation; any-order/parallel-safe); worker scope only for expensive read-only state. Setup before `use()`, teardown after (runs even on failure); lazy (only requested fixtures run); no assertions in a fixture. Auth = global `storageState`; page objects = per-test DI (preconditions vs subject → the two patterns below). Split `base.ts` → `pages.ts` + `setup.ts` via `mergeTests` as it grows.
  - **Two patterns - STRICT, always follow (this is the standard):**
    - **Decide by the entity's ROLE in the test (precondition vs subject), not by action name** (actions below are examples, NOT a closed list): does THIS test verify the entity's *creation* → **B**; or must the entity *already exist* for the test to run → **A**?
    - **A · entity is a precondition** - any action on already-existing data (edit, delete, settings, view, search, export, approve… - illustrative, not exhaustive) → API-seed it (`seeded<Entity>`), UI runs only the behavior under test.
    - **B · entity IS the subject** - the test verifies creating it (Create / register flow) → create via **UI**, register the returned id with `cleanup(id)` for API teardown.
    - **Never build a precondition through the UI. Never create the subject-under-test via API.**
- **Roles & environment (`test.use()`):** session files live in gitignored `.auth/`, **named by role** (`.auth/<role>.json`) - decided at ONBOARDING, not scaffold (bootstrap = one neutral `.auth/user.json` as config default; when roles are discovered from Jira/live UI/permissions, create `.auth/<real-role>.json` each, config default = dominant role, `test.use()` for the rest). `global-setup.ts` *produces* the files (always required; creds in `.env`); `test.use()`/config only *selects* one, at file/describe scope (never inside a `test()`). Any non-default role file MUST declare `test.use()` explicitly. Also overrides `viewport` / `timezoneId`+`locale` / `colorScheme` / `testIdAttribute`. Different users→different tests = `test.use()`; two users in ONE test = two browser contexts. Single role → one file, no `test.use()`; even split → no config default, every file declares its role.
- **Findings (local only):** record real product defects to `findings/<module>.txt` as found - fields: Title (`Where: what .. when`), Type, Module, Description, Steps to reproduce, Actual result, Expected result, Confidence. **NEVER post to Jira / never list issues** (false bugs erode trust) - a human reviews & files. Exclude baseline drift (→ self-heal) and own locator/test bugs (→ fix).
- **Failure evidence:** `fixtures/evidence.ts` auto fixture (`auto: true`, merged via `mergeTests`; scaffolded verbatim from `.claude/templates/evidence.ts`) fires ONLY on a failed test - full-page PNG to `failures/<module>/<TC-XX>_<YYYY-MM-DD>_<HH-MM-SS>.png` (flat per module, TC + timestamp in the filename), toast MutationObserver log (catches toasts that vanish too fast for a screenshot), and a line in `failures/<module>/log.txt` (all of `failures/` is gitignored - local evidence only). Config keeps `video`/`trace: 'retain-on-failure'`. Capture never throws or masks the real failure; green runs leave nothing.
- **Tagging & traceability:** tag each test via `{ tag: [...] }` (keeps the title clean) - `@smoke` (proves-it-works; keep tiny, ~1-3/module) · `@critical` (must-never-break: auth/payment/data/permissions) · `@regression` (default - untagged full run = regression). Decide by scenario role at authoring, first match wins. Run subsets: `--grep @smoke`. TC↔AC map is a **generated** companion `traceability/<module>.txt` (ticket AC × authored TCs, GAP-flagged), regenerated on every change - never hand-kept; skip if no ticket/AC.
- **Test steps (`test.step()`):** wrap phases in named steps ONLY for multi-phase / cross-page / Gherkin-mapped tests (usually @smoke/@critical); skip for short single-assert tests (POM method names already document them). Label only, not control flow. Heuristic: >1 screen or >~3 phases → step it.

## Enforcement - the rules above are hooks, not honour system
The "zero tolerance" rules are enforced mechanically, not on trust. Hooks in `.claude/hooks/` (wired in `.claude/settings.json`) **block the write** on a violation and hand back the rule id, line and fix - so you learn each rule at the moment it applies, and they bind any agent or session touching this repo. Full rule table: **`.claude/hooks/RULES.md`** (read it only if you need the whole set at once).

Three gates:
- **On write** - every lint rule: spec control flow, waiting, locator strategy, tier separation, assertion intent, `test.step()`, slow-suite patterns. ESLint (AST) is authoritative; a regex guard covers the loudest rules before `npm install` exists. Run it yourself with `npx eslint .`.
- **Before write** - a value in `.env.example` is refused (that file is COMMITTED - keys only). **`.env` itself is writable**: it is gitignored and is the correct home for a URL or credential the user hands over, so put it straight in. `.auth/**` stays refused - those are session files `global-setup.ts` produces at run time.
- **On finish (`Stop`)** - the **COMPLETENESS CRITIC gate, mechanised**: reconciles `plan/<module>.md` ↔ `tests/*.spec.ts` ↔ `traceability/<module>.txt` and refuses to let the turn end on a planned TC with no test, a test in no plan, a `GAP` line, a duplicate TC id *within a module* (numbering restarts at TC-01 per module), a missing tier tag, or a **`Coverage:` line that disagrees with reality**. This is **requirement coverage, not istanbul/c8 line coverage** - a Playwright suite exercises the app, not itself.
- **On finish (`Stop`) - the CRAWL gate.** `baselines/<module>.baseline.json` is an exhaustive inventory of what the page actually has, so the crawl is *checkable*: every control in the baseline (action, icon, tab, heading, field, modal, table column, row action, nested ⋮ item, sub-view) must be named in a plan row or a test. Anything in the baseline and nowhere else is a **provable crawl gap** and blocks the turn. **It also gates STATES** - every state a view recorded as actually reached (`states[].reached: true`: empty · loading · populated · error · disabled · role-gated:<role> · terminal) needs its own plan row or test. This is the half that matters: *gaps come from missed states, not missed buttons*, and a plan naming every control can still test only the happy path. A state recorded `reached: false` with a `why` is a documented limitation, not a gap - never delete it to pass. It also flags a **shallow crawl** - menu-like controls with no expanded `opens.items`, `"modals": []`, `"views": []` (list page only), tables with no columns, **no `states[]` at all** - because *"I didn't look"* and *"nothing was there"* produce the same empty array. **So capture the baseline BEFORE writing the plan** (it is the crawl's output and the plan's checklist), and never trim the baseline to make this pass: it records what EXISTS, not what you chose to test. A surface that genuinely does not exist → say so in `changelog[]` so absence is a finding, not a blank.

**How to respond to a block:** fix the code. Do **not** edit a hook, edit `eslint.config.mjs`/`qa-rules.mjs`, delete a plan row, or rewrite a `Coverage:` line to make a gate pass. If a rule is genuinely wrong for the case, say so and ask the user.

Selector rules (XPath/CSS/`.nth()`/`frameLocator`) pass if a **real justifying comment** sits on the line or directly above - at least a few words of actual reason; a bare `// TODO` or `// BAD:` does not count. Gates fail open: an internal error never blocks you.

**What no hook can check** - and where the responsibility stays yours: whether an assertion is *meaningful*; whether the **plan itself was thorough** (the gate proves the artifacts agree, not that exploration was complete - a suite can be self-consistent and still under-explored, which is why the CRAWL/MODEL discipline matters).

## Subagents
- **`crawl-surface`** (`.claude/agents/crawl-surface.md`) - crawls ONE UI surface (view/tab/modal/expanded menu) with the MCP browser and returns only a **baseline JSON fragment**. **MANDATORY for MAP/CRAWL and baseline capture: one subagent per surface, in parallel where independent - do NOT snapshot surfaces yourself to inventory them.** The a11y snapshots stay in the subagent's context, so exploration does not degrade under context pressure - the main cause of missed surfaces. You orchestrate (worklist, dispatch, merge fragments); direct browser calls are for self-heal diffing and verifying a single locator only. A fragment with `"failed": true` means NOT captured: re-dispatch or record it, never treat it as empty.

## Setup (already configured)
- **MCP servers** (`.mcp.json`): `chrome-devtools` (primary UI inspection) + `playwright` (automation). Auto-connect at session start.
- **Session status:** a `SessionStart` hook prints which gates are armed, which lint tier is live, project readiness, and empty `.env` keys - config loads at startup, so this is how you confirm a restart took effect.
- **Bootstrap:** a `Setup` hook does the **mechanical half of Phase 0** before the agent acts - deps, `eslint.config.mjs` + `qa-rules.mjs` to the root (arms the AST lint tier), `tsconfig.json`, `.env` from `.env.example`, npm scripts, companion dirs. Idempotent, and refuses to run outside this project. **Phase 0 verifies these rather than repeating them**; browser binaries, `playwright.config.ts`, `fixtures/`, `global-setup.ts` and the green smoke test remain the agent's work.
- **Permissions** (`.claude/settings.json`, committed): MCP tools + `npx playwright` / `npm install` pre-approved - no prompts.
- **Every invocation:** the agent runs Phase 0 (bootstrap deps/config) then Phase 1 (**smoke test + self-heal** to green) BEFORE asking anything or writing real tests. Both are zero-input and idempotent - they self-skip once already installed/proven, so only the first run actually installs and smokes.
- Env/secrets in `.env` (gitignored); `BASE_URL` + credentials there. Committed template: `.env.example`.

## Gotchas
- MCP servers, permissions, skills, and agent specs load at **session startup** - after config changes (including new `.claude/skills/`), restart the session.
- `chrome-devtools-mcp` is the real package (not `@anthropic-ai/...`), launched `--isolated` so a stale Chrome cannot lock its profile. `"browser is already running for ... chrome-profile"` = a live Chrome holds `SingletonLock`; **restarting the session does not clear it** - close that Chrome. On any Chrome DevTools MCP error, fall through to Playwright MCP rather than dropping to Bash scripts.
