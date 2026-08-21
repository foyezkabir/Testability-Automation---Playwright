import * as fs from 'fs';
import 'dotenv/config';

/**
 * The suite's account, read lazily so a first run works.
 *
 * dotenv loads .env once at import. On a fresh clone the file is empty at that moment -
 * global-setup writes the credentials afterwards - so process.env stays stale for the rest
 * of that process. Re-reading the file when a value is missing closes that gap, and costs
 * nothing on later runs where dotenv already has it.
 */
function credential(key: string): string {
  const fromEnv = process.env[key];

  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = readEnvFile()[key];

  if (!fromFile) {
    throw new Error(`${key} is not set. Run the tests once to register an account, or fill it in .env.`);
  }

  process.env[key] = fromFile;
  return fromFile;
}

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync('.env')) {
    return {};
  }

  return fs
    .readFileSync('.env', 'utf8')
    .split('\n')
    .reduce<Record<string, string>>((acc, line) => {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());

      if (match && match[2]) {
        acc[match[1]] = match[2];
      }

      return acc;
    }, {});
}

export const ACCOUNT = {
  get username(): string {
    return credential('USERNAME');
  },
  get email(): string {
    return credential('EMAIL');
  },
  get password(): string {
    return credential('PASSWORD');
  },
} as const;
