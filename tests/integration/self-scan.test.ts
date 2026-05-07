import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('self-scan', () => {
  it('runs cscan against its own src/ without throwing', async () => {
    const srcDir = path.resolve(__dirname, '..', '..', 'src');
    const report = await runPipeline(srcDir, DEFAULT_THRESHOLDS);
    expect(report.summary.totalFiles).toBeGreaterThan(0);
    expect(report.analysis.filesAnalyzed).toBeGreaterThan(0);
    // The codebase should not have any parse errors.
    expect(report.analysis.parseErrors).toEqual([]);
  });
});
