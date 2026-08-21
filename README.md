# Testability Assignment — Playwright E2E Suite

End-to-end automation for **https://conduit.bondaracademy.com/**, built with Playwright and
TypeScript.

**30 test cases** across 2 modules. Locally they run one-at-a-time in a headed Chromium so a
run is easy to watch; CI runs all three browsers headless and in parallel (72 runs, ~2 min).

- **24** assert the app's behaviour and pass.
- **6** are marked `test.fail` and tagged `@known-defect`: they assert what the app *should*
  do, execute for real, and are reported as expected failures. If a defect is ever fixed the
  test turns into a genuine failure telling you to remove the marker — which is why
  `test.fail` was chosen over `test.fixme`, since a skipped test proves nothing.

Latest run: **72 passed · 0 skipped · 0 failed.**

---

## Quick start

**Clone and run. No credentials to request, no setup step.**

```bash
npm ci                               # 1. install dependencies
npx playwright install               # 2. download browser binaries (once per machine)
npm test                             # 3. run the suite
```

That is the whole process. On the first run you will see:

```
global-setup: no credentials found, registered a test account (qa…@mailinator.com) and saved it to .env
```

### What happens on that first run

```
npm test
   │
   ├─ 1. global-setup.ts starts (before any test)
   │      │
   │      ├─ .env has EMAIL + PASSWORD?
   │      │     ├─ YES → log in with them, never register
   │      │     └─ NO  → POST /api/users to register a throwaway account,
   │      │              then write all five keys into .env
   │      │
   │      ├─ log in via POST /api/users/login → receive a JWT
   │      ├─ plant the JWT in localStorage, load the app once
   │      └─ save the session to .auth/user.json
   │
   ├─ 2. playwright.config.ts applies that session to every test
   │      via `storageState`, so no test performs a login
   │
   └─ 3. the 30 tests run — each seeds its own data via the API,
         exercises the UI, and tears its data down afterwards
```

Both `.env` and `.auth/` are gitignored. `.env` persists, so run 2 onward reuses the same
account and never registers again. To start over with a fresh account, clear `EMAIL` and
`PASSWORD` in `.env` and run again.

To use your own Conduit account instead, put it in `.env` before the first run and
auto-registration never triggers:

```ini
BASE_URL=https://conduit.bondaracademy.com
API_BASE_URL=https://conduit-api.bondaracademy.com/api
EMAIL=<your conduit email>
PASSWORD=<your conduit password>
USERNAME=<your conduit username>
```

> The API is a **separate host** from the UI — it is not `BASE_URL + /api`. Hence the second
> key. Both fall back to the values above if unset, so a missing `.env` still works.

### Commands

| Command | What it does |
|---|---|
| `npm test` | full suite — 1 worker, headed Chromium (watchable) |
| `npm run test:ci` | the CI profile locally: 3 browsers, headless, parallel |
| `npm run test:parallel` | headed Chromium, 4 workers |
| `npm run test:smoke` | the `@smoke` subset — the vital signs |
| `npm run test:critical` | the `@critical` subset |
| `npx playwright test --grep @known-defect` | just the 6 documented defects |
| `npm run report` | open the HTML report |
| `npm run lint` / `npm run typecheck` | static gates |

---

## Test coverage

The brief asks for one positive test per scenario, plus (bonus) at least one negative each.

| # | Scenario | Positive | Negative |
|---|---|---|---|
| 1 | Create New Article | `articles TC-01` | `TC-02` empty form rejected (422) |
| 2 | Edit Article *(API pre-condition)* | `articles TC-03` | `TC-04` blank title must not overwrite |
| 3 | Delete Article *(API pre-condition)* | `articles TC-05` | `TC-06` non-author has no delete control |
| 4 | Filter Articles by Tag | `articles TC-07` | `TC-08` unknown tag returns nothing |
| 5 | Update User Settings | `settings TC-01` | `settings TC-02` blank username must not overwrite |

