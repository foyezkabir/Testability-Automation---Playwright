import { Page, Locator } from '@playwright/test';

/**
 * Locators for the user settings form.
 *
 * No field here has a <label>, id or aria-label - every accessible name comes from the
 * placeholder, so getByRole('textbox', { name }) works and getByLabel would find nothing.
 */
export class SettingsLocators {
  readonly pageHeading: Locator;

  readonly imageInput: Locator;
  readonly usernameInput: Locator;
  readonly bioInput: Locator;

  /** Present for completeness; deliberately never filled - see findings/settings.txt FINDING 1. */
  readonly emailInput: Locator;

  readonly updateSettingsButton: Locator;
  readonly logoutButton: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page) {
    this.pageHeading = page.getByRole('heading', { name: 'Your Settings' });

    this.imageInput = page.getByRole('textbox', { name: 'URL of profile picture' });
    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.bioInput = page.getByRole('textbox', { name: 'Short bio about you' });
    this.emailInput = page.getByRole('textbox', { name: 'Email' });

    this.updateSettingsButton = page.getByRole('button', { name: 'Update Settings' });

    // The accessible name includes the trailing period.
    this.logoutButton = page.getByRole('button', { name: 'Or click here to logout.' });

    // CSS: the error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');
  }
}
