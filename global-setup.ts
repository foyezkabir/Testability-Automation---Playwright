import { chromium, FullConfig, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import 'dotenv/config';

/**
 * Session management (requirement 3.2): authenticate ONCE here, save the session to
 * `.auth/user.json`, and let every test start already logged in via `storageState` in
 * playwright.config.ts. No test ever logs in.
 *
 * Zero-setup on a fresh clone: if `.env` has no credentials, this registers a throwaway
 * account first and writes it to `.env`. So `npm ci && npm test` works immediately, with
 * no credentials to request and no setup command to remember. When credentials ARE present
 * (your machine, or CI reading repository secrets) it just logs in with them and never
 * registers anything.
 *
 * The token is obtained from the API rather than by driving the login form: login is not
 * one of the scenarios under test, and routing every run through the login UI would make
 * all 30 tests fail whenever that one form broke. The signup FLOW is covered as a real
 * test in tests/auth.spec.ts.
 *
 * Conduit keeps its JWT in localStorage (not a cookie - verified against the live app), so
 * the session is planted with addInitScript plus a real page load: storageState serialises
 * localStorage under `origins`, which is what makes it reusable across workers.
 */

const DEFAULT_UI = 'https://conduit.bondaracademy.com';
const DEFAULT_API = 'https://conduit-api.bondaracademy.com/api';
const ENV_PATH = '.env';

type Credentials = { username: string; email: string; password: string };

/**
 * Build a throwaway account. The password is DERIVED from the same random suffix rather
 * than being a fixed literal, so no credential is written into source and each generated
 * account gets its own. It is persisted to .env (gitignored) for reuse on later runs.
 */
function buildCredentials(): Credentials {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    username: `qa${suffix}`,
    email: `qa${suffix}@mailinator.com`,
    password: `Qa!${suffix.toUpperCase()}${suffix.length}`,
  };
}

/** Replace a key's value in .env text, appending the key when it is not present. */
function setEnvValue(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
}

/** Persist the generated account so later runs reuse it instead of registering again. */
function persistCredentials(credentials: Credentials, baseURL: string, apiBaseURL: string): void {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  let contents = setEnvValue(existing, 'BASE_URL', baseURL);
  contents = setEnvValue(contents, 'API_BASE_URL', apiBaseURL);
  contents = setEnvValue(contents, 'EMAIL', credentials.email);
  contents = setEnvValue(contents, 'PASSWORD', credentials.password);
  contents = setEnvValue(contents, 'USERNAME', credentials.username);
  fs.writeFileSync(ENV_PATH, contents);
}

async function registerAccount(api: APIRequestContext, baseURL: string, apiBaseURL: string): Promise<Credentials> {
  const credentials = buildCredentials();
  const response = await api.post('users', { data: { user: credentials }, maxRetries: 3 });

  if (!response.ok()) {
    throw new Error(
      `global-setup: could not register a test account (${response.status()}): ${await response.text()}`,
    );
  }

  persistCredentials(credentials, baseURL, apiBaseURL);
  process.env.EMAIL = credentials.email;
  process.env.PASSWORD = credentials.password;
  process.env.USERNAME = credentials.username;

  console.log(`global-setup: no credentials found, registered a test account (${credentials.email}) and saved it to .env`);
  return credentials;
}

async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BASE_URL || DEFAULT_UI;
  const apiBaseURL = process.env.API_BASE_URL || DEFAULT_API;

  // Trailing slash matters: a base of `…/api` plus a leading-slash path resolves to the
  // host root and silently drops the `/api` segment.
  const api = await request.newContext({ baseURL: `${apiBaseURL.replace(/\/+$/, '')}/` });

  const hasCredentials = Boolean(process.env.EMAIL && process.env.PASSWORD);
  const credentials = hasCredentials
    ? { email: process.env.EMAIL!, password: process.env.PASSWORD! }
    : await registerAccount(api, baseURL, apiBaseURL);

  const response = await api.post('users/login', {
    data: { user: { email: credentials.email, password: credentials.password } },
    maxRetries: 3,
  });

  if (!response.ok()) {
    await api.dispose();
    throw new Error(
      [
        `global-setup: login failed (${response.status()}): ${await response.text()}`,
        '',
        'The credentials in .env did not work. To start over with a fresh account,',
        'clear EMAIL and PASSWORD in .env and run the tests again - one will be',
        'registered automatically.',
      ].join('\n'),
    );
  }

  const { user } = await response.json();
  await api.dispose();

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  await context.addInitScript((token: string) => {
    window.localStorage.setItem('jwtToken', token);
  }, user.token);

  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  fs.mkdirSync('.auth', { recursive: true });
  await context.storageState({ path: '.auth/user.json' });
  await browser.close();
}

export default globalSetup;
