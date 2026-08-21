import { Page, Locator } from '@playwright/test';

export class ArticleLocators {
  constructor(private readonly page: Page) {
    // .banner scope: the whole owner-controls block renders twice on the detail page.
    const banner = page.locator('.banner');

    this.newArticleNavLink = page.getByRole('link', { name: 'New Article' });

    this.titleInput = page.getByRole('textbox', { name: 'Article Title' });
    this.descriptionInput = page.getByRole('textbox', { name: "What's this article about?" });
    this.bodyInput = page.getByRole('textbox', { name: 'Write your article (in markdown)' });
    this.tagsInput = page.getByRole('textbox', { name: 'Enter tags' });
    this.publishButton = page.getByRole('button', { name: 'Publish Article' });

    this.articleTitleHeading = page.getByRole('heading', { level: 1 });
    this.editArticleLink = banner.getByRole('link', { name: 'Edit Article' });
    this.deleteArticleButton = banner.getByRole('button', { name: 'Delete Article' });

    this.titleBlankError = page.getByText("title can't be blank");
    this.titleNotUniqueError = page.getByText('must be unique');
    this.ormLeakInError = page.getByText('prisma');

    // Article cards are plain divs with no list or listitem roles.
    this.articlePreviews = page.locator('.article-preview');
    // Editor tag pills expose no accessible name and appear in the a11y tree as flat text.
    this.tagPills = page.locator('.tag-list .tag-pill');
    // Rendered markdown has no role, heading or test id to target.
    this.articleBody = page.locator('.article-content');
    // Detail-page tags are non-interactive li elements with no role or href.
    this.articleTags = page.locator('.tag-list li');
    // The error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');
  }

  readonly newArticleNavLink: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly bodyInput: Locator;
  readonly tagsInput: Locator;
  readonly publishButton: Locator;
  readonly articleTitleHeading: Locator;
  readonly editArticleLink: Locator;
  readonly deleteArticleButton: Locator;
  readonly titleBlankError: Locator;
  readonly titleNotUniqueError: Locator;
  readonly ormLeakInError: Locator;
  readonly articlePreviews: Locator;
  readonly tagPills: Locator;
  readonly articleBody: Locator;
  readonly articleTags: Locator;
  readonly errorMessages: Locator;

  feedTab(name: string): Locator {
    // Feed tabs are <a> elements with no href and no role, so they are matched by text.
    return this.page.locator('.feed-toggle').getByText(name, { exact: true });
  }

  sidebarTag(tag: string): Locator {
    // Sidebar tags have no role either, and the same text appears on cards and the tag tab.
    return this.page.locator('.sidebar').getByText(tag, { exact: true });
  }

  articleCard(title: string): Locator {
    // Cards have no role; narrowed by title text so it survives re-ordering.
    return this.page.locator('.article-preview').filter({ hasText: title });
  }

  articleTitle(title: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: title });
  }

  tagPill(tag: string): Locator {
    // The pill is invisible to role queries, so narrow by its own text.
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag });
  }

  tagPillRemove(tag: string): Locator {
    // The remove control is a bare icon with no role, name or text - absent from the a11y tree.
    return this.page.locator('.tag-list .tag-pill').filter({ hasText: tag }).locator('i.ion-close-round');
  }

  escapedMarkupInTitle(): Locator {
    return this.articleTitleHeading.filter({ hasText: '<script>' });
  }
}
