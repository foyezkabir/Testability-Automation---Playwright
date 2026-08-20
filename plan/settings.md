# Test plan - settings module

**Surface:** `/settings`
**Baseline:** `baselines/settings.baseline.json`
**Depth:** `deep` - this surface mutates the shared account, so every state was probed and the teardown path matters.
**Assignment scenario covered here:** Update User Settings.

Numbering restarts at TC-01 for this module.

## Fixture pattern

The account itself is the precondition (Pattern A) - it is seeded once at bootstrap
and authenticated via `storageState`, never created by a test. What each test needs
is **restoration**: the profile is snapshotted before the test and put back
afterwards, because all tests share one `.env` account and an unrestored change
poisons every later run.

| Scenario | Entity | Pattern | Why |
|---|---|---|---|
| Update settings | the existing user profile | A | the profile already exists; the test verifies an update *on* it |

## Test matrix

| TC | View × state × action | Tag | Fixture | Key assertions |
|---|---|---|---|---|
| TC-01 | `/settings` · populated · update bio and profile image with valid values | `@smoke @critical` | `restoredProfile` (A) | redirects away from `/settings` to `/profile/<username>`; API confirms the new bio and image persisted (data persistence); values survive a page reload |
| TC-02 | `/settings` · disabled/invalid · submit with the username cleared | `@regression` | `restoredProfile` (A) | no error is rendered (the app shows none); the username is NOT changed - the API still returns the original. Asserts the outcome, since there is no message to assert on |
| TC-03 | `/settings` · role-gated:anonymous · `/settings` is unreachable when logged out | `@critical` | none (explicit empty session) | navigating to `/settings` with no session redirects to `/`; the settings form is not rendered |

## Test matrix - input validation & boundaries

Same file (`tests/settings.spec.ts`) deliberately: **every** profile-mutating test lives in
one serial group, because Conduit gives an account a single mutable profile. Splitting them
across files reintroduces a race - separate files still run in parallel.

Rows marked **fixme** assert what the app SHOULD do and are reported as expected-to-fail
via `test.fixme`, carrying `@known-defect`. Evidence: `findings/settings.txt`.

| TC | View × state × action | Tag | Fixture | Key assertions |
|---|---|---|---|---|
| TC-04 | `/settings` · error · submit a whitespace-only username | `@regression @known-defect` **fixme** | `restoredProfile` (A) | a visible validation message appears and the user stays on `/settings`. **Currently fails: FINDING 6** - returns HTTP 500 leaking the `User_username_key` constraint, with nothing shown to the user |
| TC-05 | `/settings` · disabled/invalid · submit `not-a-url` as the profile picture | `@regression @known-defect` **fixme** | `restoredProfile` (A) | rejected with a visible error; the value is never stored as the avatar. **Currently fails: FINDING 7** |
| TC-06 | `/settings` · populated · save, then return to the form | `@regression @known-defect` **fixme** | `restoredProfile` (A) | all three fields show the stored values on return. **Currently fails: FINDING 2** - the form always renders blank, so a user can neither see nor safely edit their own data |
| TC-07 | `/settings` · populated · save a 2000-character bio | `@regression` | `restoredProfile` (A) | saves successfully and is stored without truncation. Upper boundary - no limit exists and none is needed here, unlike the article title where the missing limit crashes the server |
| TC-08 | `/profile/:username` · populated · view a profile whose bio contains script markup | `@critical` | `restoredProfile` (A) | no native dialog fires when the profile page renders the bio. This is the render check that RESOLVED the bio XSS question as **not exploitable** |
| TC-09 | `/settings` · populated · save a whitespace-only bio | `@regression` | `restoredProfile` (A) | accepted and stored. Documents the real contract: whitespace is the ONLY way to blank a bio, because `''` and `null` are silently ignored (FINDING 5). This is also why the restore fixture writes a single space |

### Fields deliberately never given invalid values

Recorded here so the omission is a decision, not a gap:

- **EMAIL** - a malformed address is persisted with no validation and locks the shared
  account out of login (FINDING 1). It happened once during exploration and had to be
  recovered through the API. A negative test must never destroy the credentials the whole
  suite authenticates with.
- **NEW PASSWORD** - changing it would invalidate the credentials `global-setup.ts` uses and
  break every subsequent run.

### Cross-browser scope

`tests/settings.spec.ts` runs on **chromium only** (`testIgnore` on webkit and firefox).
Three browsers writing to one shared profile concurrently measures contention over a shared
fixture, not browser compatibility - it produced a reproducible flake. Every other spec is
data-isolated and does run on all three. Full cross-browser coverage here needs a second
test account.

## Coverage of baseline controls

Every control in `baselines/settings.baseline.json`, and where it is exercised or why it is
deliberately out of scope. One row per baseline entry.

