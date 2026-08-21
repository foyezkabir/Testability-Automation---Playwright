import { request, APIRequestContext } from '@playwright/test';
import { ENV } from '../datas/common/EnvironmentData';
import { ACCOUNT } from '../datas/common/AccountData';

const API_BASE_URL = `${ENV.apiBaseUrl.replace(/\/+$/, '')}/`;

async function getAuthToken(): Promise<string> {
  const context = await request.newContext({ baseURL: API_BASE_URL });
  const response = await context.post('users/login', {
    data: { user: { email: ACCOUNT.email, password: ACCOUNT.password } },
  });
  if (!response.ok()) {
    const detail = await response.text();
    await context.dispose();
    throw new Error(`apiClient: login failed (${response.status()}): ${detail}`);
  }

  const body = await response.json();
  await context.dispose();
  return body.user.token;
}

/** An APIRequestContext pre-loaded with the auth header - used for seeding and teardown. */
export async function apiClient(): Promise<APIRequestContext> {
  const token = await getAuthToken();
  return request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
  });
}
