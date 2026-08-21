# Test plan - articles module

**Surfaces:** `/` (home feed + tag sidebar + pagination), `/editor` (create), `/editor/:slug` (edit), `/article/:slug` (detail)
**Baseline:** `baselines/articles.baseline.json`
**Depth:** `deep` - article CRUD is the core of the assignment, so states are forced via API seeding.
**Assignment scenarios covered here:** Create New Article, Edit Article, Delete Article, Filter Articles by Tag.

Numbering restarts at TC-01 for this module.

## Fixture pattern per scenario

Decided by the entity's ROLE in each test, not by the action name:

| Scenario | Article origin | Pattern | Why |
|---|---|---|---|
| Create | **UI** | B | the article's creation IS the subject under test |
| Edit | **API seed** | A | the article must already exist for an edit to be possible |
| Delete | **API seed** | A | same - existence is the precondition |
| Filter by tag | **neither** | — | seeding cannot help here: tag queries never return user-created articles (findings/articles.txt FINDING 7), so the test reads the API's own answer for an indexed tag and asserts the UI matches it |

## Test matrix

| TC | View × state × action | Tag | Fixture | Key assertions |
|---|---|---|---|---|
| TC-01 | `/editor` · populated · publish a valid article | `@smoke @critical` | `cleanup` (B) | redirect to `/article/<slug>`; h1 = title; body text rendered; tag pill present; article retrievable via API (data persistence) |
| TC-02 | `/editor` · error · publish with every field empty | `@regression` | none | stays on `/editor`; exactly 1 error item; text `title can't be blank`; no article created |
| TC-03 | `/editor/:slug` · populated · edit title + body of a seeded article | `@critical` | `seededArticle` (A) | redirect to `/article/<new-slug>`; h1 = new title; new body rendered; API confirms the update persisted |
| TC-04 | `/editor/:slug` · disabled/invalid · clear the title and submit | `@regression` | `seededArticle` (A) | no error is rendered (the app shows none on edit); API confirms the stored title is unchanged - a blank title must not overwrite saved data |
| TC-05 | `/article/:slug` · terminal · delete a seeded article | `@critical` | `seededArticle` (A) | no confirmation dialog appears; redirects to `/`; article gone from the feed; API returns 404 |
| TC-06 | `/article/:slug` · role-gated:non-author · owner controls absent on another user's article | `@regression` | none | Edit Article count = 0; Delete Article count = 0; Favorite/Follow controls present instead |
| TC-07 | `/` · tag-filtered · filter the feed by an indexed tag | `@smoke` | none | tag tab activates; the listed count settles to what the API reports for that tag; every listed article visibly carries the tag |
| TC-08 | `/` · populated · a tag that matches nothing yields no articles | `@regression` | none | the API returns zero articles for an unknown tag, and the tag is not offered in the sidebar (negative case for filtering) |
| TC-09 | `/editor` · populated · remove one tag pill while composing | `@regression` | none | the removed pill disappears; the other pill is unaffected |

## Test matrix - input validation & boundaries

Derived from a dedicated edge-case probe of the article endpoints; evidence for every row
is in `findings/articles.txt`.

Rows marked **test.fail** assert what the app SHOULD do and are reported as expected-to-fail
via `test.fail`, so a known defect is visible in the report without turning the suite red.
They carry `@known-defect` and are listable with `--grep @known-defect`.