Plus `articles TC-09` (tag-pill removal), `settings TC-03` (route is auth-guarded), and 12
boundary cases (`TC-10`–`TC-21`) covering whitespace-only input, length limits, unicode, SQL
and script payloads, and tag validation.

---

## Project layout

### The four code tiers

A UI change touches exactly one layer:

| Path | Holds | Never holds |
|---|---|---|
| `locators/` | selectors only | logic, actions, assertions |
| `pages/` | actions + named `expect*` methods | selectors, test data |
| `datas/` | static values + faker factories | selectors, logic |
| `tests/` | one-line intent calls | `if`, loops, `try/catch`, raw selectors |

A spec reads as a list of intents, with no `expect(...)` and no message strings — the method
name *is* the intent:

```ts
test('TC-01: Verify that a new article is created and published', { tag: ['@smoke', '@critical'] }, async ({ articlePage, articleAsserts, cleanupArticle }) => {
  const article = newArticle();
  cleanupArticle(article.title);

  await articlePage.navigateToHome();
  await articlePage.clickNewArticleNavLink();
  await articlePage.expectEditorIsOpen();

  await articlePage.createArticle(article);

  await articlePage.expectRedirectedToArticle();
  await articlePage.expectArticleTitle(article.title);
  await articlePage.expectArticleBodyContains(article.body);
  await articlePage.expectArticleTagShown(article.tagList[0]);
  await articlePage.expectOwnerControlsVisible();

  await articlePage.reloadPage();
  await articlePage.expectArticleTitle(article.title);

  await articleAsserts.expectArticleExists(articlePage.currentSlug());
});
```

Those restrictions are enforced mechanically by a custom ESLint ruleset
(`eslint.config.mjs` + `qa-rules.mjs`), not by convention. Run `npm run lint`.

### Supporting code

| Path | Role |
|---|---|
| `fixtures/` | dependency injection — page objects, API seeding, automatic failure evidence. Specs import `base.ts` only. |
| `setup/` | API state seeding and teardown. Never asserts. |
| `asserts/` | backend assertions — the data-persistence half of each test. Keeps `setup/` to pure seed/teardown. |
| `helpers/` | the little logic specs are not allowed to contain (loops, string handling) |
| `global-setup.ts` | registers an account if needed, logs in once, saves the session |

---

## The companion folders — why they exist

These four are not test code. They are the **paper trail** behind it: what was explored,
what was planned, what maps to which requirement, and what turned out to be broken. A suite
without them is a set of assertions you have to take on trust.

### [`baselines/`](baselines/) — what the UI actually contains

An exhaustive, git-versioned inventory of each module's surface, captured from the live site
by walking the accessibility tree: every control, field, tab, modal, sub-view, and — most
importantly — every **state** that was actually reached (`empty`, `loading`, `populated`,
`error`, `role-gated`, `terminal`), with a note on *how* it was reached.

```json
{
  "name": "error",
  "reached": true,
  "how": "Set username to an already-taken value; PUT /api/user returned 500 with a raw
          Prisma body. The app stayed on /settings but ul.error-messages rendered EMPTY."
}
```

**Why it is here, and not just in someone's head:**

1. **It makes the exploration checkable.** The plan is written *against* the baseline, so a
   control that exists but appears in no test is a provable gap rather than an oversight.
2. **A state nobody could reach is recorded as `reached: false` with a reason** — a
   documented limitation, not a silent blank.
3. **It enables self-healing.** When a locator breaks later, you diff the live page against
   the baseline and see immediately whether a control was *renamed*, *moved*, or *removed* —
   the difference between "fix the selector" and "this is a product bug".

Text only (no screenshots): JSON diffs cleanly in git, images do not.

### [`plan/`](plan/) — what will be tested, written before the code

One row per **view × state × action → TC + tag**, plus a full accounting of every baseline
control: which test covers it, or why it is deliberately out of scope.

