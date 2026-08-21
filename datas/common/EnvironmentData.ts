import 'dotenv/config';

/**
 * The environment under test, resolved in ONE place so every entry point agrees.
 *
 * `||` not `??` is deliberate: a key present-but-empty in .env (which is how .env.example
 * ships, and how it looks before global-setup fills it in) yields '' rather than undefined,
 * and `??` would keep the empty string. That produced "Invalid URL" failures in every test
 * while global-setup itself worked fine.
 */
export const ENV = {
  baseUrl: process.env.BASE_URL || 'https://conduit.bondaracademy.com',

  /** The API is a SEPARATE host - not baseUrl + /api. */
  apiBaseUrl: process.env.API_BASE_URL || 'https://conduit-api.bondaracademy.com/api',
} as const;