| TC | View × state × action | Tag | Fixture | Key assertions |
|---|---|---|---|---|
| TC-10 | `/editor` · disabled/invalid · publish with every text field whitespace-only | `@regression @known-defect` **test.fail** | none | a whitespace title is treated as blank; the blank-title error shows; no navigation away from `/editor`. **Currently fails: FINDING 8** - accepted with 201 and the slug collapses to `-64987` |
| TC-11 | `/editor` · disabled/invalid · publish with whitespace-only description and body | `@regression @known-defect` **test.fail** | `cleanupArticle` (B) | whitespace content is rejected exactly as empty content is. **Currently fails: FINDING 10** |
| TC-12 | `/editor` · error · publish a title of 186 characters | `@regression @known-defect` **test.fail** | none | a user-facing validation error appears and the message does not leak the ORM/schema. **Currently fails: FINDING 9** - returns HTTP 500 naming the Prisma call and the `slug` column |
| TC-13 | `/editor` · populated · publish a title at the 185-character limit | `@regression` | `cleanupArticle` (B) | publishes successfully; the full title is stored intact. Guards the measured upper boundary so a regression that lowers it is caught |
| TC-14 | `/editor` · error · publish a title already in use | `@regression` | `seededArticle` (A) | rejected with `must be unique`; stays on `/editor`. The slug derives from the title, so duplicates would collide |
| TC-15 | `/editor` · populated · publish a single-character title | `@regression` | `cleanupArticle` (B) | accepted - the app enforces no minimum length. Documents the real contract rather than a rule the app lacks |
| TC-16 | `/editor` · populated · publish a unicode + emoji title | `@regression` | `cleanupArticle` (B) | non-ASCII characters survive the round trip unchanged |
| TC-17 | `/editor` · populated · publish a title containing SQL-like text | `@regression @critical` | `cleanupArticle` (B) | the payload is displayed verbatim, proving it was not executed; the tags endpoint still responds, proving no table was dropped |
| TC-18 | `/article/:slug` · populated · view an article whose title contains script markup | `@critical` | `cleanupArticle` (B) | no native dialog fires and the markup renders as literal text. This is the render check that RESOLVED FINDING 11 as **not exploitable** |
| TC-19 | `/editor` · populated · add the same tag twice | `@regression` | `cleanupArticle` (B) | a repeated tag appears once. PASSES - the editor de-duplicates correctly (FINDING 12 was corrected; the original claim came from an API-only probe) |
| TC-20 | `/editor` · disabled/invalid · press Enter on a whitespace-only tag | `@regression` | none | no pill is added. PASSES - the editor rejects a blank tag (the API does not; see FINDING 12) |
| TC-21 | `/editor` · populated · add 50 tags | `@regression` | `cleanupArticle` (B) | every tag becomes a pill - the app sets no cap. Documents the current contract; FINDING 12 records that a cap would be preferable |

### Boundary values used, and where they came from

The title-length values are **measured, not guessed**: a binary search against the live API
found 185 characters accepted and 186 rejected with an HTTP 500, because the derived slug
overflows its database column. Both sides of that boundary are covered - TC-13 asserts the
accepted side stays working, TC-12 asserts the rejected side should fail gracefully.

## Coverage of baseline controls

Every control in `baselines/articles.baseline.json`, and where it is exercised or why it is
deliberately out of scope. One row per baseline entry.

### Home feed (`/`)

