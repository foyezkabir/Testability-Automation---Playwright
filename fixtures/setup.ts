import { test as base, APIRequestContext } from '@playwright/test';
import { apiClient, ArticleSetup, UserSetup, SeededArticle } from '../setup';
import { newArticle } from '../datas/articles/ArticleData';
import { ArticleAsserts } from '../asserts/ArticleAsserts';
import { UserAsserts } from '../asserts/UserAsserts';
import { ACCOUNT } from '../datas/common/AccountData';

export const test = base.extend<{
  api: APIRequestContext;
  articles: ArticleSetup;
  users: UserSetup;
  articleAsserts: ArticleAsserts;
  userAsserts: UserAsserts;
  seededArticle: SeededArticle;
  cleanupArticle: (title: string) => void;
  cleanupSlugLessArticle: void;
  restoredProfile: void;
}>({
  api: async ({}, use) => {
    const context = await apiClient();
    await use(context);
    await context.dispose();
  },

  articles: async ({ api }, use) => {
    await use(new ArticleSetup(api));
  },

  users: async ({ api }, use) => {
    await use(new UserSetup(api));
  },

  articleAsserts: async ({ articles }, use) => {
    await use(new ArticleAsserts(articles));
  },

  userAsserts: async ({ users }, use) => {
    await use(new UserAsserts(users));
  },

  seededArticle: async ({ articles }, use) => {
    const article = newArticle();
    const seeded = await articles.create(article);
    await use(seeded);
    // TC-03 renames the article, which changes its slug, so the seeded slug is not enough.
    await articles.removeMany([seeded.slug]);
    await articles.removeByTitlePrefix([article.title], seeded.author.username);
  },

  // A whitespace-only title slugifies to nothing (FINDING 8), leaving no title text for
  // cleanupArticle to match. Without this the residue blocks the next run: the duplicate
  // blank slug is rejected with 422, so the test would fail for the wrong reason.
  cleanupSlugLessArticle: async ({ articles }, use) => {
    await use();
    await articles.removeSlugLess(ACCOUNT.username);
  },

  // Matches on the title's random suffix. Exact-title lookup missed (the app does not store
  // titles verbatim) and leaked 45 articles; a before/after slug diff fixed that but deleted
  // other workers' articles mid-run.
  cleanupArticle: async ({ articles }, use) => {
    const titles: string[] = [];
    await use((title: string) => {
      titles.push(title);
    });
    await articles.removeByTitlePrefix(titles, ACCOUNT.username);
  },

  restoredProfile: async ({ users }, use) => {
    const snapshot = await users.getProfile();
    await use();
    await users.restoreProfile(snapshot);
  },
});

export { expect } from '@playwright/test';
