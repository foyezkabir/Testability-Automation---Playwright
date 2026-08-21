import { faker } from '@faker-js/faker';

export type NewArticle = {
  title: string;
  description: string;
  body: string;
  tagList: string[];
};

/**
 * Dynamic article factory (bonus 4.1 - no hard-coded inputs).
 *
 * The title carries a random suffix because Conduit derives an article's slug
 * from its title: two articles with the same title collide on the same slug,
 * which would make parallel workers fight over one record. Randomising the
 * title is what makes the suite parallel-safe.
 */
export const newArticle = (overrides: Partial<NewArticle> = {}): NewArticle => ({
  title: `${faker.word.adjective()} ${faker.word.noun()} ${faker.string.alphanumeric(6)}`,
  description: faker.lorem.sentence(),
  body: faker.lorem.paragraphs(2),
  tagList: [faker.word.noun().toLowerCase()],
  ...overrides,
});

/** A unique tag, for asserting a filter returns exactly our own seeded articles. */
export const uniqueTag = (): string => `qa${faker.string.alphanumeric(8).toLowerCase()}`;

/**
 * A unique suffix for tests that build a title around a fixed payload. Random rather than a
 * timestamp: Date.now() repeats inside the same millisecond, and the slug derives from the
 * title, so two runs could collide on one record.
 */
export const uniqueSuffix = (): string => faker.string.alphanumeric(8).toLowerCase();

/**
 * Boundary inputs, measured not guessed: a binary search found 186 characters rejected with
 * an HTTP 500 as the derived slug overflows its DB column (findings/articles.txt FINDING 9).
 */
export const ARTICLE_EDGE = {
  whitespaceOnly: '   ',
  // 170 not 185: the slug is `<title>-<userId>`, so the safe length depends on the id's
  // digit count. 170 clears the limit for any account.
  maxAcceptedTitle: 'T'.repeat(170),
  overLimitTitle: 'T'.repeat(186),
  singleCharTitle: 'X',
  scriptTitle: '<script>alert(1)</script>',
  sqlishTitle: "Rob'); DROP TABLE articles;--",
  unicodeTitle: 'テスト 🚀 unicode',
  duplicateTags: ['dup', 'dup'],
  manyTags: Array.from({ length: 6 }, (_, i) => `bulk${i}`),
  nonExistentTag: 'zzz-no-such-tag-zzz-99999',
} as const;

/** An article whose every text field is whitespace - the input behind FINDING 8. */
export const whitespaceArticle = (): NewArticle => ({
  title: ARTICLE_EDGE.whitespaceOnly,
  description: ARTICLE_EDGE.whitespaceOnly,
  body: ARTICLE_EDGE.whitespaceOnly,
  tagList: [],
});
