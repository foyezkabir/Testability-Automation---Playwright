import path from 'path';
import { defineConfig, devices, ReporterDescription } from '@playwright/test';

import { ENV } from './datas/common/EnvironmentData';

const isCI = Boolean(process.env.CI);

// ─────────────────────────────────────────────
// Browser Projects
// ─────────────────────────────────────────────

const chromium = {
  name: 'chromium',
  use: { ...devices['Desktop Chrome'] },
};

// firefox and webkit skip settings.spec.ts: Conduit gives an account ONE mutable profile,
// so running that file in three browsers at once measures contention over a shared fixture
// rather than browser compatibility.
const firefox = {
  name: 'firefox',
  use: { ...devices['Desktop Firefox'] },
  testIgnore: /settings\.spec\.ts/,
};

const webkit = {
  name: 'webkit',
  use: { ...devices['Desktop Safari'] },
  testIgnore: /settings\.spec\.ts/,
};

const projects = isCI
  ? [chromium, firefox, webkit]
  : [chromium];

// ─────────────────────────────────────────────
// Reporters
// ─────────────────────────────────────────────

const reporter: ReporterDescription[] = [
  ['list', {}],
  [
    'playwright-smart-reporter',
    {
      // Anchored to __dirname: a relative path resolves against testDir, which would drop
      // the report into tests/ where .gitignore does not match it.
      outputFile: path.join(__dirname, 'smart-report.html'),
    },
  ],
  // Machine-readable counts for the CI summary table. The path comes from
  // PLAYWRIGHT_JSON_OUTPUT_NAME, which the workflow sets.
  ...(isCI ? [['json', {}] as ReporterDescription] : []),
];

// ─────────────────────────────────────────────
// Playwright Configuration
// ─────────────────────────────────────────────

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),

  // Execution
  projects,
  fullyParallel: isCI,
  workers: isCI ? undefined : 1,
  forbidOnly: isCI,

  // The app under test is a shared public demo that intermittently stalls for minutes and
  // then recovers, so retries run locally too. 'isolated' runs them at the end, one at a
  // time, so a retry cannot be polluted by a neighbour still running.
  retries: isCI ? 2 : 1,
  retryStrategy: 'isolated',

  // Timeouts
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },

  // Reports
  reporter,

  // Test environment
  use: {
    baseURL: ENV.baseUrl,
    headless: isCI,

    // Local runs are slowed down so a headed run can be followed by eye. CI is headless with
    // nobody watching, so it runs at full speed.
    launchOptions: { slowMo: isCI ? 0 : 500 },

    // No CLI flag can drop storageState, and the very first run has no session file yet.
    ...(process.env.SMOKE_NO_AUTH
      ? {}
      : { storageState: '.auth/user.json' }),

    // Failure artifacts
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
