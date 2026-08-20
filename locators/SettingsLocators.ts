/**
 * Settings Locators for the Conduit web application.
 * Covers the user profile settings form and logout.
 *
 * No field on this surface has a <label>, id, or aria-label - accessible names come
 * ONLY from placeholders, so getByRole('textbox', { name: <placeholder> }) is the
 * correct strategy and getByLabel would find nothing.
 */
import { Page, Locator } from '@playwright/test';

export class SettingsLocators {
  // ===== PAGE ELEMENTS =====
  readonly pageHeading: Locator;

  // ===== PROFILE FORM FIELDS =====
  readonly imageInput: Locator;
  readonly usernameInput: Locator;
  readonly bioInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;

  // ===== ACTION BUTTONS =====
  readonly updateSettingsButton: Locator;
  readonly logoutButton: Locator;

  // ===== VALIDATION ERROR MESSAGES =====
  readonly errorMessages: Locator;

  constructor(page: Page) {
    // ===== PAGE ELEMENTS =====
    this.pageHeading = page.getByRole('heading', { name: 'Your Settings' });

    // ===== PROFILE FORM FIELDS =====
    this.imageInput = page.getByRole('textbox', { name: 'URL of profile picture' });
    this.usernameInput = page.getByRole('textbox', { name: 'Username' });
    this.bioInput = page.getByRole('textbox', { name: 'Short bio about you' });
    this.emailInput = page.getByRole('textbox', { name: 'Email' });
    this.passwordInput = page.getByRole('textbox', { name: 'New Password' });

    // ===== ACTION BUTTONS =====
    this.updateSettingsButton = page.getByRole('button', { name: 'Update Settings' });
    this.logoutButton = page.getByRole('button', { name: 'Or click here to logout.' });

    // ===== VALIDATION ERROR MESSAGES =====
    // CSS: the error list has no role=alert and no aria-live, so it has no semantic handle.
    this.errorMessages = page.locator('ul.error-messages li');
  }
}
