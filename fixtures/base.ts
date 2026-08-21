import { mergeTests } from '@playwright/test';
import { test as evidence } from './evidence';
import { test as pages } from './pages';
import { test as setup } from './setup';

export const test = mergeTests(evidence, pages, setup);

export { expect } from '@playwright/test';
