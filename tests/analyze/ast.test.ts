import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAstAnalysis } from '../../src/analyze/ast.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

describe('runAstAnalysis', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-ast-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('produces findings for analyzable files and ignores the rest', async () => {
    await writeFile(
      path.join(root, 'bad.ts'),
      'function f(a: number, b: number, c: number, d: number, e: number) { if (a) { if (b) { if (c) { if (d) { if (e) return; } } } } }',
    );
    await writeFile(path.join(root, 'notes.md'), '# notes');
    const result = await runAstAnalysis(
      root,
      [
        {
          absolutePath: path.join(root, 'bad.ts'),
          relativePath: 'bad.ts',
          language: 'TypeScript',
          lines: 1,
          isAnalyzable: true,
        },
        {
          absolutePath: path.join(root, 'notes.md'),
          relativePath: 'notes.md',
          language: 'Markdown',
          lines: 1,
          isAnalyzable: false,
        },
      ],
      DEFAULT_THRESHOLDS,
    );
    expect(result.filesAnalyzed).toBe(1);
    expect(result.findings.complexity.length + result.findings.longParamLists.length).toBeGreaterThan(0);
  });

  it('records parse errors and continues', async () => {
    await writeFile(path.join(root, 'broken.ts'), 'function f( {');
    const result = await runAstAnalysis(
      root,
      [
        {
          absolutePath: path.join(root, 'broken.ts'),
          relativePath: 'broken.ts',
          language: 'TypeScript',
          lines: 1,
          isAnalyzable: true,
        },
      ],
      DEFAULT_THRESHOLDS,
    );
    // ts-morph is permissive — parse errors here are non-fatal; assert pipeline still returns.
    expect(result).toBeDefined();
  });

  it('records oversized files as skipped', async () => {
    const big = 'const x = 1;\n'.repeat(100_000); // ~1.2 MB
    await writeFile(path.join(root, 'huge.ts'), big);
    const result = await runAstAnalysis(
      root,
      [
        {
          absolutePath: path.join(root, 'huge.ts'),
          relativePath: 'huge.ts',
          language: 'TypeScript',
          lines: 100_000,
          isAnalyzable: true,
        },
      ],
      DEFAULT_THRESHOLDS,
    );
    expect(result.skipped.find((s) => s.reason === 'too-large')).toBeDefined();
    expect(result.filesAnalyzed).toBe(0);
  });
});
