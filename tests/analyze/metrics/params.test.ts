import { describe, it, expect } from 'vitest';
import { analyzeParams } from '../../../src/analyze/metrics/params.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeParams', () => {
  it('flags functions with too many parameters', () => {
    const src = parseSource('function f(a: number, b: number, c: number, d: number, e: number) {}', 'a.ts');
    const findings = analyzeParams(src, 'a.ts', 3);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.value).toBe(5);
  });

  it('does not flag functions within the limit', () => {
    const src = parseSource('function f(a: number, b: number) {}', 'a.ts');
    expect(analyzeParams(src, 'a.ts', 3)).toHaveLength(0);
  });

  it('handles arrow functions and methods', () => {
    const src = parseSource(
      `class C { m(a: number, b: number, c: number, d: number, e: number) {} }
       const fn = (a: number, b: number, c: number, d: number, e: number) => 0;`,
      'a.ts',
    );
    expect(analyzeParams(src, 'a.ts', 3)).toHaveLength(2);
  });
});
