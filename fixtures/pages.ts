import { test as base } from '@playwright/test';
import { ArticlePage } from '../pages/ArticlePage';
import { SettingsPage } from '../pages/SettingsPage';

export const test = base.extend<{
  articlePage: ArticlePage;
  settingsPage: SettingsPage;
}>({
  articlePage: async ({ page }, use) => {
    await use(new ArticlePage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect } from '@playwright/test';
