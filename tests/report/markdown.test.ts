import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeMarkdownReport } from '../../src/report/markdown.js';
import type { Report } from '../../src/types.js';

const sample: Report = {
  summary: {
    totalFiles: 2,
    totalLines: 50,
    languages: { TypeScript: { files: 2, lines: 50 } },
  },
  analysis: {
    filesAnalyzed: 2,
    parseErrors: [],
    aggregates: { totalFunctions: 1, avgComplexity: 5, maxComplexity: 5 },
    findings: {
      complexity: [{ file: 'a.ts', line: 1, symbol: 'big', value: 12, threshold: 10 }],
      longFunctions: [], deepNesting: [], longParamLists: [],
      magicNumbers: [], unusedExports: [], todos: [], duplicates: [],
    },
    violations: { total: 1, byCategory: { complexity: 1 } },
  },
  meta: {
    target: '/tmp/x',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 1,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('writeMarkdownReport', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'code-ratings-md-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes Markdown with summary heading and a complexity table row', async () => {
    const out = path.join(dir, 'report.md');
    await writeMarkdownReport(sample, out, 10);
    const text = await readFile(out, 'utf8');
    expect(text).toContain('# Code Ratings report');
    expect(text).toContain('| TypeScript | 2 | 50 |');
    expect(text).toContain('| a.ts:1 | big | 12 | 10 |');
  });
});
