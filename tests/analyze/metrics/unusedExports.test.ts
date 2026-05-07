import { describe, it, expect } from 'vitest';
import { analyzeUnusedExports } from '../../../src/analyze/metrics/unusedExports.js';
import { parseSources } from '../../helpers/parseSource.js';

describe('analyzeUnusedExports', () => {
  it('flags exports that no other file imports', () => {
    const project = parseSources({
      'a.ts': 'export function used() { return 1; } export function unused() { return 2; }',
      'b.ts': "import { used } from './a'; used();",
    });
    const findings = analyzeUnusedExports(project, '/');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.symbol).toBe('unused');
    expect(findings[0]?.file).toBe('a.ts');
  });

  it('does not flag exports referenced elsewhere', () => {
    const project = parseSources({
      'a.ts': 'export const x = 1;',
      'b.ts': "import { x } from './a'; console.log(x);",
    });
    expect(analyzeUnusedExports(project, '/')).toHaveLength(0);
  });
});
