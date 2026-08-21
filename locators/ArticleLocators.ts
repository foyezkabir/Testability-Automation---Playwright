import { Page, Locator } from '@playwright/test';

/**
 * Locators for the home feed, the article editor and the article detail page.
 *
 * Two constraints drive the CSS fallbacks below, both verified against the live app:
 * feed tabs and sidebar tag pills are <a> elements with no href and no role, so getByRole
 * cannot reach them; and the whole owner-controls block is rendered twice on the detail
 * page, so Edit/Delete must be scoped to the banner.
 */
export class ArticleLocators {
  // ===== NAVIGATION =====
  readonly newArticleNavLink: Locator;

  // ===== HOME FEED =====
  readonly articlePreviews: Locator;

  // ===== ARTICLE EDITOR =====
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly bodyInput: Locator;
  readonly tagsInput: Locator;
  readonly publishButton: Locator;
  readonly tagPills: Locator;

  // ===== ARTICLE DETAIL =====
  readonly articleTitleHeading: Locator;
  readonly articleBody: Locator;
  readonly articleTags: Locator;
  readonly editArticleLink: Locator;
  readonly deleteArticleButton: Locator;

  // ===== VALIDATION ERRORS =====
  readonly errorMessages: Locator;
  readonly titleBlankError: Locator;
  readonly titleNotUniqueError: Locator;
  readonly ormLeakInError: Locator;

  constructor(private readonly page: Page) {
    this.newArticleNavLink = page.getByRole('link', { name: 'New Article' });

    // CSS: article cards are plain divs with no list or listitem roles.
    this.articlePreviews = page.locator('.article-preview');

    this.titleInput = page.getByRole('textbox', { name: 'Article Title' });
    this.descriptionInput = page.getByRole('textbox', { name: "What's this article about?" });
    this.bodyInput = page.getByRole('textbox', { name: 'Write your article (in markdown)' });
    this.tagsInput = page.getByRole('textbox', { name: 'Enter tags' });
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });

    // CSS: tag pills expose no accessible name and appear in the a11y tree as flat text.
    this.tagPills = page.locator('.tag-list .tag-pill');

    this.articleTitleHeading = page.getByRole('heading', { level: 1 });

    // CSS: rendered markdown has no role, heading or test id to target.
    this.articleBody = page.locator('.article-content');

    // CSS: detail-page tags are non-interactive li elements with no role or href.
    this.articleTags = page.locator('.tag-list li');

    // CSS on the scope only - the banner has no landmark role, and scoping to it is what
    // disambiguates this from the duplicated copy below the article body.
    this.editArticleLink = page.locator('.banner').getByRole('link', { name: 'Edit Article' });

    // CSS on the scope only - same duplication hazard as the edit link above.
    this.deleteArticleButton = page.locator('.banner').getByRole('button', { name: 'Delete Article' });

    // CSS: the error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');

    this.titleBlankError = page.getByText("title can't be blank");
    this.titleNotUniqueError = page.getByText('must be unique');

    // Asserted ABSENT: an error must never surface the ORM name to the user.
    this.ormLeakInError = page.getByText('prisma');
  }

  // ===== DYNAMIC LOCATORS =====

  feedTab(name: string): Locator {
    // CSS on the scope only - tabs expose no role, so match by text within the tab strip.
    return this.page.locator('.feed-toggle').getByText(name, { exact: true });
  }

  sidebarTag(tag: string): Locator {
    // CSS on the scope only - the same tag text also appears on cards and the tag tab.
    return this.page.locator('.sidebar').getByText(tag, { exact: true });
  }

  articleCard(title: string): Locator {
    // CSS on the scope only - narrowed by title text so it survives re-ordering.
    return this.page.locator('.article-preview').filter({ hasText: title });
  }

  articleTitle(title: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: title });
  }

  tagPill(tag: string): Locator {
    // CSS: the pill is invisible to role queries, so narrow by its own text.
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag });
  }

  tagPillRemove(tag: string): Locator {
    // CSS: the remove control is a bare icon with no role, name or text - absent from the
    // a11y tree entirely, so it can only be reached by chaining from the pill's text.
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag }).locator('i.ion-close-round');
  }

  /** The title rendered as escaped text - proves a script payload displays, not executes. */
  escapedMarkupInTitle(): Locator {
    return this.articleTitleHeading.filter({ hasText: '<script>' });
  }
}
