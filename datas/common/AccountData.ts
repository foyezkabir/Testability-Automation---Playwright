import 'dotenv/config';

/** The single suite account, from .env (or CI secrets). Specs never read process.env. */
export const ACCOUNT = {
  get username(): string {
    return requireEnv('USERNAME');
  },
  get email(): string {
    return requireEnv('EMAIL');
  },
  get password(): string {
    return requireEnv('PASSWORD');
  },
} as const;

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set - add it to .env (locally) or to the CI secrets.`);
  }

  return value;
}
