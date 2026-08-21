# Testability Assignment - Playwright E2E Suite

End-to-end automation for **https://conduit.bondaracademy.com/** built with Playwright + TypeScript.

**30 test cases** across 2 modules. Locally they run serially in a headed Chromium so a
run is easy to watch; CI runs all three browsers headless and fully parallel (72 runs,
~1.7 min).

**Every test executes** - nothing is skipped.

- **24** assert the app's behaviour and pass.
- **6** are marked `test.fail` and tagged `@known-defect`: they assert what the app
  *should* do, run for real, and are reported as expected failures. If a defect is ever
  fixed, the test turns into a genuine failure telling you to remove the marker - which is
  why `test.fail` was chosen over `test.fixme`, since a skipped test proves nothing.
  List them with `npx playwright test --grep @known-defect`.

Latest run: **72 passed · 0 skipped · 0 failed**.

---

## Quick start

**Clone and run. No credentials to request, no setup step.**

```bash
npm ci
npx playwright install --with-deps
npm test
```

On the first run, `global-setup.ts` finds no credentials, registers a throwaway test account
against the app's API, and writes it to `.env` (gitignored). Every later run reuses that
account, so exactly one is ever created. Nothing to configure, nothing to ask for.

To use your own account instead, put it in `.env` before the first run and auto-registration
never triggers:

```ini
BASE_URL=https://conduit.bondaracademy.com
API_BASE_URL=https://conduit-api.bondaracademy.com/api
EMAIL=<conduit account email>
PASSWORD=<conduit account password>
USERNAME=<conduit username>
```

> The API is a **separate host** from the UI - it is not `BASE_URL + /api`. Hence the second key.

To start over with a fresh account, clear `EMAIL` and `PASSWORD` in `.env` and run again.

### Useful commands

| Command | What it does |
|---|---|
| `npm test` | full suite - 1 worker, headed Chromium |
| `npm run test:ci` | the CI profile locally: 3 browsers, headless, parallel |
| `npm run test:parallel` | headed Chromium, 4 workers |
| `npm run test:smoke` | the `@smoke` subset |
| `npm run test:critical` | the `@critical` subset |
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

Plus `articles TC-09` (tag-pill removal) and `settings TC-03` (settings route is auth-guarded).

Requirement-to-test mapping lives in [traceability/](traceability/), with an explicit
record of what is *not* covered and why.

---

## Architecture

A strict four-tier separation, so a UI change touches exactly one layer:

```
locators/   selectors only, no logic          pages/     interactions only, no assertions
datas/      static values + faker factories   tests/     assertions only, no control flow
```

Supported by:

| Path | Role |
|---|---|
| `fixtures/` | dependency injection - page objects, API seeding, failure evidence |
| `setup/` | API state seeding + teardown (`ArticleSetup`, `UserSetup`) |
| `helpers/` | control flow and reusable logic kept out of specs (Loop / Data / Retry) |
| `baselines/` | captured UI inventory per module, used for self-healing |
| `plan/` | the test plan written before the code |
| `findings/` | product defects found while exploring |
| `traceability/` | requirement → test mapping |

Specs import **only** `fixtures/base.ts`. They contain no `if`, no loops, no `try/catch`
and no data-building - enforced mechanically by a custom ESLint ruleset
(`eslint.config.mjs` + `qa-rules.mjs`), not by convention. Run it with `npm run lint`.

### Session management (requirement 3.2)

`global-setup.ts` authenticates **once** before the suite, stores the session in
`.auth/user.json`, and `playwright.config.ts` applies it to every test via `storageState`.
No test contains a login. It also registers an account first if `.env` has none, which is
what makes a fresh clone run with no setup. Conduit keeps its JWT in `localStorage` (verified, not assumed),
so the session is planted there and captured under `origins`.

Login is deliberately **not** a test case - it is not one of the five scenarios in the
brief. It is infrastructure.

### API pre-conditions (Pattern A vs B)

The brief requires Edit and Delete to seed their article via API. The rule applied
throughout is *decide by the entity's role in the test*:

- **The article IS what's under test** (Create) → created through the **UI**, removed via API teardown.
- **The article must merely exist** (Edit, Delete) → seeded via **API**, so the UI only exercises the behaviour being tested.

### Test data (bonus 4.1)

All inputs come from `faker` factories in `datas/`, never inlined in a spec. Article
titles carry a random suffix because Conduit derives an article's **slug from its title** -
two identical titles would collide on one record and make parallel workers fight. Values
that are *asserted on* are static, since a random expectation asserts nothing.

### Run profiles (requirements 4.5, 4.6)

`playwright.config.ts` switches on the `CI` env var:

| | Local (`npm test`) | CI |
|---|---|---|
| Workers | 1 | parallel |
| Browsers | Chromium | Chromium + WebKit + Firefox |
| Mode | headed | headless |

Local defaults favour watching and debugging a run. CI is where cross-browser and parallel
execution are demonstrated - see the Actions tab. Everything is overridable per run without
editing the config:

```bash
npx playwright test --workers=4          # parallel locally
npx playwright test --project=firefox    # a different browser
CI=1 npx playwright test                 # headless (the CI profile)
CI=1 npx playwright test                 # reproduce the CI profile
```

### Resilience (requirement 3.4)

- Locators prefer roles and accessible names; where a control is genuinely non-semantic, the fallback is scoped by **context** (`.filter({ hasText })`), never by index.
- No `waitForTimeout` anywhere. Waiting is declarative: web-first assertions, `expect.poll` for off-page state, `toPass` for "eventually all true".
- The app is a shared public demo that intermittently stalls; navigations to seeded data are wrapped in `toPass` and retries are enabled locally as well as in CI.

