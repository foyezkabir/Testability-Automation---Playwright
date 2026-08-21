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

  /**
   * Delete every article this author owns whose slug matches one of `titles`.
   *
   * Matching is on the random suffix each factory title carries: the app slugifies the
   * title unpredictably (spaces, punctuation and unicode are all transformed), so the
   * suffix is the only part guaranteed to survive into the slug. That keeps teardown
   * scoped to THIS test's articles, which a snapshot-diff approach could not do safely
   * while workers run in parallel.
   */
  async removeByTitlePrefix(titles: readonly string[], author: string): Promise<void> {
    if (!titles.length) {
      return;
    }

    const response = await this.api.get(`articles?author=${encodeURIComponent(author)}&limit=100`);
    const body = await response.json();
    const owned = body.articles as SeededArticle[];
    const tokens = titles.flatMap((title) => title.split(/\s+/).filter((part) => part.length >= 6));
    const doomed = owned.filter((a) => tokens.some((token) => a.slug.includes(token)));

    await this.removeMany(doomed.map((a) => a.slug));
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

  /**
   * An article NOT written by `username`, for the non-author checks.
   *
   * The global feed mixes in our own articles, and the API caps the page size, so taking the
   * first foreign entry from one page is order-dependent: in CI it returned an article we
   * owned and the owner-controls assertion inverted. Paging until a genuinely foreign author
   * is found makes it independent of feed ordering and of how much test data exists.
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
}
