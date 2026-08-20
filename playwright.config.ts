import 'dotenv/config';
import * as path from 'path';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // The app under test is a shared public demo instance that intermittently stalls or
  // briefly drops requests - observed hanging for minutes and then recovering, with no
  // change on our side. Retrying locally as well as in CI is what keeps a transient
  // outage from being reported as a product failure (requirement 3.4, resilient tests).
  retries: process.env.CI ? 2 : 1,

  // A slightly wider per-test budget for the same reason: the default 30s is comfortable
  // when the demo app is healthy but too tight when it is briefly degraded. Kept at 60s
  // rather than higher - beyond that a hang should fail fast and be retried, not waited on.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retryStrategy: 'isolated', // PW >=1.62: retries run at the END, one at a time in a
                             // single worker - a retry can't be polluted by a neighbour
                             // still running. Default 'immediate' retries in place.
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    // The reporter resolves a relative outputFile against testDir, which drops the
    // report into tests/ where .gitignore does not match it. Anchor it to the
    // project root so it lands beside package.json and stays ignored.
    ['playwright-smart-reporter', { outputFile: path.join(__dirname, 'smart-report.html') }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    // Phase 1 runs before any session file exists. There is no CLI flag to drop
    // storageState, so it is a config switch: SMOKE_NO_AUTH=1 npx playwright test.
    // Normal runs are unaffected and still load .auth/user.json.
    ...(process.env.SMOKE_NO_AUTH ? {} : { storageState: '.auth/user.json' }),
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Chromium runs everything, including the profile tests.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },

    // WebKit and Firefox skip settings.spec.ts. Conduit gives an account ONE mutable
    // profile, and that file is the only one that writes to it - running it in three
    // browsers at once means three sessions overwriting each other's data and each
    // other's restore. That measures contention over a shared fixture, not browser
    // compatibility. Every other spec is data-isolated and does run on all three.
    { name: 'webkit',  use: { ...devices['Desktop Safari'] },  testIgnore: /settings\.spec\.ts/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /settings\.spec\.ts/ },
  ],
});
