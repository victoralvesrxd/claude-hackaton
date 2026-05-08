import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPipeline } from '../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js';

describe('runPipeline', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'code-ratings-pipe-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('produces a Report covering summary, analysis, and meta', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    await writeFile(path.join(root, 'README.md'), '# hello\n');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules', 'ignored.ts'), 'export const y = 2;');
    const report = await runPipeline(root, DEFAULT_THRESHOLDS);
    expect(report.summary.totalFiles).toBe(2);
    expect(report.summary.languages.TypeScript?.files).toBe(1);
    expect(report.summary.languages.Markdown?.files).toBe(1);
    expect(report.analysis.filesAnalyzed).toBe(1);
    expect(report.meta.target).toBe(path.resolve(root));
    expect(typeof report.meta.scannedAt).toBe('string');
  });
});
