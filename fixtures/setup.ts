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
    const seeded = await articles.create(newArticle());
    await use(seeded);
    // A test may have renamed this article, which also changes its slug - so resolve by
    // description, and try the original slug for the untouched case.
    const currentSlugs = await articles.findSlugsByDescription(seeded.description, seeded.author.username);
    await articles.removeMany([...currentSlugs, seeded.slug]);
  },

  cleanupArticle: async ({ articles }, use) => {
    const titles: string[] = [];
    await use((title: string) => {
      titles.push(title);
    });
    const slugs = await Promise.all(titles.map((title) => articles.findSlugByTitle(title, ACCOUNT.username)));
    await articles.removeMany(slugs.filter((slug): slug is string => Boolean(slug)));
  },

  restoredProfile: async ({ users }, use) => {
    const snapshot = await users.getProfile();
    await use();
    // Always restores, including on failure - every test shares one account.
    await users.restoreProfile(snapshot);
  },
});

export { expect } from '@playwright/test';