| Baseline control | Covered by / disposition |
|---|---|
| `[field] URL of profile picture` | TC-01 - filled and its persistence asserted via the API |
| `[field] Username` | TC-01 (retyped, since the form never prefills), TC-02 (cleared - the safe field to attack) |
| `[field] Short bio about you` | TC-01 - filled and its persistence asserted via the API |
| `[field] Email` | Deliberately **NOT** exercised. A malformed email is silently persisted and locks the shared account out of login (FINDING 1) - it happened during the crawl and had to be recovered via the API. A negative test must never destroy the credentials the whole suite authenticates with. Recorded in the baseline, left untouched by every test. |
| `[field] New Password` | OUT OF SCOPE - changing the password of the one shared `.env` account would invalidate the credentials `global-setup.ts` uses and break every later run. Recorded, deliberately untested. |
| `[button] Update Settings` | TC-01 (valid save), TC-02 (invalid save), TC-03 (asserted absent when logged out) |
| `[button] Or click here to logout.` | TC-03 - used to reach the logged-out state. Logout as a feature is not one of the five assignment scenarios. |
| `[heading] Your Settings` | TC-01 (present for a logged-in user), TC-03 (absent for an anonymous visitor) |
| `[link] Settings` (navbar, active on this surface) | TC-01 / TC-03 reach this route directly via `page.goto('/settings')`, which is what the link navigates to. The link itself is navigation chrome. |
| `[link] Home` | OUT OF SCOPE - navigation chrome. |
| `[link] New Article` | OUT OF SCOPE for this module - it is the entry point for the articles module and is covered in `plan/articles.md`. |
| `[link] <test-account>` (current user's profile link) | OUT OF SCOPE as a target - the profile page is not one of the five scenarios. Its route IS asserted indirectly: TC-01 confirms a successful save redirects to `/profile/<username>`, which is where this link points. |
| `[link] conduit` (navbar brand) | OUT OF SCOPE - navigation chrome. |
| `[link] conduit` (footer) | OUT OF SCOPE - footer chrome. |
| `[link] RealWorld OSS Project` | OUT OF SCOPE - external footer link, not app behaviour. |
| `[link] Bondar Academy` | OUT OF SCOPE - external footer link, not app behaviour. |
| `[img] user avatar` | OUT OF SCOPE - decorative image inside the profile link, with no accessible name and no behaviour of its own. |
| Error list (`ul.error-messages li`) | TC-01 and TC-02 assert it is EMPTY. The app never renders a message into it on this surface (verified across three separate failure modes), so there is no error text any test could assert on - the absence IS the finding. |
| `[separator] hr` | OUT OF SCOPE - presentational separator between the form and the logout button. |
| Form (`novalidate`, five fieldsets) | Exercised structurally by every test; the `novalidate` attribute is why no client-side validation exists to test (FINDING 1). |

## State coverage

Every state the baseline records as `reached: true`, and the test that exercises it:

| State | Test |
|---|---|
| `populated` | TC-01 - the form renders and is submitted (note: "populated" here means rendered, not prefilled - see FINDING 2) |
| `loading` | OUT OF SCOPE as an assertion - the loading state is a completely blank content area with no spinner, no `aria-busy` and no heading, so there is no element to assert on. Forcing it also needs network throttling. Recorded because it was genuinely observed. |
| `error` | TC-02 - submits an invalid value and asserts the outcome. The app renders no message even on a server 500 (FINDING 4), so the assertion is on stored data, not on text. |
| `disabled/invalid` | TC-02 - confirms the app has NO invalid state: Update Settings is never disabled and the blank submit is accepted with a 200 while discarding the change. |
| `terminal` | TC-01 - asserts the redirect away from `/settings` to `/profile/<username>`, which is the only signal that a save succeeded (there is no toast or banner). |
| `role-gated:anonymous` | TC-03 - navigates to `/settings` with an explicitly empty session and asserts the redirect to `/` plus the absence of the form. |
| `empty` | `reached: false` in the baseline - not a distinct state on this surface (a single fixed form with no collections that could be empty). Not claimed as covered. |

## Notes that shape the tests

These come from real defects found during the crawl - see `findings/settings.txt`.

1. **The form does not prefill.** All five fields render empty even though
   `GET /api/user` returns the data. So TC-01 must TYPE every value it asserts on
   and can never rely on an existing value being present.
2. **A malformed email is accepted and persisted**, which locks the account out of
   login. This actually happened during the crawl and had to be recovered via the
   API. Consequence: the negative test attacks `username`, not `email`. A negative
   test must never destroy the credentials the whole suite depends on.
3. **An empty username returns 200 and redirects as if saved**, but the server
   silently discards the change. TC-02 therefore asserts the *outcome* (the username
   is unchanged) rather than an error message - the app renders none.
4. **Success is silent** - no toast, no banner. A save is verified by the redirect to
   `/profile/<username>` plus re-reading the persisted state, not by a message.
5. **Every mutating test must restore the profile in teardown**, or it corrupts the
   shared account for every later test and every later run.
6. **A field cannot be cleared** - the app ignores `''` and `null` with a 200 and only
   accepts a non-empty string. So the restore fixture writes a single space for a field
   that started empty; sending `''` would silently leave the test's value behind.
7. **The two profile-mutating tests run serially** (`describe.configure({ mode: 'serial' })`).
   Conduit gives an account one mutable profile and both tests write to it, so run in
   parallel they overwrite each other's data and each other's restore. Everything else in
   the suite stays fully parallel; this file still runs in parallel with the articles spec.
