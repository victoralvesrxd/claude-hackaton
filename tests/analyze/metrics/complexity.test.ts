import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../../../src/analyze/metrics/complexity.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeComplexity', () => {
  it('reports complexity 1 for a function with no branches', () => {
    const src = parseSource('function f() { return 1; }', 'a.ts');
    const findings = analyzeComplexity(src, 'a.ts', 5);
    expect(findings).toHaveLength(0);
  });

  it('flags a function whose complexity exceeds the threshold', () => {
    const src = parseSource(
      `function f(a: number) {
         if (a > 0) {
           if (a > 1) {
             if (a > 2) {
               if (a > 3) { return 1; }
             }
           }
         }
         return 0;
       }`,
      'a.ts',
    );
    const findings = analyzeComplexity(src, 'a.ts', 3);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.symbol).toBe('f');
    expect(findings[0]?.value).toBeGreaterThan(3);
    expect(findings[0]?.threshold).toBe(3);
  });

  it('counts logical && and ||', () => {
    const src = parseSource(
      `function f(a: boolean, b: boolean, c: boolean) { return a && b || c; }`,
      'a.ts',
    );
    const findings = analyzeComplexity(src, 'a.ts', 1);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.value).toBe(3); // base 1 + && + ||
  });

  it('handles arrow functions and methods', () => {
    const src = parseSource(
      `class C { m(x: number) { if (x) return 1; return 0; } }
       const fn = (x: number) => x ? 1 : 0;`,
      'a.ts',
    );
    const findings = analyzeComplexity(src, 'a.ts', 1);
    expect(findings).toHaveLength(2);
  });
});
