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
    // TC-03 renames this article, which also changes its slug, so the seeded slug alone is
    // not enough. Match on the random suffix of BOTH the original title and whatever the
    // test renamed it to - the same mechanism cleanupArticle uses, and parallel-safe.
    await articles.removeMany([seeded.slug]);
    await articles.removeByTitlePrefix([article.title], seeded.author.username);
  },

  cleanupArticle: async ({ articles }, use) => {
    // Delete by SLUG PREFIX, derived from the title the spec registers.
    //
    // Two earlier approaches failed. Exact title lookup missed, because the app does not
    // always store the title verbatim - that leaked 45 articles which then polluted the
    // feed the tests read from. Diffing all owned slugs before/after fixed the leak but is
    // not parallel-safe: a worker's "after" snapshot contains articles another worker is
    // still using, so it deleted them mid-test.
    //
    // The slug is `<slugified-title>-<userId>`, and every factory title carries a random
    // suffix, so a prefix match is both unique to this test and immune to how the app
    // normalises the title.
    const titles: string[] = [];
    await use((title: string) => {
      titles.push(title);
    });
    await articles.removeByTitlePrefix(titles, ACCOUNT.username);
  },

  restoredProfile: async ({ users }, use) => {
    const snapshot = await users.getProfile();
    await use();
    // Always restores, including on failure - every test shares one account.
    await users.restoreProfile(snapshot);
  },
});

export { expect } from '@playwright/test';
