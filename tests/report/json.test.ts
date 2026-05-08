import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeJsonReport } from '../../src/report/json.js';
import type { Report } from '../../src/types.js';

const fakeReport: Report = {
  summary: { totalFiles: 1, totalLines: 1, languages: {} },
  analysis: {
    filesAnalyzed: 0,
    parseErrors: [],
    aggregates: { totalFunctions: 0, avgComplexity: 0, maxComplexity: 0 },
    findings: {
      complexity: [], longFunctions: [], deepNesting: [], longParamLists: [],
      magicNumbers: [], unusedExports: [], todos: [], duplicates: [],
    },
    violations: { total: 0, byCategory: {} },
  },
  meta: {
    target: '/x',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 1,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('writeJsonReport', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'code-ratings-json-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a pretty-printed JSON file that round-trips', async () => {
    const out = path.join(dir, 'report.json');
    await writeJsonReport(fakeReport, out);
    const text = await readFile(out, 'utf8');
    expect(text).toContain('\n');
    expect(JSON.parse(text)).toEqual(fakeReport);
  });
});
