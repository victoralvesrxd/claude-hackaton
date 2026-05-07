import { describe, it, expect } from 'vitest';
import { buildReport } from '../../src/aggregate/buildReport.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

describe('buildReport', () => {
  it('produces a Report with summary, analysis, and meta', () => {
    const report = buildReport({
      target: '/tmp/sample',
      scannedAt: '2026-05-05T00:00:00.000Z',
      durationMs: 12,
      scannerVersion: '0.1.0',
      thresholds: DEFAULT_THRESHOLDS,
      summary: {
        totalFiles: 3,
        totalLines: 100,
        languages: { TypeScript: { files: 2, lines: 90 }, Markdown: { files: 1, lines: 10 } },
      },
      ast: {
        filesAnalyzed: 2,
        parseErrors: [],
        skipped: [{ file: 'huge.ts', reason: 'too-large' }],
        findings: {
          complexity: [{ file: 'a.ts', line: 1, value: 12, threshold: 10 }],
          longFunctions: [],
          deepNesting: [],
          longParamLists: [],
          magicNumbers: [],
          unusedExports: [],
          todos: [],
          fileLength: [],
        },
        totalFunctions: 5,
        complexityScores: [1, 2, 3, 12, 1],
      },
      duplicates: [],
    });

    expect(report.summary.totalFiles).toBe(3);
    expect(report.analysis.aggregates.totalFunctions).toBe(5);
    expect(report.analysis.aggregates.maxComplexity).toBe(12);
    expect(report.analysis.aggregates.avgComplexity).toBeCloseTo(3.8, 1);
    expect(report.analysis.violations.total).toBe(1);
    expect(report.analysis.violations.byCategory.complexity).toBe(1);
    expect(report.meta.skipped).toHaveLength(1);
  });

  it('handles zero functions without dividing by zero', () => {
    const report = buildReport({
      target: '/tmp/empty',
      scannedAt: '2026-05-05T00:00:00.000Z',
      durationMs: 1,
      scannerVersion: '0.1.0',
      thresholds: DEFAULT_THRESHOLDS,
      summary: { totalFiles: 0, totalLines: 0, languages: {} },
      ast: {
        filesAnalyzed: 0,
        parseErrors: [],
        skipped: [],
        findings: {
          complexity: [], longFunctions: [], deepNesting: [], longParamLists: [],
          magicNumbers: [], unusedExports: [], todos: [], fileLength: [],
        },
        totalFunctions: 0,
        complexityScores: [],
      },
      duplicates: [],
    });
    expect(report.analysis.aggregates.avgComplexity).toBe(0);
    expect(report.analysis.aggregates.maxComplexity).toBe(0);
  });
});
