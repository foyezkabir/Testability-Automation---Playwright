import { APIRequestContext } from '@playwright/test';
import { NewArticle } from '../datas/articles/ArticleData';

export type SeededArticle = {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  author: { username: string };
};

export class ArticleSetup {
  constructor(private readonly api: APIRequestContext) {}

  async create(article: NewArticle): Promise<SeededArticle> {
    const response = await this.api.post('articles', { data: { article }, maxRetries: 3 });

    if (!response.ok()) {
      throw new Error(`ArticleSetup.create failed (${response.status()}): ${await response.text()}`);
    }

    const body = await response.json();
    return body.article as SeededArticle;
  }

  /** Best-effort teardown of every tracked slug - never throws, so cleanup cannot fail a test. */
  async removeMany(slugs: readonly string[]): Promise<void> {
    for (const slug of slugs) {
      await this.api.delete(`articles/${slug}`).catch(() => undefined);
    }
  }

  async findSlugByTitle(title: string, author: string): Promise<string | undefined> {
    const response = await this.api.get(`articles?author=${encodeURIComponent(author)}&limit=100`);
    const body = await response.json();
    const match = (body.articles as SeededArticle[]).find((a) => a.title === title);
    return match?.slug;
  }

  /**
   * Slugs owned by `author` whose description matches. A test may rename an article, and
   * the slug is derived from the title - so neither the original slug nor title can find
   * it afterwards. The description is the field no test edits.
   */
  async findSlugsByDescription(description: string, author: string): Promise<string[]> {
    const response = await this.api.get(`articles?author=${encodeURIComponent(author)}&limit=100`);
    const payload = await response.json();
    return (payload.articles as SeededArticle[])
      .filter((a) => a.description === description)
      .map((a) => a.slug);
  }

  /** The stored state of one article, or undefined when it no longer exists. */
  async getArticle(slug: string): Promise<SeededArticle | undefined> {
    const response = await this.api.get(`articles/${slug}`);

    if (!response.ok()) {
      return undefined;
    }

    const body = await response.json();
    return body.article as SeededArticle;
  }

  /** Whether an article still exists - used to assert a delete actually took effect. */
  async exists(slug: string): Promise<boolean> {
    const response = await this.api.get(`articles/${slug}`);
    return response.ok();
  }

  /** Every tag the app currently offers as a filter. */
  async listTags(): Promise<string[]> {
    const response = await this.api.get('tags');
    const body = await response.json();
    return body.tags as string[];
  }

  /** Articles the backend returns for a tag, with the count it reports. */
  async listByTag(tag: string): Promise<{ articles: SeededArticle[]; count: number }> {
    const response = await this.api.get(`articles?tag=${encodeURIComponent(tag)}&limit=100`);
    const body = await response.json();
    return { articles: body.articles as SeededArticle[], count: body.articlesCount as number };
  }

  /** The most recent article NOT written by `username` - the fixture for non-author checks. */
  async findArticleByAnotherAuthor(username: string): Promise<SeededArticle | undefined> {
    const response = await this.api.get('articles?limit=20');
    const body = await response.json();
    return (body.articles as SeededArticle[]).find((a) => a.author.username !== username);
  }
}
