/**
 * Loop control flow - specs must stay linear, so every repetition lives here.
 * NOTE: this is NOT a waiter. Wait on a condition with expect.poll / toPass.
 */
export class LoopHelper {
  /** Run `action` exactly `iterations` times, passing the 0-based index. */
  static async repeatAction(action: (index: number) => Promise<void>, iterations: number): Promise<void> {
    for (let i = 0; i < iterations; i += 1) {
      await action(i);
    }
  }

  /** Map over items sequentially, collecting each result. */
  static async mapSeries<T, R>(items: readonly T[], action: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += 1) {
      results.push(await action(items[i], i));
    }
    return results;
  }

  /** Run `action` once per item, discarding results. */
  static async forEachSeries<T>(items: readonly T[], action: (item: T, index: number) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += 1) {
      await action(items[i], i);
    }
  }
}
