import { request, APIRequestContext } from '@playwright/test';
import 'dotenv/config';


const API_BASE_URL = `${(process.env.API_BASE_URL ?? 'https://conduit-api.bondaracademy.com/api').replace(/\/+$/, '')}/`;

async function getAuthToken(): Promise<string> {
  const context = await request.newContext({ baseURL: API_BASE_URL });
  const response = await context.post('users/login', {
    data: { user: { email: process.env.EMAIL, password: process.env.PASSWORD } },
  });
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