### Reporting & traceability (bonus 4.2, 4.7)

`trace`, `video` and `screenshot` are all `retain-on-failure`. Additionally
`fixtures/evidence.ts` writes a durable PNG + toast log + log line under `failures/<module>/`
on any failed test, so evidence survives the next run wiping `test-results/`.

### CI (bonus 4.8)

[.github/workflows/playwright.yml](.github/workflows/playwright.yml) runs lint + typecheck,
then a three-browser matrix (`fail-fast: false`), and uploads the HTML report plus - on
failure - traces, videos and screenshots as downloadable run artifacts.

**Nothing to configure to review this suite.** The workflow is already set up in this
repository and its runs are visible under the Actions tab. Reviewing the code locally needs
only the three commands in [Quick start](#quick-start) - no secrets, no CI access.

CI needs no credentials: only `BASE_URL` and `API_BASE_URL` are set as repository
variables, and `global-setup` registers its own throwaway account per run. That keeps CI
fully isolated - it never shares an account with a developer's machine.

---

## Defects found

Exploring the app surfaced **19 product defects** - 12 in articles, 7 in settings -
recorded one file per module in [findings/](findings/). Six are also encoded as `test.fail` cases
tagged `@known-defect`: they assert the correct behaviour, are reported as
expected-to-fail, and turn green the day the bug is fixed (`--grep @known-defect`).
These are notes for a human to triage, not filed anywhere. Several changed the test
design, which is worth calling out because it is the difference between tests that
describe the app and tests that describe wishful thinking:

Numbering restarts per module, matching the findings files.

**Settings** ([findings/settings.txt](findings/settings.txt))

| # | Defect | Effect on the suite |
|---|---|---|
| 1 | An invalid email is **accepted and saved**, locking the user out of login | Happened to the test account during exploration and had to be recovered via the API. The negative test attacks `username` instead - a negative test must never destroy the credentials the suite needs |
| 2 | The form **never pre-fills** despite the API returning the data | Tests type every value they assert on. `TC-06` asserts the fix |
| 3 | A blank username returns **200 and redirects as success**, but discards the change | The test asserts the stored value is unchanged, not an error message |
| 4 | A server error shows the user **nothing** and leaks Prisma internals | Recorded; no message exists to assert on |
| 5 | A field **cannot be cleared** - `''` and `null` are ignored with a 200 | Teardown restores a single space; sending `''` would silently leave test data behind |
| 6 | A whitespace-only username returns **HTTP 500**, leaking the DB constraint name | `TC-04` asserts the fix |
| 7 | The profile picture field accepts **any string**, including non-URLs | `TC-05` asserts the fix |

**Articles** ([findings/articles.txt](findings/articles.txt))

| # | Defect | Effect on the suite |
|---|---|---|
| 1 | Errors have **no `aria-live` / `role=alert`** | Accessibility defect; recorded |
| 2 | Validation is server-side and reports **one field at a time** | The empty-form test expects exactly one message, not three |
| 3 | The Publish button is **never disabled** | No test asserts a disabled submit button - the app has no such state |
| 4 | Feed tabs and tag pills are **anchors with no `href` or `role`** | Not keyboard reachable, not role-addressable - locators scope by text |
| 5 | Tag-remove is a bare `<i>` icon with no accessible name | Requires a documented CSS fallback |
| 6 | Favourite buttons are named by a bare number, colliding with pagination | Pagination locators must be scoped |
| 7 | **Tag filtering ignores user-created articles entirely** | The obvious "seed a tag, filter by it" test *cannot pass*. `TC-07` asserts the invariant that does hold; the gap is filed as a defect |
| 8 | A whitespace-only article is created with an **empty slug** (`-64987`) | `TC-10` asserts the fix |
| 9 | A title over **185 chars** returns HTTP 500, leaking the DB column name | Boundary measured by binary search: 185 passes, 186 fails. `TC-12` asserts the fix, `TC-13` guards the accepted side |
| 10 | Whitespace-only description and body are accepted as content | `TC-11` asserts the fix |
| 11 | Script markup in a title is stored raw and mangled into the slug | **Verified NOT exploitable** - `TC-18` renders it with a dialog listener attached and no dialog fires |
| 12 | The **API** stores a blank tag and caps nothing; the editor UI validates both correctly | `TC-19` / `TC-20` assert the UI behaviour and pass. Original finding was API-only and has been corrected |

Articles 4-6 are testability rather than user-facing issues, but they are the reason a few
locators use a scoped CSS fallback - each carries a comment explaining why.

**Two patterns worth raising as tickets of their own:** six defects share one root cause -
input is not trimmed before validation, and the failure is then either swallowed with a 200
or surfaced as a raw 500. Separately, three defects leak Prisma/ORM internals, table and
constraint names into response bodies, which is information disclosure independent of the
validation bugs.

---

## Notes on how this was built

AI assistance was used for authoring, but **no locator or assertion was accepted without
being verified against the live site**. That mattered: several claims from automated
exploration turned out to be wrong and were corrected before reaching the code - most
notably a claim that `/editor` redirects when navigated to directly (it does not), and my
own initial conclusion that tag indexing was merely *lagging* (it never resolves).

Both are recorded in [findings/articles.txt](findings/articles.txt) so the corrections are
auditable rather than invisible.
