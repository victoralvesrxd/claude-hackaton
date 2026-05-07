import { describe, it, expect } from 'vitest';
import { detectLanguage, isAnalyzable } from '../../src/classify/extensions.js';

describe('detectLanguage', () => {
  it('maps known extensions to language names', () => {
    expect(detectLanguage('foo.ts')).toBe('TypeScript');
    expect(detectLanguage('foo.tsx')).toBe('TypeScript React');
    expect(detectLanguage('foo.js')).toBe('JavaScript');
    expect(detectLanguage('foo.jsx')).toBe('JavaScript React');
    expect(detectLanguage('foo.py')).toBe('Python');
    expect(detectLanguage('foo.md')).toBe('Markdown');
    expect(detectLanguage('foo.json')).toBe('JSON');
  });

  it('returns "Other" for unknown extensions', () => {
    expect(detectLanguage('foo.xyz')).toBe('Other');
    expect(detectLanguage('Makefile')).toBe('Other');
  });

  it('is case-insensitive', () => {
    expect(detectLanguage('FOO.TS')).toBe('TypeScript');
  });
});

describe('isAnalyzable', () => {
  it('returns true for TS/JS family', () => {
    for (const f of ['a.ts', 'a.tsx', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs']) {
      expect(isAnalyzable(f)).toBe(true);
    }
  });

  it('returns false for everything else', () => {
    for (const f of ['a.py', 'a.md', 'a.json', 'a.txt']) {
      expect(isAnalyzable(f)).toBe(false);
    }
  });
});
