/**
 * Writes a per-browser result table into the job's GitHub Step Summary.
 *
 * Reads the JSON reporter output rather than scraping stdout, so the counts are the
 * runner's own numbers. "Expected failures" are the test.fail cases documenting known
 * product defects - they run, fail, and that is the correct outcome.
 */
import * as fs from 'fs';

const project = process.argv[2] ?? 'unknown';
const RESULTS = 'results.json';
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

function countStatuses(suite, acc) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const status = test.status ?? 'unknown';
      acc[status] = (acc[status] ?? 0) + 1;
    }
  }

  for (const child of suite.suites ?? []) {
    countStatuses(child, acc);
  }

  return acc;
}

function buildSummary() {
  if (!fs.existsSync(RESULTS)) {
    return `### ${project}\n\nNo \`${RESULTS}\` produced - the run did not reach the reporting stage.\n`;
  }

  const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  const counts = (report.suites ?? []).reduce((acc, suite) => countStatuses(suite, acc), {});

  const expected = counts.expected ?? 0;
  const unexpected = counts.unexpected ?? 0;
  const flaky = counts.flaky ?? 0;
  const skipped = counts.skipped ?? 0;
  const seconds = Math.round((report.stats?.duration ?? 0) / 1000);
  const icon = unexpected > 0 ? 'FAILED' : 'passed';

  return [
    `### ${project} - ${icon}`,
    '',
    '| Metric | Count |',
    '|---|---|',
    `| Passed | ${expected} |`,
    `| Failed | ${unexpected} |`,
    `| Flaky (passed on retry) | ${flaky} |`,
    `| Skipped | ${skipped} |`,
    `| Duration | ${seconds}s |`,
    '',
    'Known product defects are asserted with `test.fail`: they execute, fail as expected,',
    'and count as passed. See `findings/` for each one.',
    '',
  ].join('\n');
}

const summary = buildSummary();
console.log(summary);

if (summaryFile) {
  fs.appendFileSync(summaryFile, `${summary}\n`);
}
