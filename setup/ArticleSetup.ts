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

/** Article state seeding and teardown. No assertions - this is scaffolding, never the subject. */
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

  /** Best-effort teardown - never throws, so cleanup cannot fail a test. */
  async removeMany(slugs: readonly string[]): Promise<void> {
    for (const slug of slugs) {
      await this.api.delete(`articles/${slug}`).catch(() => undefined);
    }
  }

  /**
   * Delete this author's articles whose slug contains one of the titles' random suffixes.
   *
   * Matching on the suffix rather than the whole title is deliberate: the app slugifies
   * titles unpredictably, so the suffix is the only part guaranteed to survive into the
   * slug. It also keeps teardown scoped to one test's data, which a snapshot-diff approach
   * could not do while workers run in parallel.
   */
  async removeByTitlePrefix(titles: readonly string[], author: string): Promise<void> {
    if (!titles.length) {
      return;
    }

    const owned = await this.listOwned(author);
    const tokens = titles.flatMap((title) => title.split(/\s+/).filter((part) => part.length >= 6));

    await this.removeMany(owned.filter((a) => tokens.some((t) => a.slug.includes(t))).map((a) => a.slug));
  }

  /**
   * Delete any article whose slug is only the user-id suffix. A whitespace-only title
   * slugifies to nothing (findings/articles.txt FINDING 8), leaving no title text for
   * removeByTitlePrefix to match.
   */
  async removeSlugLess(author: string): Promise<void> {
    const owned = await this.listOwned(author);
    await this.removeMany(owned.filter((a) => a.slug.startsWith('-')).map((a) => a.slug));
  }

  async getArticle(slug: string): Promise<SeededArticle | undefined> {
    const response = await this.api.get(`articles/${slug}`);

    if (!response.ok()) {
      return undefined;
    }

    const body = await response.json();
    return body.article as SeededArticle;
  }

  async exists(slug: string): Promise<boolean> {
    return (await this.api.get(`articles/${slug}`)).ok();
  }

  async listTags(): Promise<string[]> {
    const response = await this.api.get('tags');
    const body = await response.json();
    return body.tags as string[];
  }

  async listByTag(tag: string): Promise<{ articles: SeededArticle[]; count: number }> {
    const response = await this.api.get(`articles?tag=${encodeURIComponent(tag)}&limit=100`);
    const body = await response.json();
    return { articles: body.articles as SeededArticle[], count: body.articlesCount as number };
  }

  /**
   * An article NOT written by `username`, for the non-author checks. Pages until it finds
   * one: the feed mixes in our own articles and the API caps the page size, so taking the
   * first foreign entry from one page returned an article we owned when run in CI.
   */
  async findArticleByAnotherAuthor(username: string): Promise<SeededArticle | undefined> {
    const pageSize = 20;

    for (let offset = 0; offset < 100; offset += pageSize) {
      const response = await this.api.get(`articles?limit=${pageSize}&offset=${offset}`);
      const body = await response.json();
      const articles = body.articles as SeededArticle[];

      if (!articles.length) {
        return undefined;
      }

      const foreign = articles.find((a) => a.author.username !== username);

      if (foreign) {
        return foreign;
      }
    }

    return undefined;
  }

  private async listOwned(author: string): Promise<SeededArticle[]> {
    const response = await this.api.get(`articles?author=${encodeURIComponent(author)}&limit=100`);
    const body = await response.json();
    return body.articles as SeededArticle[];
  }
}
