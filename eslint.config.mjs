/**
 * ESLint flat config enforcing the CLAUDE.md "zero tolerance" rules on the AST.
 *
 * Layout mirrors the 4-tier architecture: each block scopes its rules to the
 * tier they police, so helpers/ keeps the control flow specs are forbidden.
 *
 * Rule ids are kept identical to the regex guard's ids so both report the same
 * vocabulary (spec/no-branching, locator/css-needs-comment, ...).
 */

import tseslint from 'typescript-eslint';
import qa from './qa-rules.mjs';

/* Reusable restricted-syntax entries -------------------------------------- */

const NO_CONTROL_FLOW = [
  {
    selector: 'IfStatement',
    message:
      'spec/no-branching: no if/else in a spec. Specs must be linear - move the decision into helpers/ConditionalHelper.ts, or split into two deterministic tests.',
  },
  {
    selector: 'ConditionalExpression',
    message:
      'spec/no-ternary: no ternary (? :) in a spec - branching by another name. Pick the deterministic value or use helpers/ConditionalHelper.ts.',
  },
  {
    selector: 'SwitchStatement',
    message: 'spec/no-branching: no switch in a spec. Move it to helpers/ConditionalHelper.ts.',
  },
  {
    selector: 'ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement',
    message:
      'spec/no-loops: no loops in a spec. Repeating an action → helpers/LoopHelper.ts. Waiting → a web-first assertion (expect(locator).toBeVisible()), never a loop.',
  },
  {
    selector: 'TryStatement',
    message:
      'spec/no-try-catch: no try/catch/finally in a spec - it swallows failures. Move error handling into helpers/ErrorHelper.ts.',
  },
  {
    selector: 'LogicalExpression[operator="&&"] > CallExpression',
    message:
      'spec/no-branching: short-circuit (&&) used as a conditional action. Make the step unconditional or move it to helpers/ConditionalHelper.ts.',
  },
];

const NO_SLEEP = {
  selector: 'CallExpression > MemberExpression[property.name="waitForTimeout"]',
  message:
    'wait/no-sleep: waitForTimeout is a fixed sleep. Wait declaratively - DOM/locator → expect(locator).toBeVisible()/.toHaveText(); off-page value → expect.poll(fn); several conditions → expect(async () => {...}).toPass({ timeout }).',
};

const NO_POLL_ON_LOCATOR = {
  // expect.poll(() => page.getByRole(...)) - web-first assertions already poll
  selector:
    'CallExpression[callee.object.name="expect"][callee.property.name="poll"] CallExpression > MemberExpression[property.name=/^(getBy\\w+|locator)$/]',
  message:
    'wait/no-poll-wrapping-locator: expect.poll wrapping a locator. Web-first assertions auto-poll - use expect(locator).toBeVisible() directly. Reserve expect.poll for off-page values (API/DB status, storage, cookie, URL).',
};

const NO_ASSERTIONS = [
  {
    selector: 'CallExpression[callee.name="expect"]',
    message:
      'assertions belong in specs, not here. Expose a state getter and assert on it in the spec.',
  },
  {
    selector: 'CallExpression[callee.object.name="expect"]',
    message:
      'assertions belong in specs, not here. Expose a state getter and assert on it in the spec.',
  },
];

const HARDCODED_CREDS = {
  selector:
    'Property[key.name=/^(password|passwd|secret|apiKey|api_key|token|authToken)$/] > Literal[value=/.{3,}/], VariableDeclarator[id.name=/^(password|passwd|secret|apiKey|api_key|token|authToken)$/] > Literal[value=/.{3,}/]',
  message:
    'auth/no-hardcoded-creds: credentials live in .env (gitignored) and are read via process.env. Add the key to .env.example without its value.',
};

