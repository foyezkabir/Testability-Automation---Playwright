/** Repetition kept out of specs, which must stay linear. This is not a waiter. */
export class LoopHelper {
  /** Run `action` once per item, in order. */
  static async forEachSeries<T>(items: readonly T[], action: (item: T, index: number) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += 1) {
      await action(items[i], i);
    }
  }
}
