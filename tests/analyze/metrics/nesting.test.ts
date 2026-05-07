import { describe, it, expect } from 'vitest';
import { analyzeNesting } from '../../../src/analyze/metrics/nesting.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeNesting', () => {
  it('reports max nesting depth per function', () => {
    const src = parseSource(
      `function f(a: number) {
         if (a) {
           while (a > 0) {
             if (a === 1) {
               return 1;
             }
             a--;
           }
         }
         return 0;
       }`,
      'a.ts',
    );
    const findings = analyzeNesting(src, 'a.ts', 2);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.value).toBeGreaterThanOrEqual(3);
  });

  it('does not flag flat functions', () => {
    const src = parseSource('function f(a: number) { if (a) return 1; return 0; }', 'a.ts');
    expect(analyzeNesting(src, 'a.ts', 2)).toHaveLength(0);
  });
});
