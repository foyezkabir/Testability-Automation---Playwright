import { faker } from '@faker-js/faker';

export type ProfileUpdate = {
  bio: string;
  image: string;
};

/**
 * Excludes `username` and `email` deliberately: changing the email would invalidate the
 * credentials global-setup logs in with and break every later run.
 */
export const profileUpdate = (overrides: Partial<ProfileUpdate> = {}): ProfileUpdate => ({
  bio: `QA automation bio ${faker.string.alphanumeric(8)} - ${faker.lorem.sentence()}`,
  image: faker.image.avatar(),
  ...overrides,
});

/**
 * No invalid EMAIL here by design: Conduit persists a malformed address with no validation
 * and locks the account out of login (findings/settings.txt FINDING 1). A negative test must
 * never destroy the credentials the suite depends on.
 */
export const SETTINGS_EDGE = {
  emptyUsername: '',
  whitespaceUsername: '   ',
  whitespaceBio: '   ',
  longBio: 'B'.repeat(2000),
  scriptBio: '<script>alert(1)</script>',
  invalidImageUrl: 'not-a-url',
} as const;
