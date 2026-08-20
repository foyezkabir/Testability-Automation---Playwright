/**
 * Data transformation - specs contain no string/data logic, so it lives here.
 * Pure and stateless: same input, same output.
 */
export class DataHelper {
  /** Pull one property off every record. */
  static extractValues<T, K extends keyof T>(data: readonly T[], key: K): T[K][] {
    return data.map((item) => item[key]);
  }

  /** Collapse runs of whitespace and trim - the usual fix for UI text assertions. */
  static normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /** Lowercase + whitespace-normalise, for case-insensitive comparison. */
  static sanitize(text: string): string {
    return DataHelper.normalizeWhitespace(text).toLowerCase();
  }

  /** Compare two lists ignoring order and surrounding whitespace. */
  static sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
    const norm = (list: readonly string[]) => list.map(DataHelper.sanitize).slice().sort();
    return JSON.stringify(norm(actual)) === JSON.stringify(norm(expected));
  }

  /** Build a URL-safe slug from arbitrary text. */
  static slugify(text: string): string {
    return DataHelper.sanitize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /**
   * The first paragraph of a multi-paragraph string. Markdown bodies render as separate
   * <p> elements, so asserting the whole body against one element's text would fail.
   */
  static firstParagraph(text: string): string {
    return text.split('\n')[0];
  }
}
