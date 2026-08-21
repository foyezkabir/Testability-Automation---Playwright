/**
 * Article Page for the Conduit web application.
 * Actions, state readers, and named expect* assertion methods.
 */
import { Page, expect } from '@playwright/test';
import { ArticleLocators } from '../locators/ArticleLocators';
import { NewArticle } from '../datas/articles/ArticleData';
import { DataHelper, LoopHelper } from '../helpers';

export class ArticlePage {
  readonly locators: ArticleLocators;
  private dialogFired = false;

  constructor(private readonly page: Page) {
    this.locators = new ArticleLocators(page);
  }

  // ===== NAVIGATION =====

  async navigateToHome(): Promise<void> {
    await this.page.goto('/');
  }

  async navigateToEditor(): Promise<void> {
    await this.page.goto('/editor');
  }

  async navigateToEditorForArticle(slug: string): Promise<void> {
    await this.page.goto(`/editor/${slug}`);
  }

  async navigateToArticle(slug: string): Promise<void> {
    await this.page.goto(`/article/${slug}`);
  }

  async clickNewArticleNavLink(): Promise<void> {
    await this.locators.newArticleNavLink.click();
  }

  async reloadPage(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Start recording native dialogs. A stored script payload that actually executed would
   * fire alert(), so this is how the XSS checks prove nothing ran.
   */
  watchForDialogs(): void {
    this.dialogFired = false;
    this.page.on('dialog', async (dialog) => {
      this.dialogFired = true;
      await dialog.dismiss();
    });
  }

  // ===== EDITOR: FILL FIELDS =====

  async fillTitle(title: string): Promise<void> {
    await this.locators.titleInput.fill(title);
  }

  async fillDescription(description: string): Promise<void> {
    await this.locators.descriptionInput.fill(description);
  }

  async fillBody(body: string): Promise<void> {
    await this.locators.bodyInput.fill(body);
  }

  async clearTitle(): Promise<void> {
    await this.locators.titleInput.clear();
  }

  async addTag(tag: string): Promise<void> {
    await this.locators.tagsInput.fill(tag);
    await this.locators.tagsInput.press('Enter');
  }

  async addTags(tags: readonly string[]): Promise<void> {
    await LoopHelper.forEachSeries(tags, (tag) => this.addTag(tag));
  }

  async removeTag(tag: string): Promise<void> {
    await this.locators.tagPillRemove(tag).click();
  }

  // ===== EDITOR: SUBMIT =====

  async clickPublishButton(): Promise<void> {
    await this.locators.publishButton.click();
  }

  async createArticle(article: NewArticle): Promise<void> {
    await this.fillTitle(article.title);
    await this.fillDescription(article.description);
    await this.fillBody(article.body);
    await this.addTags(article.tagList);
    await this.clickPublishButton();
  }

  async fillArticleWithoutPublishing(article: NewArticle): Promise<void> {
    await this.fillTitle(article.title);
    await this.fillDescription(article.description);
    await this.fillBody(article.body);
    await this.addTags(article.tagList);
  }

  async editArticle(title: string, body: string): Promise<void> {
    await this.fillTitle(title);
    await this.fillBody(body);
    await this.clickPublishButton();
  }

  /** Open an article for editing, retrying until its values have actually loaded. */
  async openArticleInEditor(slug: string, expectedTitle: string): Promise<void> {
    await expect(async () => {
      await this.navigateToEditorForArticle(slug);
      await expect(this.locators.titleInput).toHaveValue(expectedTitle, { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }

  /** Open an article's detail page, retrying until its title has actually rendered. */
  async openArticleDetail(slug: string, expectedTitle: string): Promise<void> {
    await expect(async () => {
      await this.navigateToArticle(slug);
      await expect(this.locators.articleTitleHeading).toHaveText(expectedTitle, { timeout: 10_000 });
    }).toPass({ timeout: 45_000 });
  }

  // ===== ARTICLE DETAIL =====

  async clickDeleteArticleButton(): Promise<void> {
    await this.locators.deleteArticleButton.click();
  }

  // ===== HOME FEED =====

  async filterByTag(tag: string): Promise<void> {
    await this.locators.sidebarTag(tag).click();
  }

  // ===== STATE READERS =====

  async articleCount(): Promise<number> {
    return this.locators.articlePreviews.count();
  }

  currentPath(): string {
    return new URL(this.page.url()).pathname;
  }

  currentSlug(): string {
    return this.currentPath().replace('/article/', '');
  }

  // ===== ASSERTIONS - editor =====

  async expectEditorIsOpen(): Promise<void> {
    await expect(this.locators.titleInput).toBeVisible();
  }

  async expectPublishButtonIsReady(): Promise<void> {
    await expect(this.locators.publishButton).toBeVisible();
  }

  async expectStillOnEditor(): Promise<void> {
    await expect.poll(() => this.currentPath()).toBe('/editor');
  }

  // ===== ASSERTIONS - validation errors =====

  async expectSingleValidationError(): Promise<void> {
    await expect(this.locators.errorMessages).toHaveCount(1);
  }

  async expectNoValidationError(): Promise<void> {
    await expect(this.locators.errorMessages).toHaveCount(0);
  }

  async expectTitleBlankError(): Promise<void> {
    await expect(this.locators.titleBlankError).toBeVisible();
  }

  async expectDuplicateTitleError(): Promise<void> {
    await expect(this.locators.titleNotUniqueError).toBeVisible();
  }

  async expectNoDatabaseDetailsLeaked(): Promise<void> {
    await expect(this.locators.ormLeakInError).toHaveCount(0);
  }

  // ===== ASSERTIONS - published article =====

  async expectRedirectedToArticle(): Promise<void> {
    await expect.poll(() => this.currentPath()).toContain('/article/');
  }

  async expectArticleTitle(title: string): Promise<void> {
    await expect(this.locators.articleTitleHeading).toHaveText(title);
  }

  async expectArticleTitleIsNot(title: string): Promise<void> {
    await expect(this.locators.articleTitleHeading).not.toHaveText(title);
  }

  async expectArticleBodyContains(body: string): Promise<void> {
    await expect(this.locators.articleBody).toContainText(DataHelper.firstParagraph(body));
  }

  async expectArticleTagShown(tag: string): Promise<void> {
    await expect(this.locators.articleTags).toContainText(tag);
  }

  async expectMarkupIsDisplayedAsText(): Promise<void> {
    await expect(this.locators.escapedMarkupInTitle()).toBeVisible();
  }

  /** No native dialog fired - the stored payload was rendered, never executed. */
  async expectNoScriptExecuted(): Promise<void> {
    expect(this.dialogFired).toBe(false);
  }

  // ===== ASSERTIONS - owner controls =====

  async expectOwnerControlsVisible(): Promise<void> {
    await expect(this.locators.deleteArticleButton).toBeVisible();
  }

  async expectOwnerControlsHidden(): Promise<void> {
    await expect(this.locators.editArticleLink).toHaveCount(0);
    await expect(this.locators.deleteArticleButton).toHaveCount(0);
  }

  // ===== ASSERTIONS - feed =====

  async expectRedirectedToFeed(): Promise<void> {
    await expect.poll(() => this.currentPath()).toBe('/');
  }

  async expectArticleListedInFeed(title: string): Promise<void> {
    await expect(this.locators.articleTitle(title)).toBeVisible();
  }

  async expectArticleNotInFeed(title: string): Promise<void> {
    await expect(this.locators.articleTitle(title)).toHaveCount(0);
  }

  async expectTagOfferedInSidebar(tag: string): Promise<void> {
    await expect(this.locators.sidebarTag(tag)).toBeVisible();
  }

  async expectTagNotOfferedInSidebar(tag: string): Promise<void> {
    await expect(this.locators.sidebarTag(tag)).toHaveCount(0);
  }

  async expectTagTabIsActive(tag: string): Promise<void> {
    await expect(this.locators.feedTab(tag)).toBeVisible();
  }

  async expectFeedArticleCount(count: number): Promise<void> {
    await expect.poll(() => this.articleCount()).toBe(count);
  }

  async expectArticleCardCarriesTag(title: string, tag: string): Promise<void> {
    await expect(this.locators.articleCard(title)).toContainText(tag);
  }

  // ===== ASSERTIONS - editor tag pills =====

  async expectTagPillCount(count: number): Promise<void> {
    await expect(this.locators.tagPills).toHaveCount(count);
  }

  async expectTagPillShown(tag: string): Promise<void> {
    await expect(this.locators.tagPill(tag)).toBeVisible();
  }

  async expectTagPillRemoved(tag: string): Promise<void> {
    await expect(this.locators.tagPill(tag)).toHaveCount(0);
  }
}
