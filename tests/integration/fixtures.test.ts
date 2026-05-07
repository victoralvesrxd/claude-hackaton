import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(__dirname, '..', 'fixtures');

describe('integration: clean-project', () => {
  it('produces zero violations', async () => {
    const report = await runPipeline(path.join(fixtures, 'clean-project'), DEFAULT_THRESHOLDS);
    expect(report.analysis.violations.total).toBe(0);
  });
});

describe('integration: messy-project', () => {
  it('flags multiple categories', async () => {
    const report = await runPipeline(path.join(fixtures, 'messy-project'), DEFAULT_THRESHOLDS);
    expect(report.analysis.findings.complexity.length).toBeGreaterThan(0);
    expect(report.analysis.findings.deepNesting.length).toBeGreaterThan(0);
    expect(report.analysis.findings.longParamLists.length).toBeGreaterThan(0);
    expect(report.analysis.findings.magicNumbers.length).toBeGreaterThan(0);
    expect(report.analysis.findings.todos.length).toBeGreaterThan(0);
    expect(report.analysis.findings.duplicates.length).toBeGreaterThan(0);
  });
});

describe('integration: mixed-languages', () => {
  it('counts every language in the summary but only deep-analyzes TS', async () => {
    const report = await runPipeline(path.join(fixtures, 'mixed-languages'), DEFAULT_THRESHOLDS);
    expect(Object.keys(report.summary.languages).sort()).toEqual(
      ['Markdown', 'Python', 'TypeScript'].sort(),
    );
    expect(report.analysis.filesAnalyzed).toBe(1);
  });
});
