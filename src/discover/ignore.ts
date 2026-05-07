import ignoreFactory from 'ignore';
import path from 'node:path';

export const HARDCODED_SKIP_DIRS = [
  '.git',
  'node_modules',
  '__pycache__',
  'dist',
  'build',
  '.next',
  'coverage',
] as const;

export interface IgnoreMatcher {
  shouldSkip(absolutePath: string): boolean;
}

export function createIgnoreMatcher(rootDir: string, gitignoreContent: string | null): IgnoreMatcher {
  const ig = ignoreFactory();
  for (const dir of HARDCODED_SKIP_DIRS) {
    ig.add(`${dir}/`);
    ig.add(`**/${dir}/`);
  }
  if (gitignoreContent) {
    ig.add(gitignoreContent);
  }
  return {
    shouldSkip(absolutePath: string): boolean {
      const rel = path.relative(rootDir, absolutePath);
      if (!rel || rel.startsWith('..')) return false;
      return ig.ignores(rel);
    },
  };
}
