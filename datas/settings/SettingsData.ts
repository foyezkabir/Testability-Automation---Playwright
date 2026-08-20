import { faker } from '@faker-js/faker';

export type ProfileUpdate = {
  bio: string;
  image: string;
};

/**
 * Dynamic profile-update factory (bonus 4.1).
 *
 * Deliberately excludes `username` and `email`: both are identity fields on the
 * ONE shared `.env` account. Changing the email would invalidate the credentials
 * `global-setup.ts` logs in with and break every subsequent run, so the positive
 * test mutates only safely-restorable fields.
 */
export const profileUpdate = (overrides: Partial<ProfileUpdate> = {}): ProfileUpdate => ({
  bio: `QA automation bio ${faker.string.alphanumeric(8)} - ${faker.lorem.sentence()}`,
  image: faker.image.avatar(),
  ...overrides,
});

/** Static values asserted against - captured from the live UI, never assumed. */
export const SETTINGS_EXPECTED = {
  heading: 'Your Settings',
  submitButton: 'Update Settings',
  logoutButton: 'Or click here to logout.',
} as const;

/**
 * Invalid inputs for the negative case.
 *
 * DELIBERATELY NOT an invalid EMAIL. Conduit persists a malformed email with no
 * validation (see findings/settings.txt), which permanently locks the shared
 * `.env` account out of login - a negative test must never destroy the very
 * credentials the whole suite depends on. `username` is the safe field to attack:
 * it is restorable via the API and is not an authentication factor.
 */
export const SETTINGS_EDGE = {
  emptyUsername: '',
  whitespaceUsername: '   ',
  whitespaceBio: '   ',
  longBio: 'B'.repeat(2000),
  scriptBio: '<script>alert(1)</script>',
  invalidImageUrl: 'not-a-url',
} as const;
