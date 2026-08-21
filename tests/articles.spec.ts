import { test, expect } from '../fixtures/base';
import { newArticle, uniqueTag, ARTICLE_EDGE } from '../datas/articles/ArticleData';
import { ACCOUNT } from '../datas/common/AccountData';

test('TC-01: Verify that a new article is created and published', { tag: ['@smoke', '@critical'] }, async ({ articlePage, articleAsserts, cleanupArticle }) => {
  const article = newArticle();
  cleanupArticle(article.title);

  await articlePage.navigateToHome();
  await articlePage.clickNewArticleNavLink();
  await articlePage.expectEditorIsOpen();

  await articlePage.createArticle(article);

  await articlePage.expectRedirectedToArticle();
  await articlePage.expectArticleTitle(article.title);
  await articlePage.expectArticleBodyContains(article.body);
  await articlePage.expectArticleTagShown(article.tagList[0]);
  await articlePage.expectOwnerControlsVisible();

  await articlePage.reloadPage();
  await articlePage.expectArticleTitle(article.title);

  await articleAsserts.expectArticleExists(articlePage.currentSlug());
});

test('TC-02: Verify that publishing an article with no fields filled is rejected', { tag: ['@regression'] }, async ({ articlePage }) => {
  await articlePage.navigateToEditor();
  await articlePage.expectPublishButtonIsReady();

  await articlePage.clickPublishButton();

  await articlePage.expectSingleValidationError();
  await articlePage.expectTitleBlankError();
  await articlePage.expectStillOnEditor();
});

test('TC-03: Verify that an existing article can be edited', { tag: ['@critical'] }, async ({ articlePage, seededArticle, cleanupArticle }) => {
  const updated = newArticle();
  cleanupArticle(updated.title);

  await articlePage.openArticleInEditor(seededArticle.slug, seededArticle.title);

  await articlePage.editArticle(updated.title, updated.body);

  await articlePage.expectRedirectedToArticle();
  await articlePage.expectArticleTitle(updated.title);
  await articlePage.expectArticleTitleIsNot(seededArticle.title);
  await articlePage.expectArticleBodyContains(updated.body);
});

test('TC-04: Verify that clearing the title does not overwrite a saved article', { tag: ['@regression'] }, async ({ articlePage, articleAsserts, seededArticle }) => {
  await articlePage.openArticleInEditor(seededArticle.slug, seededArticle.title);

  await articlePage.clearTitle();
  await articlePage.clickPublishButton();

  await articlePage.expectNoValidationError();
  await articleAsserts.expectStoredTitle(seededArticle.slug, seededArticle.title);
});

test('TC-05: Verify that an article can be deleted by its author', { tag: ['@critical'] }, async ({ articlePage, articleAsserts, seededArticle }) => {
  await articlePage.openArticleDetail(seededArticle.slug, seededArticle.title);

  await articlePage.clickDeleteArticleButton();

  await articlePage.expectRedirectedToFeed();
  await articlePage.expectArticleNotInFeed(seededArticle.title);

  await articleAsserts.expectArticleDeleted(seededArticle.slug);
});

test('TC-06: Verify that owner controls are hidden on an article the user does not own', { tag: ['@regression'] }, async ({ articlePage, articles, articleAsserts }) => {
  await articleAsserts.expectAnotherAuthorsArticleExists(ACCOUNT.username);

  const foreign = await articles.findArticleByAnotherAuthor(ACCOUNT.username);
  await articlePage.openArticleDetail(foreign!.slug, foreign!.title);

  await articlePage.expectOwnerControlsHidden();
});

test('TC-07: Verify that the feed can be filtered by tag', { tag: ['@smoke'] }, async ({ articlePage, articles, articleAsserts }) => {
  const [tag] = await articles.listTags();
  await articleAsserts.expectTagHasArticles(tag);

  const expected = await articles.listByTag(tag);

  await articlePage.navigateToHome();
  await articlePage.expectTagOfferedInSidebar(tag);

  await articlePage.filterByTag(tag);

  await articlePage.expectTagTabIsActive(tag);
  await articlePage.expectFeedArticleCount(expected.count);
  await articlePage.expectArticleListedInFeed(expected.articles[0].title);
  await articlePage.expectArticleCardCarriesTag(expected.articles[0].title, tag);
});

test('TC-08: Verify that filtering by a tag with no articles returns no results', { tag: ['@regression'] }, async ({ articlePage, articleAsserts }) => {
  await articleAsserts.expectTagHasNoArticles(ARTICLE_EDGE.nonExistentTag);

  await articlePage.navigateToHome();
  await articlePage.expectTagNotOfferedInSidebar(ARTICLE_EDGE.nonExistentTag);
});

test('TC-09: Verify that a tag can be removed while composing an article', { tag: ['@regression'] }, async ({ articlePage }) => {
  const keptTag = uniqueTag();
  const removedTag = uniqueTag();

  await articlePage.navigateToEditor();
  await articlePage.addTags([removedTag, keptTag]);
  await articlePage.expectTagPillCount(2);

  await articlePage.removeTag(removedTag);

  await articlePage.expectTagPillRemoved(removedTag);
  await articlePage.expectTagPillShown(keptTag);
});

