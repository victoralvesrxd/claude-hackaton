import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

describe('cscan CLI', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-cli-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('prints a summary and exits 0 on a clean tiny project', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    const { stdout, stderr } = await execFileP('node', ['--import', 'tsx', 'src/cli.ts', root]);
    expect(stdout).toMatch(/Total files: 1/);
    expect(stderr).toBe('');
  });

  it('exits 2 when the target directory does not exist', async () => {
    await expect(
      execFileP('node', ['--import', 'tsx', 'src/cli.ts', '/nonexistent-xyz-9999']),
    ).rejects.toMatchObject({ code: 2 });
  });

  it('writes a JSON report when --json is passed', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    const out = path.join(root, 'r.json');
    await execFileP('node', ['--import', 'tsx', 'src/cli.ts', root, '--json', out]);
    const { readFile } = await import('node:fs/promises');
    const parsed = JSON.parse(await readFile(out, 'utf8'));
    expect(parsed.summary.totalFiles).toBe(1);
  });
});