| Baseline control | Covered by / disposition |
|---|---|
| `[heading] Article preview title (h1, one per article card - NOT a page heading; the logged-in home page has no h1/h2 of its own)` | TC-07, TC-08 - the per-card h1 is how a filtered article is identified; also TC-05 (absence after delete) |
| `[tab] Your Feed` | TC-07 - asserted as one of the feed tabs alongside the tag tab |
| `[tab] Global Feed` | TC-07 - the default active tab the filter navigates away from |
| `[tab] #<tag> (third tab, hidden until a sidebar tag is clicked)` | TC-07 - asserted to appear and activate when a tag is selected |
| `[generic] Your Feed` | TC-07 - same control as the tab entry above (the baseline records it twice: once as a tab, once as the non-semantic anchor it actually is) |
| `[generic] Global Feed` | TC-07 - same control as the tab entry above |
| `[generic] #<tag> tag tab` | TC-07 - same control as the tab entry above |
| `[generic] Popular tag pill (sidebar)` | TC-07 (clicked to filter), TC-08 (asserted absent for an unknown tag) |
| `[element] Article feed (list of .article-preview cards)` | TC-07 - the card count is asserted against the API's own answer for the tag; TC-05 asserts a deleted article leaves it |
| `[link] conduit` (navbar brand) | OUT OF SCOPE - navigation chrome, not one of the five scenarios. Recorded because it exists. |
| `[link] Home` | OUT OF SCOPE - navigation chrome. |
| `[link]  New Article` | TC-01 - used to reach the editor, asserting the editor is reachable from the main nav |
| `[link]  Settings` | OUT OF SCOPE here - it is the entry point for the settings module and is covered in `plan/settings.md`. |
| `[link] <test-account>` (current user's profile link) | OUT OF SCOPE - the profile page is not one of the five scenarios. Its accessible name is asserted indirectly in TC-06, which reads the logged-in username to identify a foreign article. |
| `[button] Pagination page 1` | OUT OF SCOPE - paging is not an assignment scenario, and the global feed's contents are not stable enough to assert page composition (see baseline `data-instability`). |
| `[button] Pagination page 2` | OUT OF SCOPE - same reason as page 1. |
| `[button] Favorite/like (heart + count)` | TC-06 - asserted PRESENT on a non-owned article, as the inverse proof that owner controls are role-gated. Favouriting itself is not an assignment scenario. |
| `[link] conduit` (footer) | OUT OF SCOPE - footer chrome. |
| `[link] RealWorld OSS Project` | OUT OF SCOPE - external footer link, not app behaviour. |
| `[link] Bondar Academy` | OUT OF SCOPE - external footer link, not app behaviour. |
| `[icon-in-link] ion-compose (New Article)` | OUT OF SCOPE as an icon - decorative, no accessible name. It is the reason the New Article link's name carries a leading space, which TC-01 relies on by using non-exact matching. |
| `[icon-in-link] ion-gear-a (Settings)` | OUT OF SCOPE - decorative icon, same as above. |
| `[icon-image] img.user-pic (user avatar)` | OUT OF SCOPE - decorative image with no accessible name. |
| `[icon-in-button] ion-heart (favorite)` | OUT OF SCOPE as an icon - decorative; the button that contains it is covered by TC-06. |
| `[icon-in-tab] ion-pound (# on tag tab)` | OUT OF SCOPE as an icon - decorative. It is why the tag tab's text is the bare tag name, which TC-07 asserts on. |
| `[icon-image-link] author avatar img` | OUT OF SCOPE - nameless decorative link to the author profile, which is not an assignment scenario. |
| `[icon-element] ion-close-round (tag pill remove, editor only)` | TC-09 - clicked to remove a tag pill (the editor copy of this control; see the editor view below). |

### New Article editor (`/editor`)

| Baseline control | Covered by / disposition |
|---|---|
| `[textbox] Article Title` | TC-01 (filled), TC-02 (left empty → error), TC-03 (edited), TC-04 (cleared) |
| `[textbox] What's this article about?` | TC-01 (filled), TC-03 (present when editing a seeded article) |
| `[textbox] Write your article (in markdown)` | TC-01 (filled), TC-03 (edited and asserted on the detail page) |
| `[textbox] Enter tags` | TC-01 (tags added), TC-09 (two tags added then one removed) |
| `[button] Publish Article` | TC-01, TC-02, TC-03, TC-04 - submits in every editor test |
| `[item:generic] <tag text>` (tag pill) | TC-01 (pill asserted on the published article), TC-09 (pill counts asserted before and after removal) |
| `[item:none] remove (ion-close-round)` | TC-09 - clicked to remove one pill |
| `[icon-element] ion-close-round (tag pill remove)` | TC-09 - same control as the row above |
| Editor error list (`ul.error-messages li`) | TC-02 (exactly one message, `title can't be blank`), TC-04 (asserted EMPTY - the app renders none on edit) |

### Article detail (`/article/:slug`)

| Baseline control | Covered by / disposition |
|---|---|
| Article title (h1, the only one on this view) | TC-01, TC-03, TC-05 |
| Article body (`.article-content`) | TC-01, TC-03 |
| Tag list (non-interactive `li`) | TC-01 |
| `Edit Article` link (duplicated ×2, banner-scoped) | TC-03, TC-06 (asserted absent for a non-author) |
| `Delete Article` button (duplicated ×2, banner-scoped) | TC-05, TC-01 (asserted visible as the owner marker), TC-06 (asserted absent for a non-author) |
| Author link / article date | OUT OF SCOPE as targets - the author identity is used by TC-06 to pick a foreign article, but the profile page is not an assignment scenario. |
| Comment textarea, `Post Comment`, comment delete icon | OUT OF SCOPE - commenting is not one of the five assignment scenarios. Recorded in the baseline because it exists on the surface; deliberately untested. |

### Page-level states and messages

| Baseline entry | Covered by / disposition |
|---|---|
| Empty state `No articles are here... yet.` | OUT OF SCOPE - reachable on Your Feed, but "Your Feed is empty" is a property of the account (it follows nobody), not one of the five scenarios. |
| Loading messages `Loading articles...` / `Loading tags...` | OUT OF SCOPE - forcing them needs network throttling and neither is an assignment scenario. Recorded so their absence from the suite is deliberate. |
| Anonymous-only hero (`.banner`, logged out) | OUT OF SCOPE for this module - the logged-out state is asserted in `settings TC-03`. |
| No search / sort / filter controls exist on the feed | Nothing to test - recorded in the baseline as `verifiedAbsent` so the gap is provably absence, not an unexplored surface. |

## Editor state coverage

Every state the baseline records as `reached: true` on the editor view, and the test that
exercises it:

| Editor state | Test |
|---|---|
| `empty` | TC-02 - submits the pristine empty form and asserts the single server-side error |
| `populated` | TC-01 - fills all fields plus tags and publishes; TC-09 populates the tag list |
| `loading` | OUT OF SCOPE as an assertion - the only affordance is a ~240ms transient disable on the Publish button with no spinner and no `aria-busy`. Asserting a 240ms window would be a race, and it is not an assignment scenario. Recorded because it was genuinely observed. |
| `error` | TC-02 - asserts the 422-driven message `title can't be blank` and that the page stays on `/editor` |
| `disabled/invalid` | TC-02 and TC-04 - both confirm the app has NO client-side invalid state: Publish stays enabled and no field-level error appears. TC-04 additionally proves an invalid edit does not corrupt stored data. |
| `terminal` | TC-01 - publishes and asserts the redirect to `/article/<slug>` with the content rendered and persisted |
| `role-gated:anonymous` | `reached: false` in the baseline (never probed logged-out on this view). The equivalent guard IS tested for the settings route in `settings TC-03`. Not claimed as covered here. |

## Notes that shape the tests

- Validation on **create** is server-side only: an invalid submit produces a 422 and exactly **one** error at a time (title → description → body). A test that submits an empty form and expects three messages would fail.
- Validation on **edit** behaves differently: a blank title returns **200** and redirects as success while the server keeps the old title. TC-04 therefore asserts the stored data is undamaged, not that an error appeared.
- **Publish is never disabled**, so no test may assert a disabled submit button.
- Editing a title **changes the slug**, and the slug is derived from the title - so teardown can resolve a renamed article by neither its title nor its slug. It resolves by **description**, the one field no test edits.
- **Tag queries never return user-created articles** (FINDING 7), so TC-07 filters by an indexed tag and asserts the UI matches the API's own answer.
- The global feed mixes in other users' articles, so no test asserts absolute counts or `.first()` card identity.
- Post-delete redirect takes ~1.5s; TC-05 waits declaratively on the URL, never on a sleep.
- The app is a **shared public demo** that intermittently stalls for minutes and recovers. Navigations to a seeded article are wrapped in `toPass` so a transient stall is retried rather than reported as a product failure.
