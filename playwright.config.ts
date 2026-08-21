import * as path from 'path';
import { defineConfig, devices } from '@playwright/test';
import { ENV } from './datas/common/EnvironmentData';

/**
 * Local runs are slow and watchable - one worker, headed Chromium - so a run is easy to
 * follow. CI runs headless, fully parallel, across all three browsers.
 *
 * Override any of it per run without editing this file:
 *   npx playwright test --workers=4         parallel locally
 *   npx playwright test --project=firefox   a different browser
 *   CI=1 npx playwright test                the CI profile
 */
const isCI = !!process.env.CI;

const CHROMIUM = { name: 'chromium', use: { ...devices['Desktop Chrome'] } };

// WebKit and Firefox skip settings.spec.ts: Conduit gives an account ONE mutable profile,
// so running that file in three browsers at once measures contention over a shared fixture
// rather than browser compatibility. Every other spec is data-isolated.
const CROSS_BROWSER = [
  CHROMIUM,
  { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /settings\.spec\.ts/ },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /settings\.spec\.ts/ },
];

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  projects: isCI ? CROSS_BROWSER : [CHROMIUM],

  // Execution
  fullyParallel: isCI,
  workers: isCI ? undefined : 1,
  forbidOnly: isCI,

  // The app under test is a shared public demo that intermittently stalls for minutes and
  // then recovers. Retries and a wider timeout stop a transient outage being reported as a
  // product failure. 'isolated' runs retries at the end, one at a time, so a retry cannot
  // be polluted by a neighbour still running.
  retries: isCI ? 2 : 1,
  retryStrategy: 'isolated',
  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    // Anchored to __dirname: the reporter resolves a relative path against testDir, which
    // would drop the report into tests/ where .gitignore does not match it.
    ['playwright-smart-reporter', { outputFile: path.join(__dirname, 'smart-report.html') }],
    // Machine-readable counts for the CI summary table. Only in CI, so a local run leaves
    // no stray file. The path comes from PLAYWRIGHT_JSON_OUTPUT_NAME, set by the workflow.
    ...(isCI ? [['json'] as [string]] : []),
  ],

  use: {
    baseURL: ENV.baseUrl,
    headless: isCI,

    // SMOKE_NO_AUTH exists because there is no CLI flag to drop storageState, and the very
    // first run has no session file yet.
    ...(process.env.SMOKE_NO_AUTH ? {} : { storageState: '.auth/user.json' }),

    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
