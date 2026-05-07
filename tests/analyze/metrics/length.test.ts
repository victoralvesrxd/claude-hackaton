import { describe, it, expect } from 'vitest';
import {
  analyzeFunctionLengths,
  analyzeFileLength,
} from '../../../src/analyze/metrics/length.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeFunctionLengths', () => {
  it('flags functions exceeding the line threshold', () => {
    const body = Array.from({ length: 12 }, (_, i) => `  const x${i} = ${i};`).join('\n');
    const src = parseSource(`function big() {\n${body}\n}`, 'a.ts');
    const findings = analyzeFunctionLengths(src, 'a.ts', 10);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.value).toBeGreaterThan(10);
  });

  it('does not flag short functions', () => {
    const src = parseSource('function tiny() { return 1; }', 'a.ts');
    expect(analyzeFunctionLengths(src, 'a.ts', 10)).toHaveLength(0);
  });
});

describe('analyzeFileLength', () => {
  it('flags files exceeding the line threshold', () => {
    const lines = Array.from({ length: 50 }, () => 'const x = 1;').join('\n');
    const src = parseSource(lines, 'big.ts');
    const findings = analyzeFileLength(src, 'big.ts', 20);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.value).toBe(50);
  });

  it('does not flag short files', () => {
    const src = parseSource('const x = 1;', 'small.ts');
    expect(analyzeFileLength(src, 'small.ts', 100)).toHaveLength(0);
  });
});
