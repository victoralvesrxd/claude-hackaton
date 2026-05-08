import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeHtmlReport, renderHtml, computeRating } from '../../src/report/html.js';
import type { Report } from '../../src/types.js';

const baseReport: Report = {
  summary: {
    totalFiles: 23,
    totalLines: 1383,
    languages: { TypeScript: { files: 23, lines: 1383 } },
  },
  analysis: {
    filesAnalyzed: 23,
    parseErrors: [],
    aggregates: { totalFunctions: 68, avgComplexity: 3.75, maxComplexity: 12 },
    findings: {
      complexity: [{ file: 'analyze/metrics/functionName.ts', line: 3, symbol: 'getFunctionName', value: 12, threshold: 10 }],
      longFunctions: [
        { file: 'pipeline.ts', line: 12, symbol: 'runPipeline', value: 69, threshold: 50 },
        { file: 'analyze/ast.ts', line: 114, symbol: 'runAstAnalysis', value: 68, threshold: 50 },
        { file: 'aggregate/buildReport.ts', line: 39, symbol: 'buildReport', value: 55, threshold: 50 },
        { file: 'analyze/duplication.ts', line: 33, symbol: 'runDuplicationScan', value: 55, threshold: 50 },
      ],
      deepNesting: [{ file: 'analyze/metrics/unusedExports.ts', line: 5, symbol: 'analyzeUnusedExports', value: 5, threshold: 4 }],
      longParamLists: [
        { file: 'report/terminal.ts', line: 56, symbol: 'renderCategory', value: 6, threshold: 4 },
        { file: 'report/terminal.ts', line: 78, symbol: 'renderDuplicates', value: 5, threshold: 4 },
      ],
      magicNumbers: Array.from({ length: 13 }, (_, i) => ({ file: `m${i}.ts`, line: i + 1, value: 100, threshold: 0 })),
      unusedExports: Array.from({ length: 14 }, (_, i) => ({ file: `u${i}.ts`, line: i + 1, symbol: `Sym${i}`, value: 0, threshold: 0 })),
      todos: [],
      duplicates: [
        { tokens: 0, occurrences: [
          { file: 'analyze/metrics/nesting.ts', startLine: 1, endLine: 11 },
          { file: 'analyze/metrics/params.ts', startLine: 1, endLine: 11 },
        ]},
        { tokens: 0, occurrences: [
          { file: 'analyze/metrics/length.ts', startLine: 1, endLine: 15 },
          { file: 'analyze/metrics/params.ts', startLine: 1, endLine: 15 },
        ]},
        { tokens: 0, occurrences: [
          { file: 'aggregate/buildReport.ts', startLine: 19, endLine: 35 },
          { file: 'analyze/ast.ts', startLine: 24, endLine: 42 },
        ]},
        { tokens: 0, occurrences: [{ file: 'a.ts', startLine: 1, endLine: 5 }]},
        { tokens: 0, occurrences: [{ file: 'b.ts', startLine: 1, endLine: 5 }]},
        { tokens: 0, occurrences: [{ file: 'c.ts', startLine: 1, endLine: 5 }]},
        { tokens: 0, occurrences: [{ file: 'd.ts', startLine: 1, endLine: 5 }]},
      ],
    },
    violations: { total: 42, byCategory: {} },
  },
  meta: {
    target: '/Users/x/proj/src',
    scannedAt: '2026-05-07T15:48:29.281Z',
    durationMs: 996,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

const cleanReport: Report = {
  ...baseReport,
  analysis: {
    ...baseReport.analysis,
    findings: {
      complexity: [], longFunctions: [], deepNesting: [], longParamLists: [],
      magicNumbers: [], unusedExports: [], todos: [], duplicates: [],
    },
    violations: { total: 0, byCategory: {} },
  },
};

describe('computeRating', () => {
  it('rates a clean codebase as Aaa', () => {
    const r = computeRating(cleanReport);
    expect(r.overall.tier).toBe('Aaa');
    expect(r.overall.compositeDensity).toBe(0);
  });

  it('rates the cscan dogfood snapshot as Baa2', () => {
    const r = computeRating(baseReport);
    expect(r.overall.tier).toBe('Baa2');
    expect(r.overall.compositeDensity).toBeGreaterThan(2.5);
    expect(r.overall.compositeDensity).toBeLessThan(4.0);
  });

  it('rates a saturated codebase as C', () => {
    const huge: Report = {
      ...baseReport,
      analysis: {
        ...baseReport.analysis,
        findings: {
          ...baseReport.analysis.findings,
          complexity: Array.from({ length: 200 }, (_, i) => ({ file: `f${i}.ts`, line: 1, value: 50, threshold: 10 })),
        },
      },
    };
    expect(computeRating(huge).overall.tier).toBe('C');
  });

  it('returns one entry per category, with weights summing to 1', () => {
    const r = computeRating(baseReport);
    const cats = Object.keys(r.categories);
    expect(cats.sort()).toEqual([
      'complexity', 'deepNesting', 'duplicates', 'longFunctions',
      'longParamLists', 'magicNumbers', 'todos', 'unusedExports',
    ]);
    const totalWeight = Object.values(r.categories).reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });
});

describe('renderHtml', () => {
  it('returns a self-contained HTML document starting with the doctype', () => {
    const html = renderHtml(baseReport);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('shows the computed overall rating tier prominently', () => {
    const html = renderHtml(baseReport);
    expect(html).toContain('Baa2');
  });

  it('shows the headline counts (files, lines, functions, findings)', () => {
    const html = renderHtml(baseReport);
    expect(html).toContain('23');
    expect(html).toContain('1,383');
    expect(html).toContain('68');
    expect(html).toContain('42');
  });

  it('includes a card for every analysis category', () => {
    const html = renderHtml(baseReport);
    expect(html).toContain('Cyclomatic Complexity');
    expect(html).toContain('Long Functions');
    expect(html).toContain('Deep Nesting');
    expect(html).toContain('Long Param');
    expect(html).toContain('Magic Numbers');
    expect(html).toContain('Code Duplication');
    expect(html).toContain('Unused Exports');
    expect(html).toContain('TODO');
  });

  it('includes every Moody\'s tier in the glossary', () => {
    const html = renderHtml(baseReport);
    const tiers = ['Aaa', 'Aa1', 'Aa2', 'Aa3', 'A1', 'A2', 'A3',
      'Baa1', 'Baa2', 'Baa3', 'Ba1', 'Ba2', 'Ba3', 'B1', 'B2', 'B3',
      'Caa1', 'Caa2', 'Caa3', 'Ca', 'C'];
    for (const t of tiers) {
      expect(html).toContain(`>${t}<`);
    }
  });

  it('cites top long-function offenders by file:line', () => {
    const html = renderHtml(baseReport);
    expect(html).toContain('pipeline.ts:12');
    expect(html).toContain('runPipeline');
  });

  it('escapes HTML metacharacters in file paths', () => {
    const evil: Report = {
      ...baseReport,
      analysis: {
        ...baseReport.analysis,
        findings: {
          ...baseReport.analysis.findings,
          complexity: [{ file: '<script>alert(1)</script>.ts', line: 1, value: 99, threshold: 10 }],
        },
      },
    };
    const html = renderHtml(evil);
    expect(html).not.toContain('<script>alert(1)</script>.ts');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;.ts');
  });
});

describe('writeHtmlReport', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cscan-html-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the rendered HTML to disk', async () => {
    const out = path.join(dir, 'report.html');
    await writeHtmlReport(baseReport, out);
    const text = await readFile(out, 'utf8');
    expect(text).toContain('Baa2');
    expect(text).toContain('cscan');
  });
});
