/**
 * Backend assertions for the user profile - the data-persistence half of each settings test.
 *
 * Separate from `setup/`, which snapshots and restores state and must never assert, and from
 * `pages/`, which asserts on what the UI shows.
 */
import { expect } from '@playwright/test';
import { UserSetup } from '../setup/UserSetup';

export class UserAsserts {
  constructor(private readonly users: UserSetup) {}

  async expectStoredBio(bio: string): Promise<void> {
    await expect.poll(() => this.users.getBio()).toBe(bio);
  }

  async expectStoredImage(image: string): Promise<void> {
    await expect.poll(() => this.users.getImage()).toBe(image);
  }

  async expectImageNotStored(image: string): Promise<void> {
    await expect.poll(() => this.users.getImage()).not.toBe(image);
  }

  async expectStoredUsername(username: string): Promise<void> {
    await expect.poll(() => this.users.getUsername()).toBe(username);
  }
}
