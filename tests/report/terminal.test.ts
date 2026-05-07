import { describe, it, expect } from 'vitest';
import { renderTerminal } from '../../src/report/terminal.js';
import type { Report } from '../../src/types.js';

const sample: Report = {
  summary: {
    totalFiles: 3,
    totalLines: 120,
    languages: {
      TypeScript: { files: 2, lines: 100 },
      Markdown: { files: 1, lines: 20 },
    },
  },
  analysis: {
    filesAnalyzed: 2,
    parseErrors: [],
    aggregates: { totalFunctions: 4, avgComplexity: 3.5, maxComplexity: 12 },
    findings: {
      complexity: [{ file: 'a.ts', line: 5, symbol: 'foo', value: 12, threshold: 10 }],
      longFunctions: [],
      deepNesting: [],
      longParamLists: [],
      magicNumbers: [],
      unusedExports: [],
      todos: [],
      duplicates: [],
    },
    violations: { total: 1, byCategory: { complexity: 1 } },
  },
  meta: {
    target: '/tmp/sample',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 42,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('renderTerminal', () => {
  it('includes summary, violations, and finding details', () => {
    const out = renderTerminal(sample, 10, false); // noColor = false; we still test the strings
    // eslint-disable-next-line no-control-regex
    const stripped = out.replace(/\x1B\[[0-9;]*m/g, '');
    expect(stripped).toContain('Total files: 3');
    expect(stripped).toContain('Total lines: 120');
    expect(stripped).toContain('TypeScript');
    expect(stripped).toContain('Violations: 1');
    expect(stripped).toContain('foo');
    expect(stripped).toContain('a.ts:5');
  });
});
