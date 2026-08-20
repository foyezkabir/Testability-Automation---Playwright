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
 * Static values asserted against - never faker (a random expectation asserts nothing).
 * Every string here was read from the live UI during the crawl, not assumed.
 */
export const ARTICLE_EXPECTED = {
  editorHeadingPlaceholder: 'Article Title',
  publishButton: 'Publish Article',
  editButton: 'Edit Article',
  deleteButton: 'Delete Article',
  globalFeedTab: 'Global Feed',
  yourFeedTab: 'Your Feed',
  popularTagsHeading: 'Popular Tags',
} as const;

/**
 * Edge / boundary inputs for the negative cases.
 *
 * The title-length values come from a measured boundary, not a guess: a binary search
 * against the live API found 185 characters accepted and 186 rejected with an HTTP 500
 * (the derived slug overflows its DB column). See findings/articles-edge-cases.txt.
 */
export const ARTICLE_EDGE = {
  whitespaceOnly: '   ',
  maxAcceptedTitle: 'T'.repeat(185),
  overLimitTitle: 'T'.repeat(186),
  longTitle: 'T'.repeat(300),
  singleCharTitle: 'X',
  scriptTitle: '<script>alert(1)</script>',
  sqlishTitle: "Rob'); DROP TABLE articles;--",
  unicodeTitle: 'テスト 🚀 unicode',
  duplicateTags: ['dup', 'dup'],
  manyTags: Array.from({ length: 50 }, (_, i) => `bulk${i}`),
  nonExistentTag: 'zzz-no-such-tag-zzz-99999',
  nonExistentSlug: 'this-article-does-not-exist-99999',
} as const;

/** An article whose every text field is whitespace - the input behind FINDING 8. */
export const whitespaceArticle = (): NewArticle => ({
  title: ARTICLE_EDGE.whitespaceOnly,
  description: ARTICLE_EDGE.whitespaceOnly,
  body: ARTICLE_EDGE.whitespaceOnly,
  tagList: [],
});
