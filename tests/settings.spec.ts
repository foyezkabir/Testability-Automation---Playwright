import { test } from '../fixtures/base';
import { profileUpdate, SETTINGS_EDGE } from '../datas/settings/SettingsData';
import { ACCOUNT } from '../datas/common/AccountData';

test.describe('Profile settings', () => {
  // Serial: Conduit gives an account ONE mutable profile and every test in this group
  // writes to it, so run in parallel they overwrite each other's data and each other's
  // restore. Only this group is serialised - the rest of the suite stays parallel.
  test.describe.configure({ mode: 'serial' });

  test('TC-01: Verify that user settings are updated and persisted', { tag: ['@smoke', '@critical'] }, async ({ settingsPage, userAsserts, restoredProfile }) => {
    const update = profileUpdate();

    await settingsPage.navigateToSettings();
    await settingsPage.expectSettingsFormIsOpen();
    await settingsPage.expectAllFieldsArePresent();

    await settingsPage.updateProfile(ACCOUNT.username, update);

    await settingsPage.expectRedirectedToProfile();
    await userAsserts.expectStoredBio(update.bio);
    await userAsserts.expectStoredImage(update.image);

    await settingsPage.navigateToSettings();
    await settingsPage.expectSettingsFormIsOpen();
    await userAsserts.expectStoredBio(update.bio);
  });

  test('TC-02: Verify that clearing the username does not change the stored username', { tag: ['@regression'] }, async ({ settingsPage, userAsserts, restoredProfile }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.expectSettingsFormIsOpen();

    await settingsPage.submitWithUsername(SETTINGS_EDGE.emptyUsername);

    await settingsPage.expectNoValidationError();
    await userAsserts.expectStoredUsername(ACCOUNT.username);
  });

  test('TC-04: Verify that a whitespace-only username is rejected with a visible error', { tag: ['@regression', '@known-defect'] }, async ({ settingsPage, restoredProfile }) => {
    test.fixme(true, 'findings/settings.txt FINDING 6 - returns HTTP 500 leaking the DB constraint name, and the UI shows nothing');

    await settingsPage.navigateToSettings();
    await settingsPage.submitWithUsername(SETTINGS_EDGE.whitespaceUsername);

    await settingsPage.expectSingleValidationError();
    await settingsPage.expectStillOnSettings();
  });

  test('TC-05: Verify that an invalid profile picture URL is rejected', { tag: ['@regression', '@known-defect'] }, async ({ settingsPage, userAsserts, restoredProfile }) => {
    test.fixme(true, 'findings/settings.txt FINDING 7 - any string is accepted and used as the avatar source, leaving a broken image');

    await settingsPage.navigateToSettings();
    await settingsPage.submitWithProfileImage(ACCOUNT.username, SETTINGS_EDGE.invalidImageUrl);

    await settingsPage.expectSingleValidationError();
    await userAsserts.expectImageNotStored(SETTINGS_EDGE.invalidImageUrl);
  });

  test('TC-06: Verify that the settings form is repopulated with the stored values on return', { tag: ['@regression', '@known-defect'] }, async ({ settingsPage, restoredProfile }) => {
    test.fixme(true, 'findings/settings.txt FINDING 2 - the form always renders blank, so a user cannot see or safely edit their own data');

    const update = profileUpdate();

    await settingsPage.navigateToSettings();
    await settingsPage.updateProfile(ACCOUNT.username, update);
    await settingsPage.expectRedirectedToProfile();

    await settingsPage.navigateToSettings();

    await settingsPage.expectFormShowsStoredValues(ACCOUNT.username, update);
  });

  test('TC-07: Verify that a long bio is accepted and stored in full', { tag: ['@regression'] }, async ({ settingsPage, userAsserts, restoredProfile }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.submitWithBio(ACCOUNT.username, SETTINGS_EDGE.longBio);

    await settingsPage.expectRedirectedToProfile();
    await userAsserts.expectStoredBio(SETTINGS_EDGE.longBio);
  });

  test('TC-08: Verify that markup in a bio is not executed on the profile page', { tag: ['@critical'] }, async ({ settingsPage, articlePage, restoredProfile }) => {
    articlePage.watchForDialogs();

    await settingsPage.navigateToSettings();
    await settingsPage.submitWithBio(ACCOUNT.username, SETTINGS_EDGE.scriptBio);

    await settingsPage.expectRedirectedToProfile();
    await articlePage.expectNoScriptExecuted();
  });

  test('TC-09: Verify that a whitespace-only bio is accepted', { tag: ['@regression'] }, async ({ settingsPage, userAsserts, restoredProfile }) => {
    await settingsPage.navigateToSettings();
    await settingsPage.submitWithBio(ACCOUNT.username, SETTINGS_EDGE.whitespaceBio);

    await userAsserts.expectStoredBio(SETTINGS_EDGE.whitespaceBio);
  });
});

test.describe('Unauthenticated access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('TC-03: Verify that the settings page is not reachable when logged out', { tag: ['@critical'] }, async ({ settingsPage }) => {
    await settingsPage.navigateToSettings();

    await settingsPage.expectRedirectedToHome();
    await settingsPage.expectSettingsFormNotAvailable();
  });
});
