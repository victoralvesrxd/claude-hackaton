import { describe, it, expect } from 'vitest';
import { createIgnoreMatcher, HARDCODED_SKIP_DIRS } from '../../src/discover/ignore.js';

describe('createIgnoreMatcher', () => {
  it('skips hardcoded directories', () => {
    const matcher = createIgnoreMatcher('/root', null);
    for (const dir of HARDCODED_SKIP_DIRS) {
      expect(matcher.shouldSkip(`/root/${dir}/anything.ts`)).toBe(true);
      expect(matcher.shouldSkip(`/root/sub/${dir}/file.ts`)).toBe(true);
    }
  });

  it('does not skip normal files', () => {
    const matcher = createIgnoreMatcher('/root', null);
    expect(matcher.shouldSkip('/root/src/index.ts')).toBe(false);
  });

  it('honors .gitignore patterns when provided', () => {
    const matcher = createIgnoreMatcher('/root', 'secrets.txt\n*.bak\n');
    expect(matcher.shouldSkip('/root/secrets.txt')).toBe(true);
    expect(matcher.shouldSkip('/root/foo.bak')).toBe(true);
    expect(matcher.shouldSkip('/root/foo.txt')).toBe(false);
  });

  it('combines hardcoded and gitignore rules', () => {
    const matcher = createIgnoreMatcher('/root', '*.bak');
    expect(matcher.shouldSkip('/root/node_modules/x.ts')).toBe(true);
    expect(matcher.shouldSkip('/root/x.bak')).toBe(true);
  });
});
