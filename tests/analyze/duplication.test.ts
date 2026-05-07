import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runDuplicationScan } from '../../src/analyze/duplication.js';

describe('runDuplicationScan', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-dup-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns an empty array when no duplicates exist', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const a = 1;');
    await writeFile(path.join(root, 'b.ts'), 'export function b() { return 2; }');
    const findings = await runDuplicationScan(root);
    expect(findings).toEqual([]);
  });

  it('detects an obvious duplicated block across two files', async () => {
    const block = `
export function dupBlock() {
  const x = 1;
  const y = 2;
  const z = 3;
  if (x + y > z) {
    return x + y + z;
  }
  return 0;
}
`.repeat(2); // make it long enough to exceed jscpd defaults
    await writeFile(path.join(root, 'a.ts'), block);
    await writeFile(path.join(root, 'b.ts'), block);
    const findings = await runDuplicationScan(root);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
