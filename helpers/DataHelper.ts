/** Data transformation kept out of specs, which contain no string logic. Pure and stateless. */
export class DataHelper {
  /**
   * The first paragraph of a multi-paragraph string. Markdown bodies render as separate
   * <p> elements, so asserting the whole body against one element's text would fail.
   */
  static firstParagraph(text: string): string {
    return text.split('\n')[0];
  }
}
