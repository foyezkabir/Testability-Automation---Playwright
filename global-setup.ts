import { chromium, FullConfig, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import { ENV } from './datas/common/EnvironmentData';

/**
 * Authenticate ONCE, save the session to `.auth/user.json`, and let every test start logged
 * in via `storageState`. No test performs a login.
 *
 * If `.env` has no credentials this registers a throwaway account and writes it there, so a
 * fresh clone runs with nothing to configure. Workers are separate processes that re-read
 * `.env`, which is why the credentials must be written to the file rather than just set in
 * this process.
 *
 * The token comes from the API rather than the login form: login is not one of the scenarios
 * under test, and routing every run through that form would make the whole suite fail
 * whenever it broke.
 *
 * Conduit keeps its JWT in localStorage, not a cookie, so the session is planted with
 * addInitScript plus a real page load - storageState only serialises localStorage under
 * `origins` once the origin has been visited.
 */

const ENV_PATH = '.env';

type Credentials = { email: string; password: string };

function setEnvValue(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
}

/** Register a throwaway account and persist it to .env. Password derives from the same
 *  random suffix as the username, so no credential is written into source. */
async function registerAccount(api: APIRequestContext, baseURL: string, apiBaseURL: string): Promise<Credentials> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const user = {
    username: `qa${suffix}`,
    email: `qa${suffix}@mailinator.com`,
    password: `Qa!${suffix.toUpperCase()}${suffix.length}`,
  };

  const response = await api.post('users', { data: { user }, maxRetries: 3 });

  if (!response.ok()) {
    throw new Error(`global-setup: could not register a test account (${response.status()}): ${await response.text()}`);
  }

  let contents = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  contents = setEnvValue(contents, 'BASE_URL', baseURL);
  contents = setEnvValue(contents, 'API_BASE_URL', apiBaseURL);
  contents = setEnvValue(contents, 'EMAIL', user.email);
  contents = setEnvValue(contents, 'PASSWORD', user.password);
  contents = setEnvValue(contents, 'USERNAME', user.username);
  fs.writeFileSync(ENV_PATH, contents);

  console.log(`global-setup: no credentials found, registered a test account (${user.email}) and saved it to .env`);
  return { email: user.email, password: user.password };
}

async function globalSetup(_config: FullConfig) {
  const { baseUrl: baseURL, apiBaseUrl: apiBaseURL } = ENV;

  // Trailing slash matters: `…/api` plus a leading-slash path drops the `/api` segment.
  const api = await request.newContext({ baseURL: `${apiBaseURL.replace(/\/+$/, '')}/` });

  const credentials: Credentials = process.env.EMAIL && process.env.PASSWORD
    ? { email: process.env.EMAIL, password: process.env.PASSWORD }
    : await registerAccount(api, baseURL, apiBaseURL);

  const response = await api.post('users/login', {
    data: { user: credentials },
    maxRetries: 3,
  });

  if (!response.ok()) {
    await api.dispose();
    throw new Error(
      [
        `global-setup: login failed (${response.status()}): ${await response.text()}`,
        '',
        'The credentials in .env did not work. To start over with a fresh account, clear',
        'EMAIL and PASSWORD in .env and run the tests again - one will be registered.',
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
