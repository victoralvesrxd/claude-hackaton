import { describe, it, expect } from 'vitest';
import { analyzeMagicNumbers, isTestFile } from '../../../src/analyze/metrics/magicNumbers.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeMagicNumbers', () => {
  it('flags numeric literals outside the allowed set', () => {
    const src = parseSource('const x = 42; const y = 3.14; const z = 1;', 'a.ts');
    const findings = analyzeMagicNumbers(src, 'a.ts');
    expect(findings.map((f) => f.value).sort()).toEqual([3.14, 42]);
  });

  it('exempts -1, 0, 1, 2', () => {
    const src = parseSource('const a = -1; const b = 0; const c = 1; const d = 2;', 'a.ts');
    expect(analyzeMagicNumbers(src, 'a.ts')).toHaveLength(0);
  });

  it('does not flag literals in test files', () => {
    const src = parseSource('const x = 999;', 'a.test.ts');
    expect(analyzeMagicNumbers(src, 'a.test.ts')).toHaveLength(0);
  });
});

describe('isTestFile', () => {
  it('matches .test, .spec, and __tests__/', () => {
    expect(isTestFile('foo.test.ts')).toBe(true);
    expect(isTestFile('foo.spec.tsx')).toBe(true);
    expect(isTestFile('__tests__/foo.ts')).toBe(true);
    expect(isTestFile('src/__tests__/foo.ts')).toBe(true);
  });
  it('rejects normal source files', () => {
    expect(isTestFile('foo.ts')).toBe(false);
    expect(isTestFile('src/foo.ts')).toBe(false);
  });
});