```
| TC-05 | /article/:slug · terminal · delete a seeded article | @critical | seededArticle (A) |
  no confirmation dialog appears; redirects to /; article gone from feed; API returns 404 |
```

**Why it is here:** writing the plan first is what stops the suite from being "whatever was
easy to automate". Every out-of-scope decision is recorded with a reason — for example, the
Settings *password* field is never touched, because changing it would invalidate the
credentials `global-setup` logs in with and break every later run. Without the plan that
looks like an omission; with it, it is a decision.

### [`traceability/`](traceability/) — requirement → test mapping

Maps each requirement from the brief to the test that covers it, and states plainly what is
**not** covered.

```
REQ-2.2  Edit Article (article via API)        -> TC-03    @critical
REQ-4.3b Edit Article - negative               -> TC-04    @regression

Coverage: 4/4 required scenarios (100%) · 4/4 negative cases (100%) · 0 gaps
```

**Why it is here:** it answers "is requirement X tested?" in one line instead of a code
read, and it records the API pre-condition requirement explicitly — Edit and Delete seed
their article via `POST /api/articles`, while Create deliberately goes through the UI
because there the article's creation *is* the subject under test.

### [`findings/`](findings/) — product defects found while exploring

**19 defects**, one file per module, each with the request, status code and response body it
was observed with — so every one is reproducible without re-running the exploration.

Nothing here is auto-filed to any tracker. These are notes for a human to triage, because a
false bug costs developer time and erodes trust.

Several changed the test design, which is the point of recording them:

- An **invalid email is accepted and saved**, locking the account out of login. It happened
  to the test account during exploration and had to be recovered via the API. So the
  Settings negative test attacks `username` instead — a negative test must never destroy the
  credentials the suite depends on.
- **Tag filtering ignores user-created articles entirely.** The obvious "seed a tag, filter
  by it" test *cannot pass*. TC-07 asserts the invariant that does hold; the gap is filed as
  a defect rather than hidden behind a weakened assertion.
- The **Settings form never pre-fills**, so tests type every value they assert on.

The files also record **four cases where automated exploration was wrong** and was corrected
before reaching the code — including a claim that `/editor` redirects when navigated to
directly (it does not) and an initial conclusion that tag indexing was merely *lagging* (it
never resolves). Those corrections are kept visible rather than quietly edited away.

---

## How the requirements are met

### QA-driven assertions (3.1)

Every scenario asserts all four dimensions the brief names: **visual elements**
(`toBeVisible`, `toHaveCount`), **redirects** (`expectRedirectedToArticle`), **data
persistence** (the `asserts/` layer re-reads the API after every mutation), and **success
messages** — except this app renders none, so the tests assert the signal it *does* give (the
redirect) and the absence is recorded as a finding.

### Session management (3.2)

`global-setup.ts` authenticates **once** before the suite and saves the session to
`.auth/user.json`; `playwright.config.ts` applies it to every test via `storageState`. **No
test contains a login** — verified by grep.

Conduit keeps its JWT in `localStorage`, not a cookie (verified against the live app), so the
token is planted with `addInitScript` plus a real page load — `storageState` only serialises
localStorage once the origin has been visited.

Login is deliberately **not** a test case: it is not one of the five scenarios, and routing
every run through that form would make all 30 tests fail whenever it broke.

### API pre-conditions (Pattern A vs B)

The brief requires Edit and Delete to seed their article via API. The rule applied throughout
is *decide by the entity's role in the test*:

- **The article IS what's under test** (Create) → created through the **UI**, removed via API teardown.
- **The article must merely exist** (Edit, Delete) → seeded via **API**, so the UI exercises only the behaviour being tested.

### Dynamic test data (4.1)

