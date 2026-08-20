/**
 * Backend assertions for articles - the data-persistence half of each test.
 *
 * Separate from `setup/`, which seeds and tears down state and must never assert, and from
 * `pages/`, which asserts on what the UI shows. These verify what the BACKEND stored, so a
 * spec can state that in one line instead of parsing a response inline.
 */
import { expect } from '@playwright/test';
import { ArticleSetup } from '../setup/ArticleSetup';

export class ArticleAsserts {
  constructor(private readonly articles: ArticleSetup) {}

  async expectArticleExists(slug: string): Promise<void> {
    await expect.poll(() => this.articles.exists(slug)).toBe(true);
  }

  async expectArticleDeleted(slug: string): Promise<void> {
    await expect.poll(() => this.articles.exists(slug)).toBe(false);
  }

  async expectStoredTitle(slug: string, title: string): Promise<void> {
    const stored = await this.articles.getArticle(slug);
    expect(stored?.title).toBe(title);
  }

  async expectTagHasArticles(tag: string): Promise<void> {
    const result = await this.articles.listByTag(tag);
    expect(result.count).toBeGreaterThan(0);
  }

  async expectTagHasNoArticles(tag: string): Promise<void> {
    const result = await this.articles.listByTag(tag);
    expect(result.articles).toHaveLength(0);
    expect(result.count).toBe(0);
  }

  /** The tags endpoint still responds - proof no table was dropped by an injection payload. */
  async expectDatabaseStillReadable(): Promise<void> {
    const tags = await this.articles.listTags();
    expect(tags.length).toBeGreaterThan(0);
  }

  async expectAnotherAuthorsArticleExists(username: string): Promise<void> {
    const foreign = await this.articles.findArticleByAnotherAuthor(username);
    expect(foreign).toBeTruthy();
  }
}
