import { mergeTests } from '@playwright/test';
import { test as evidence } from './evidence';
import { test as pages } from './pages';
import { test as setup } from './setup';

/**
 * The ONLY fixture file specs import.
 *
 * - `evidence` is an auto fixture: it captures a screenshot, toast log and log line
 *   on any FAILED test, and does nothing on a green run.
 * - `pages` provides the page objects by dependency injection.
 * - `setup` provides API seeding and teardown.
 */
export const test = mergeTests(evidence, pages, setup);

export { expect } from '@playwright/test';