/* ------------------------------------------------------------------------ */

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'playwright-report/**', 'test-results/**'] },

  // Parse TS everywhere. No type-aware linting: it needs a full program and
  // would make the pre-write hook far too slow.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { qa },
    rules: {
      'no-restricted-syntax': ['error', NO_SLEEP, NO_POLL_ON_LOCATOR, HARDCODED_CREDS],
      'qa/xpath-needs-comment': 'error',
      'qa/css-needs-comment': 'error',
      'qa/positional-needs-comment': 'error',
      'qa/prefer-content-frame': 'error',
      // Runtime: the code-level causes of a slow suite, wherever they appear.
      'qa/no-slow-patterns': ['error', { maxTimeout: 60000 }],
    },
  },

  /* ---- tests/*.spec.ts : linear and deterministic ---- */
  {
    files: ['tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_CONTROL_FLOW,
        NO_SLEEP,
        NO_POLL_ON_LOCATOR,
        HARDCODED_CREDS,
        {
          selector: 'NewExpression[callee.name=/(Page|Locators)$/]',
          message:
            'spec/no-direct-instantiation: specs receive page objects by DI. Import fixtures/base.ts only and request the fixture in the test callback args.',
        },
        {
          selector:
            'CallExpression[callee.object.name="test"][callee.property.name=/^(beforeEach|afterEach|beforeAll|afterAll)$/]',
          message:
            'spec/no-hooks-block: spec top = imports only. Setup/teardown belong in a fixture (fixtures/base.ts), which also tears down on failure.',
        },
        {
          selector: 'MemberExpression[object.name="faker"]',
          message:
            'spec/no-inline-faker: data generation belongs in a factory under datas/<module>/<Module>Data.ts. Specs consume values, never build them.',
        },
        {
          selector: 'ImportDeclaration[source.value=/(^|\\/)(pages|locators)\\//]',
          message:
            'spec/import-base-only: specs import fixtures/base.ts ONLY. Page objects arrive as fixtures.',
        },
        {
          selector:
            'CallExpression[callee.name=/^(login|signIn|logIn)$/], CallExpression[callee.property.name=/^(login|signIn|logIn)$/]',
          message:
            'auth/no-direct-login: authentication comes from storageState (.auth/<role>.json) produced by global-setup.ts. Select a role with test.use() at file/describe scope.',
        },
      ],
      'qa/test-name-format': 'error',
      'qa/no-test-use-inside-test': 'error',
      // Quality: structural shape a reviewer would flag on sight.
      'qa/assertion-needs-intent': 'error',
      // Threshold raised from 6: specs now call named expect* methods on the page object,
      // so each line is one intent rather than one raw phase. Counting those as "phases"
      // flagged plain linear tests that read as a list of one-line assertions - which is
      // the shape this project wants - so the count no longer maps to reader confusion.
      'qa/multi-phase-needs-steps': ['error', { threshold: 14 }],
      'qa/no-duplicate-selector': 'error',
    },
  },

  /* ---- pages/ : interactions + named expect* assertion methods ---- */
  {
    files: ['pages/**/*.ts'],
    rules: {
      // Assertions ARE allowed here, deliberately. Page objects expose named expect*
      // methods (expectArticlePublished, expectEditorIsOpen, ...) so a spec reads as
      // one-line intent instead of raw expect() plus a message string. The method name
      // IS the intent, which is why `qa/assertion-needs-intent` is not applied to this
      // directory - see the project README.
      'no-restricted-syntax': ['error', NO_SLEEP],
    },
  },

  /* ---- locators/ : selectors only, no logic ---- */
  {
    files: ['locators/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // ConditionalExpression included: `wide ? a : b` is branching too.
          selector:
            'IfStatement, ConditionalExpression, SwitchStatement, ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, TryStatement',
          message: 'locators/no-logic: locator files hold selectors only - no branching, no loops.',
        },
      ],
    },
  },

  /* ---- fixtures/ : build the world, never assert ---- */
  {
    files: ['fixtures/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_ASSERTIONS.map((r) => ({
          ...r,
          message: `fixture/no-assertions: fixtures build state and tear it down; they never assert. Move the check into the spec.`,
        })),
      ],
    },
  },

  /* ---- setup/ : seed + teardown only ---- */
  {
    files: ['setup/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_ASSERTIONS.map((r) => ({
          ...r,
          message: `setup/no-api-assertions: setup seeds and tears down state only - never asserts on an API response. Behaviour is verified through the UI in a spec.`,
        })),
      ],
    },
  },

  /* ---- helpers/ : control flow is the POINT here ---- */
  {
    files: ['helpers/**/*.ts'],
    rules: {
      // Only the sleep ban survives; loops/conditionals/try are why helpers exist.
      'no-restricted-syntax': ['error', NO_SLEEP],
    },
  },
);
