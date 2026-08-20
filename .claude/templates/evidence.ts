// Failure evidence: on any failed test, capture PNG + toast log + log.txt line.
// TEMPLATE - Phase 0 copies this file verbatim to fixtures/evidence.ts.
// Auto fixture - no spec ever references it. Capture must NEVER mask the real failure.
// Verified end-to-end 2026-07-15 (sandbox run: PNG + toast + log confirmed on a real failure).
import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

declare global {
  interface Window { __toastLog: { text: string; at: string }[] }
}

export const test = base.extend<{ failureEvidence: void }>({
  failureEvidence: [async ({ page }, use, testInfo) => {
    // Toast recorder: MutationObserver on aria-live / alert / status nodes.
    // Runs the whole test - a 2s toast cannot outrun it.
    const installToastRecorder = () => {
      window.__toastLog = window.__toastLog ?? [];
      new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!(n instanceof Element)) continue;
            const hit = n.matches('[role="alert"], [role="status"], [aria-live]')
              ? n
              : n.querySelector('[role="alert"], [role="status"], [aria-live]');
            const text = (hit?.textContent || '').trim();
            if (text) window.__toastLog.push({ text, at: new Date().toISOString() });
          }
        }
      }).observe(document, { childList: true, subtree: true });
    };
    await page.addInitScript(installToastRecorder); // every future navigation
    await page.evaluate(installToastRecorder).catch(() => {}); // the current document too

    await use();

    if (testInfo.status === testInfo.expectedStatus) return; // green run: leave nothing
    try {
      const module = path.basename(testInfo.file).replace(/\.spec\.ts$/, '');
      const tc = /TC-\d+/.exec(testInfo.title)?.[0] ?? 'TC-unknown';
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      // Anchor to the config file's directory (config.rootDir points at testDir, NOT the project root)
      const root = testInfo.config.configFile ? path.dirname(testInfo.config.configFile) : process.cwd();
      const dir = path.join(root, 'failures', module);
      fs.mkdirSync(dir, { recursive: true });

      // Durable PNG (test-results/ is wiped each run; this copy is ours)
      await page
        .screenshot({ path: path.join(dir, `${tc}_${date}_${time}.png`), fullPage: true })
        .catch(() => {}); // page may already be closed; the log line below still lands

      const toasts = await page.evaluate(() => window.__toastLog ?? []).catch(() => []);
      const error = (testInfo.error?.message ?? 'unknown error')
        .replace(/\u001b\[[0-9;]*m/g, '') // strip ANSI color codes
        .split('\n')[0];
      fs.appendFileSync(
        path.join(dir, 'log.txt'),
        [
          `${date} ${time.replace(/-/g, ':')}  ${tc}  FAILED`,
          `  error: ${error}`,
          ...toasts.map((t) => `  toast: "${t.text}" @ ${t.at}`),
          '',
        ].join('\n'),
      );
    } catch {
      // never throw from evidence capture
    }
  }, { auto: true }],
});

export { expect } from '@playwright/test';
