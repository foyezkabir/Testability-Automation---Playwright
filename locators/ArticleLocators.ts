/**
 * Article Locators for the Conduit web application.
 * Covers the home feed, tag filtering, the article editor, and the article detail view.
 */
import { Page, Locator } from '@playwright/test';

export class ArticleLocators {
  // ===== NAVIGATION & GLOBAL CHROME =====
  readonly homeNavLink: Locator;
  readonly newArticleNavLink: Locator;
  readonly settingsNavLink: Locator;

  // ===== HOME FEED =====
  readonly articlePreviews: Locator;
  readonly popularTagsHeading: Locator;
  readonly emptyFeedMessage: Locator;
  readonly loadingArticlesMessage: Locator;
  readonly favoriteButtons: Locator;
  readonly pageNumberDisplay: Locator;

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
  readonly commentInput: Locator;
  readonly postCommentButton: Locator;

  // ===== VALIDATION ERROR MESSAGES =====
  readonly errorMessages: Locator;
  readonly titleBlankError: Locator;
  readonly descriptionBlankError: Locator;
  readonly bodyBlankError: Locator;
  readonly titleNotUniqueError: Locator;
  readonly ormLeakInError: Locator;

  constructor(private readonly page: Page) {
    // ===== NAVIGATION & GLOBAL CHROME =====
    this.homeNavLink = page.getByRole('link', { name: 'Home' });
    this.newArticleNavLink = page.getByRole('link', { name: 'New Article' });
    this.settingsNavLink = page.getByRole('link', { name: 'Settings' });

    // ===== HOME FEED =====
    // CSS: article cards are plain divs with no list or listitem roles.
    this.articlePreviews = page.locator('.article-preview');
    this.popularTagsHeading = page.getByText('Popular Tags', { exact: true });
    this.emptyFeedMessage = page.getByText('No articles are here... yet.');
    this.loadingArticlesMessage = page.getByText('Loading articles...');
    // CSS: favorite buttons are named by a bare count, colliding with pagination numbers.
    this.favoriteButtons = page.locator('app-favorite-button button');
    // CSS: the page indicator is an unlabelled list with no accessible name.
    this.pageNumberDisplay = page.locator('ul.pagination');

    // ===== ARTICLE EDITOR =====
    this.titleInput = page.getByRole('textbox', { name: 'Article Title' });
    this.descriptionInput = page.getByRole('textbox', { name: "What's this article about?" });
    this.bodyInput = page.getByRole('textbox', { name: 'Write your article (in markdown)' });
    this.tagsInput = page.getByRole('textbox', { name: 'Enter tags' });
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });
    // CSS: tag pills expose no accessible name and appear in the a11y tree as flat text.
    this.tagPills = page.locator('.tag-list .tag-pill');

    // ===== ARTICLE DETAIL =====
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
    this.commentInput = page.getByRole('textbox', { name: 'Write a comment...' });
    this.postCommentButton = page.getByRole('button', { name: 'Post Comment' });

    // ===== VALIDATION ERROR MESSAGES =====
    // CSS: the error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');
    this.titleBlankError = page.getByText("title can't be blank");
    this.descriptionBlankError = page.getByText("description can't be blank");
    this.bodyBlankError = page.getByText("body can't be blank");
    this.titleNotUniqueError = page.getByText('must be unique');
    // Asserted ABSENT: a validation error must never surface the ORM name to the user.
    this.ormLeakInError = page.getByText('prisma');
  }

  // ===== DYNAMIC LOCATORS =====

  /** A feed tab by its visible text. Tabs have no role, so they are matched inside the tab strip. */
  feedTab(name: string): Locator {
    // CSS on the scope only - tabs expose no role, so match by text within the tab strip.
    return this.page.locator('.feed-toggle').getByText(name, { exact: true });
  }

  /** A tag pill in the Popular Tags sidebar. */
  sidebarTag(tag: string): Locator {
    // CSS on the scope only - the same tag text also appears on cards and the tag tab.
    return this.page.locator('.sidebar').getByText(tag, { exact: true });
  }

  /** An article card in the feed, identified by the title it contains. */
  articleCard(title: string): Locator {
    // CSS on the scope only - narrowed by title text so it survives re-ordering.
    return this.page.locator('.article-preview').filter({ hasText: title });
  }

  /** An article title heading, in the feed or on the detail page. */
  articleTitle(title: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: title });
  }

  /** One tag pill in the editor. */
  tagPill(tag: string): Locator {
    // CSS: pill is invisible to role queries, so narrow by its own text via filter().
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag });
  }

  /** The remove (x) control on an editor tag pill. */
  tagPillRemove(tag: string): Locator {
    // CSS: remove control is a bare icon with no role, name or text - absent from the a11y tree.
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag }).locator('i.ion-close-round');
  }

  /** A pagination page button. */
  paginationPage(pageNumber: string): Locator {
    // CSS on the scope only - favorite-count buttons are also named with bare numbers.
    return this.page.locator('ul.pagination').getByRole('button', { name: pageNumber, exact: true });
  }

  /**
   * The article title rendered as ESCAPED text rather than interpreted markup. Used to
   * prove a script payload is displayed, not executed.
   */
  escapedMarkupInTitle(): Locator {
    return this.articleTitleHeading.filter({ hasText: '<script>' });
  }

  /** The article author link inside the detail banner. */
  authorLink(username: string): Locator {
    // CSS on the scope only - separates this from the identical navbar username link.
    return this.page.locator('.banner').getByRole('link', { name: username });
  }
}
