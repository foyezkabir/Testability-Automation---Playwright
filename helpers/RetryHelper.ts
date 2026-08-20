import { expect, Locator } from '@playwright/test';

/**
 * Retry wrappers for navigations that this shared demo app occasionally serves before its
 * data has loaded - the editor can render with blank fields, or an article URL can bounce
 * to the feed. Retrying the whole navigation is the reliable fix; waiting longer on a
 * blank field is not.
 */
export class RetryHelper {
  /** Navigate until a field holds the expected value. */
  static async openUntilFieldHasValue(
    open: () => Promise<void>,
    field: Locator,
    expectedValue: string,
    timeout = 45_000,
  ): Promise<void> {
    await expect(async () => {
      await open();
      await expect(field, 'the form must load populated with the expected value').toHaveValue(expectedValue, { timeout: 10_000 });
    }, `the page must load with "${expectedValue}" populated`).toPass({ timeout });
  }

  /** Navigate until an element shows the expected text. */
  static async openUntilTextVisible(
    open: () => Promise<void>,
    target: Locator,
    expectedText: string,
    timeout = 45_000,
  ): Promise<void> {
    await expect(async () => {
      await open();
      await expect(target, 'the page must load showing the expected text').toHaveText(expectedText, { timeout: 10_000 });
    }, `the page must load showing "${expectedText}"`).toPass({ timeout });
  }
}
