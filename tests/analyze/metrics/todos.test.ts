import { describe, it, expect } from 'vitest';
import { analyzeTodos } from '../../../src/analyze/metrics/todos.js';
import { parseSource } from '../../helpers/parseSource.js';

describe('analyzeTodos', () => {
  it('finds line and block comments containing TODO/FIXME/XXX', () => {
    const src = parseSource(
      `// TODO: rewrite this
       /* FIXME: leaks memory */
       // XXX dangerous
       // just a comment`,
      'a.ts',
    );
    const findings = analyzeTodos(src, 'a.ts');
    expect(findings).toHaveLength(3);
  });

  it('does not flag the words inside identifiers', () => {
    const src = parseSource('const todoList = [];', 'a.ts');
    expect(analyzeTodos(src, 'a.ts')).toHaveLength(0);
  });
});
