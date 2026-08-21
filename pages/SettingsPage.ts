/**
 * Settings Page for the Conduit web application.
 * Actions, state readers, and named expect* assertion methods.
 *
 * This form does NOT prefill: every field renders empty even though the app has the data,
 * so any method that saves must type every value it intends to keep.
 */
import { Page, expect } from '@playwright/test';
import { SettingsLocators } from '../locators/SettingsLocators';
import { ProfileUpdate } from '../datas/settings/SettingsData';

export class SettingsPage {
  readonly locators: SettingsLocators;

  constructor(private readonly page: Page) {
    this.locators = new SettingsLocators(page);
  }

  // ===== NAVIGATION =====

  async navigateToSettings(): Promise<void> {
    await this.page.goto('/settings');
  }

  // ===== FILL FIELDS =====

  async fillUsername(username: string): Promise<void> {
    await this.locators.usernameInput.fill(username);
  }

  async fillBio(bio: string): Promise<void> {
    await this.locators.bioInput.fill(bio);
  }

  async fillProfileImage(url: string): Promise<void> {
    await this.locators.imageInput.fill(url);
  }

  // ===== ACTIONS =====

  async clickUpdateSettingsButton(): Promise<void> {
    await this.locators.updateSettingsButton.click();
  }

  async updateProfile(username: string, update: ProfileUpdate): Promise<void> {
    await this.fillUsername(username);
    await this.fillProfileImage(update.image);
    await this.fillBio(update.bio);
    await this.clickUpdateSettingsButton();
  }

  async submitWithUsername(username: string): Promise<void> {
    await this.fillUsername(username);
    await this.clickUpdateSettingsButton();
  }

  async submitWithBio(username: string, bio: string): Promise<void> {
    await this.fillUsername(username);
    await this.fillBio(bio);
    await this.clickUpdateSettingsButton();
  }

  async submitWithProfileImage(username: string, url: string): Promise<void> {
    await this.fillUsername(username);
    await this.fillProfileImage(url);
    await this.clickUpdateSettingsButton();
  }

  // ===== STATE READERS =====

  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  // ===== ASSERTIONS =====

  async expectSettingsFormIsOpen(): Promise<void> {
    await expect(this.locators.pageHeading).toBeVisible();
  }

  async expectAllFieldsArePresent(): Promise<void> {
    await expect(this.locators.usernameInput).toBeVisible();
    await expect(this.locators.bioInput).toBeVisible();
    await expect(this.locators.imageInput).toBeVisible();
  }

  async expectSettingsFormNotAvailable(): Promise<void> {
    await expect(this.locators.pageHeading).toHaveCount(0);
    await expect(this.locators.updateSettingsButton).toHaveCount(0);
  }

  async expectRedirectedToProfile(): Promise<void> {
    await expect.poll(() => this.currentPath()).toContain('/profile/');
  }

  async expectRedirectedToHome(): Promise<void> {
    await expect.poll(() => this.currentPath()).toBe('/');
  }

  async expectStillOnSettings(): Promise<void> {
    await expect.poll(() => this.currentPath()).toBe('/settings');
  }

  async expectNoValidationError(): Promise<void> {
    await expect(this.locators.errorMessages).toHaveCount(0);
  }

  async expectSingleValidationError(): Promise<void> {
    await expect(this.locators.errorMessages).toHaveCount(1);
  }

  async expectFormShowsStoredValues(username: string, update: ProfileUpdate): Promise<void> {
    await expect(this.locators.usernameInput).toHaveValue(username);
    await expect(this.locators.bioInput).toHaveValue(update.bio);
    await expect(this.locators.imageInput).toHaveValue(update.image);
  }
}
