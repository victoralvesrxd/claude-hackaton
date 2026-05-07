import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { countLines, isBinary } from '../../src/classify/countLines.js';

describe('countLines', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-lines-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('counts lines in a small text file', async () => {
    const file = path.join(root, 'a.txt');
    await writeFile(file, 'a\nb\nc\n');
    expect(await countLines(file)).toBe(3);
  });

  it('counts the final line even without a trailing newline', async () => {
    const file = path.join(root, 'b.txt');
    await writeFile(file, 'a\nb\nc');
    expect(await countLines(file)).toBe(3);
  });

  it('returns 0 for an empty file', async () => {
    const file = path.join(root, 'c.txt');
    await writeFile(file, '');
    expect(await countLines(file)).toBe(0);
  });
});

describe('isBinary', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-bin-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns false for plain text', async () => {
    const file = path.join(root, 'a.txt');
    await writeFile(file, 'hello world\nthis is text\n');
    expect(await isBinary(file)).toBe(false);
  });

  it('returns true when the first 8KB contain a null byte', async () => {
    const file = path.join(root, 'b.bin');
    const buf = Buffer.concat([Buffer.from('hello'), Buffer.from([0x00]), Buffer.from('world')]);
    await writeFile(file, buf);
    expect(await isBinary(file)).toBe(true);
  });
});
