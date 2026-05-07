import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walkDirectory } from '../../src/discover/walk.js';

describe('walkDirectory', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-walk-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns all files recursively, skipping hardcoded dirs', async () => {
    await writeFile(path.join(root, 'a.ts'), 'a');
    await mkdir(path.join(root, 'sub'));
    await writeFile(path.join(root, 'sub', 'b.ts'), 'b');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules', 'pkg.ts'), 'p');

    const files = await walkDirectory(root);
    const rels = files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(['a.ts', 'sub/b.ts']);
  });

  it('respects .gitignore at the root', async () => {
    await writeFile(path.join(root, '.gitignore'), 'secret.txt\n');
    await writeFile(path.join(root, 'a.ts'), 'a');
    await writeFile(path.join(root, 'secret.txt'), 's');

    const files = await walkDirectory(root);
    const rels = files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(['.gitignore', 'a.ts']);
  });

  it('throws ScannerError fatal when target does not exist', async () => {
    await expect(walkDirectory('/nonexistent-path-xyz-123')).rejects.toMatchObject({
      kind: 'fatal',
    });
  });

  it('throws ScannerError fatal when target is a file', async () => {
    const file = path.join(root, 'just-a-file.ts');
    await writeFile(file, 'x');
    await expect(walkDirectory(file)).rejects.toMatchObject({ kind: 'fatal' });
  });
});
