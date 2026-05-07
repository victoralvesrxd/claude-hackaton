import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createIgnoreMatcher } from './ignore.js';
import { ScannerError } from '../errors.js';
import type { DiscoveredFile } from '../types.js';

export async function walkDirectory(rootDir: string): Promise<DiscoveredFile[]> {
  const absoluteRoot = path.resolve(rootDir);

  let rootStat;
  try {
    rootStat = await stat(absoluteRoot);
  } catch {
    throw new ScannerError('fatal', `Target directory does not exist: ${absoluteRoot}`);
  }
  if (!rootStat.isDirectory()) {
    throw new ScannerError('fatal', `Target is not a directory: ${absoluteRoot}`);
  }

  let gitignoreContent: string | null = null;
  try {
    gitignoreContent = await readFile(path.join(absoluteRoot, '.gitignore'), 'utf8');
  } catch {
    // no .gitignore — fine
  }

  const matcher = createIgnoreMatcher(absoluteRoot, gitignoreContent);
  const results: DiscoveredFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip silently
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (matcher.shouldSkip(full)) continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        results.push({
          absolutePath: full,
          relativePath: path.relative(absoluteRoot, full),
        });
      }
    }
  }

  await walk(absoluteRoot);
  return results;
}