All inputs come from faker factories in `datas/`, never inlined in a spec. Article titles
carry a random suffix because Conduit derives an article's **slug from its title** — two
identical titles collide on one record and would make parallel workers fight. Values that are
*asserted on* are static, since a random expectation asserts nothing.

### Run profiles (4.5, 4.6)

`playwright.config.ts` switches on the `CI` env var:

| | Local (`npm test`) | CI |
|---|---|---|
| Workers | 1 | parallel |
| Browsers | Chromium | Chromium + WebKit + Firefox |
| Mode | headed | headless |

Local defaults favour watching a run; CI is where cross-browser and parallel execution are
demonstrated. Overridable per run without editing the config:

```bash
npx playwright test --workers=4          # parallel locally
npx playwright test --project=firefox    # a different browser
CI=1 npx playwright test                 # reproduce the CI profile
```

**One documented limitation:** `tests/settings.spec.ts` runs on **chromium only**. Conduit
gives an account one mutable profile, so three browsers writing to it concurrently measures
contention over a shared fixture rather than browser compatibility — it produced a
reproducible flake. Every other spec is data-isolated and runs on all three. Full coverage
there needs a second test account.

### Resilience (3.4)

- Locators prefer roles and accessible names. Where a control is genuinely non-semantic — the feed tabs and tag pills are `<a>` elements with no `href` and no `role` — the fallback is scoped by **context** (`.filter({ hasText })`), never by index.
- **No `waitForTimeout` anywhere** (verified by grep). Waiting is declarative: web-first assertions, `expect.poll` for off-page state, `toPass` for "eventually all true".
- The app is a shared public demo that intermittently stalls for minutes and then recovers. Retries are enabled locally as well as in CI, and `retryStrategy: 'isolated'` runs them at the end, one at a time, so a retry cannot be polluted by a neighbour still running.

### Reporting & traceability (4.2, 4.7)

`trace`, `video` and `screenshot` are all `retain-on-failure`. Additionally
`fixtures/evidence.ts` writes a durable PNG, a toast log and a log line under
`failures/<module>/` on any failed test, so evidence survives the next run wiping
`test-results/`. In CI everything is uploaded as run artifacts.

### CI/CD (4.8)

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) — three numbered jobs,
17 named steps, following the lifecycle end to end:

```
1 · Setup & static checks
      Set Up · check out · initialise Node 22
      Install Dependencies · npm ci
      Configure Environment · typecheck · lint
              │
   ┌──────────┴──────────────────────────────────┐
   │ 2 · E2E (chromium) │ (firefox) │ (webkit)   │
   │      Set Up · check out · Node 22           │
   │      Install Dependencies · npm ci          │
   │      Install Dependencies · browsers        │
   │      Configure Environment · resolve URLs   │
   │      Test Running · execute the suite       │
   │      Test Complete · collect results        │
   │      Report Generate · summary table        │
   │      Publish Results · HTML report          │
   │      Publish Results · failure evidence     │
   └──────────┬──────────────────────────────────┘
              │
3 · Report review & share
```

Each browser job writes a result table into its own run summary. **CI needs no credentials**
— only `BASE_URL` and `API_BASE_URL` are set as repository secrets, and `global-setup`
registers its own throwaway account per run, so CI never shares an account with a
developer's machine.

---

## Notes on how this was built

AI assistance was used for authoring, but **no locator or assertion was accepted without
being verified against the live site**. That mattered repeatedly: several claims from
automated exploration turned out to be wrong and were corrected before reaching the code.
Each correction is recorded in [findings/](findings/) so it is auditable rather than
invisible.

Two examples worth naming:

- A claim that `page.goto('/editor')` redirects to `/` — re-tested twice, it does not. Building a workaround around that would have added complexity for a bug that did not exist.
- An initial conclusion that a stored `<script>` payload was a possible XSS. Rather than report it, a render check was automated (`TC-18`, `settings TC-08`): both pass, so the markup is escaped and it is **not** exploitable. The finding was downgraded to input hygiene.
