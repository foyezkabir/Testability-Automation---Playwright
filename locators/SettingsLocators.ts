import { Page, Locator } from '@playwright/test';

export class SettingsLocators {
  constructor(page: Page) {
    // .navbar, not getByRole('navigation'): the profile page has two navigation landmarks.
    const nav = page.locator('.navbar');

    this.pageHeading = page.getByRole('heading', { name: 'Your Settings' });
    this.homeNavLink = nav.getByRole('link', { name: 'Home' });
    this.settingsNavLink = nav.getByRole('link', { name: 'Settings' });

    this.imageInput = page.getByRole('textbox', { name: 'URL of profile picture' });
    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.bioInput = page.getByRole('textbox', { name: 'Short bio about you' });
    this.emailInput = page.getByRole('textbox', { name: 'Email' });

    this.updateSettingsButton = page.getByRole('button', { name: 'Update Settings' });
    this.logoutButton = page.getByRole('button', { name: 'Or click here to logout.' });
    // The error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');
  }

  readonly pageHeading: Locator;
  readonly homeNavLink: Locator;
  readonly settingsNavLink: Locator;
  readonly imageInput: Locator;
  readonly usernameInput: Locator;
  readonly bioInput: Locator;
  readonly emailInput: Locator;
  readonly updateSettingsButton: Locator;
  readonly logoutButton: Locator;
  readonly errorMessages: Locator;
}