test('TC-10: Verify that a whitespace-only article is rejected', { tag: ['@regression', '@known-defect'] }, async ({ articlePage }) => {
  test.fixme(true, 'findings/articles.txt FINDING 8 - accepted with 201; the slug collapses to "-64987" and the article has no title');

  await articlePage.navigateToEditor();
  await articlePage.createArticle(newArticle({
    title: ARTICLE_EDGE.whitespaceOnly,
    description: ARTICLE_EDGE.whitespaceOnly,
    body: ARTICLE_EDGE.whitespaceOnly,
    tagList: [],
  }));

  await articlePage.expectTitleBlankError();
  await articlePage.expectStillOnEditor();
});

test('TC-11: Verify that a whitespace-only description and body are rejected', { tag: ['@regression', '@known-defect'] }, async ({ articlePage, cleanupArticle }) => {
  test.fixme(true, 'findings/articles.txt FINDING 10 - whitespace-only description and body are accepted as valid content');

  const article = newArticle({ description: ARTICLE_EDGE.whitespaceOnly, body: ARTICLE_EDGE.whitespaceOnly });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.createArticle(article);

  await articlePage.expectSingleValidationError();
});

test('TC-12: Verify that an over-long article title is rejected without a server error', { tag: ['@regression', '@known-defect'] }, async ({ articlePage }) => {
  test.fixme(true, 'findings/articles.txt FINDING 9 - a 186-char title returns HTTP 500 and leaks the DB column name instead of a 422');

  await articlePage.navigateToEditor();
  await articlePage.createArticle(newArticle({ title: ARTICLE_EDGE.overLimitTitle }));

  await articlePage.expectSingleValidationError();
  await articlePage.expectNoDatabaseDetailsLeaked();
});

test('TC-13: Verify that a title at the maximum accepted length is published', { tag: ['@regression'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle();
  const longTitle = `${ARTICLE_EDGE.maxAcceptedTitle.slice(0, 160)} ${article.title.split(' ').pop()}`;
  const longArticle = { ...article, title: longTitle };
  cleanupArticle(longTitle);

  await articlePage.navigateToEditor();
  await articlePage.createArticle(longArticle);

  await articlePage.expectRedirectedToArticle();
  await articlePage.expectArticleTitle(longTitle);
});

test('TC-14: Verify that a duplicate article title is rejected', { tag: ['@regression'] }, async ({ articlePage, seededArticle }) => {
  await articlePage.navigateToEditor();
  await articlePage.createArticle(newArticle({ title: seededArticle.title }));

  await articlePage.expectDuplicateTitleError();
  await articlePage.expectStillOnEditor();
});

test('TC-15: Verify that a single-character title is accepted', { tag: ['@regression'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle({ title: `${ARTICLE_EDGE.singleCharTitle}${Date.now().toString(36)}` });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.createArticle(article);

  await articlePage.expectArticleTitle(article.title);
});

test('TC-16: Verify that a unicode and emoji title is stored without mangling', { tag: ['@regression'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle({ title: `${ARTICLE_EDGE.unicodeTitle} ${Date.now().toString(36)}` });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.createArticle(article);

  await articlePage.expectArticleTitle(article.title);
});

test('TC-17: Verify that SQL-like text in a title is treated as literal text', { tag: ['@regression', '@critical'] }, async ({ articlePage, articleAsserts, cleanupArticle }) => {
  const article = newArticle({ title: `${ARTICLE_EDGE.sqlishTitle} ${Date.now().toString(36)}` });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.createArticle(article);

  await articlePage.expectArticleTitle(article.title);
  await articleAsserts.expectDatabaseStillReadable();
});

test('TC-18: Verify that markup in a title is not executed when the article is viewed', { tag: ['@critical'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle({ title: `${ARTICLE_EDGE.scriptTitle} ${Date.now().toString(36)}` });
  cleanupArticle(article.title);

  articlePage.watchForDialogs();

  await articlePage.navigateToEditor();
  await articlePage.createArticle(article);

  await articlePage.expectMarkupIsDisplayedAsText();
  await articlePage.expectNoScriptExecuted();
});

test('TC-19: Verify that duplicate tags on one article are de-duplicated', { tag: ['@regression'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle({ tagList: [...ARTICLE_EDGE.duplicateTags] });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.fillArticleWithoutPublishing(article);

  await articlePage.expectTagPillCount(1);
});

test('TC-20: Verify that a whitespace-only tag is rejected', { tag: ['@regression'] }, async ({ articlePage }) => {
  await articlePage.navigateToEditor();
  await articlePage.addTag(ARTICLE_EDGE.whitespaceOnly);

  await articlePage.expectTagPillCount(0);
});

test('TC-21: Verify that a large number of tags is accepted', { tag: ['@regression'] }, async ({ articlePage, cleanupArticle }) => {
  const article = newArticle({ tagList: [...ARTICLE_EDGE.manyTags] });
  cleanupArticle(article.title);

  await articlePage.navigateToEditor();
  await articlePage.fillArticleWithoutPublishing(article);

  await articlePage.expectTagPillCount(ARTICLE_EDGE.manyTags.length);
});
