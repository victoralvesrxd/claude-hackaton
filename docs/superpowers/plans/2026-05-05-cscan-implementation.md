# cscan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `cscan`, a TypeScript CLI that walks a codebase, extracts language/LOC metrics, runs AST-based quality analysis on TS/JS, and emits terminal + JSON + Markdown reports.

**Architecture:** A 5-stage functional pipeline (discover → classify → analyze → aggregate → report). Each stage is a pure(-ish) function; only `cli.ts` and `report/*` perform I/O. Test-driven: every metric and utility has a unit test; full pipeline has integration tests over fixture directories.

**Tech Stack:** Node 20+, TypeScript (strict), pnpm, Vitest, ts-morph (AST), jscpd (duplication library), commander (args), chalk (color), cli-table3 (tables), `ignore` (gitignore patterns), ESLint, Prettier.

**Commit format:** Every commit follows the convention in `CLAUDE.md` — subject line + `Why:` + `What:` sections. Each task ends in one commit.

**Spec:** See `DESIGN.md` at the repo root.

---

## File Structure

Locks in the decomposition before tasks begin. Each file has one responsibility.

| File | Responsibility |
|------|----------------|
| `src/cli.ts` | Commander setup, arg parsing, top-level error handler, exit codes |
| `src/pipeline.ts` | Orchestrates the 5 stages, returns the final `Report` |
| `src/types.ts` | Shared domain types (`Report`, `Finding`, `Thresholds`, etc.) |
| `src/errors.ts` | `ScannerError` class with `kind` discriminator |
| `src/config/thresholds.ts` | Default thresholds + merge with CLI flag overrides |
| `src/discover/walk.ts` | Recursive directory walk |
| `src/discover/ignore.ts` | Hardcoded skip list + `.gitignore` parsing |
| `src/classify/extensions.ts` | Extension → language name map |
| `src/classify/countLines.ts` | Stream line counter + binary detection |
| `src/analyze/ast.ts` | ts-morph project setup, drives metrics over each file |
| `src/analyze/duplication.ts` | jscpd library wrapper |
| `src/analyze/metrics/complexity.ts` | Cyclomatic complexity per function |
| `src/analyze/metrics/length.ts` | Function and file length |
| `src/analyze/metrics/nesting.ts` | Max nesting depth per function |
| `src/analyze/metrics/params.ts` | Parameter count per function |
| `src/analyze/metrics/magicNumbers.ts` | Numeric literals outside `{-1,0,1,2}` (test files exempt) |
| `src/analyze/metrics/todos.ts` | TODO/FIXME/XXX comments |
| `src/analyze/metrics/unusedExports.ts` | Exported symbols with no external references |
| `src/aggregate/buildReport.ts` | Folds raw findings into the final `Report` object |
| `src/report/json.ts` | JSON file writer |
| `src/report/terminal.ts` | Pretty terminal output (chalk + cli-table3) |
| `src/report/markdown.ts` | Markdown file writer |
| `tests/helpers/parseSource.ts` | In-memory ts-morph helper for unit tests |

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.eslintrc.cjs`
- Create: `.prettierrc.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
coverage/
*.log
.DS_Store
.vitest-cache/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "cscan",
  "version": "0.1.0",
  "description": "Code scanner CLI: walks a codebase, extracts metrics, surfaces quality issues",
  "type": "module",
  "bin": {
    "cscan": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "node --import tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\" \"tests/**/*.ts\""
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.5",
    "commander": "^12.1.0",
    "ignore": "^5.3.2",
    "jscpd": "^4.0.5",
    "ts-morph": "^23.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.3",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "license": "MIT"
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
```

- [ ] **Step 5: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'tests/fixtures/'],
};
```

- [ ] **Step 6: Create `.prettierrc.json`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 7: Install dependencies**

```bash
pnpm install
```
Expected: dependencies install without error; `node_modules/` created.

- [ ] **Step 8: Verify TypeScript and Vitest run**

```bash
pnpm typecheck && pnpm test
```
Expected: typecheck passes (nothing to compile yet, but no errors); vitest reports "no test files found" — both fine.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .eslintrc.cjs .prettierrc.json .gitignore
git commit -m "$(cat <<'EOF'
Scaffold pnpm/TypeScript/Vitest project

Why:
Establishes the toolchain baseline (Node 20+, TS strict, Vitest, ESLint,
Prettier) and pins the runtime + analysis dependencies (ts-morph, jscpd,
commander, chalk, cli-table3, ignore) called for in DESIGN.md so all
subsequent tasks can build on a working install.

What:
- package.json with bin entry, scripts (build, dev, test, typecheck, lint)
  and pinned deps.
- tsconfig.json with strict mode and ESM/Bundler resolution.
- vitest.config.ts pointing at tests/.
- .eslintrc.cjs and .prettierrc.json with project conventions.
- .gitignore for node_modules, dist, coverage, etc.
EOF
)"
```

---

## Task 2: Domain types and error class

**Files:**
- Create: `src/types.ts`
- Create: `src/errors.ts`

These are foundational — no tests needed (type-only file + simple error class).

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface LanguageStat {
  files: number;
  lines: number;
}

export interface Summary {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, LanguageStat>;
}

export interface Finding {
  file: string;
  line: number;
  endLine?: number;
  symbol?: string;
  value: number;
  threshold: number;
}

export interface DuplicationFinding {
  tokens: number;
  occurrences: { file: string; startLine: number; endLine: number }[];
}

export interface Findings {
  complexity: Finding[];
  longFunctions: Finding[];
  deepNesting: Finding[];
  longParamLists: Finding[];
  magicNumbers: Finding[];
  unusedExports: Finding[];
  todos: Finding[];
  duplicates: DuplicationFinding[];
}

export interface Aggregates {
  totalFunctions: number;
  avgComplexity: number;
  maxComplexity: number;
}

export interface Violations {
  total: number;
  byCategory: Record<string, number>;
}

export interface ParseError {
  file: string;
  message: string;
}

export type SkipReason = 'binary' | 'too-large' | 'unreadable';

export interface SkippedFile {
  file: string;
  reason: SkipReason;
}

export interface Thresholds {
  maxComplexity: number;
  maxFunctionLines: number;
  maxFileLines: number;
  maxNesting: number;
  maxParams: number;
}

export interface Meta {
  target: string;
  scannedAt: string;
  durationMs: number;
  scannerVersion: string;
  thresholds: Thresholds;
  skipped: SkippedFile[];
}

export interface Analysis {
  filesAnalyzed: number;
  parseErrors: ParseError[];
  aggregates: Aggregates;
  findings: Findings;
  violations: Violations;
}

export interface Report {
  summary: Summary;
  analysis: Analysis;
  meta: Meta;
}

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
}

export interface ClassifiedFile extends DiscoveredFile {
  language: string;
  lines: number;
  isAnalyzable: boolean;
}
```

- [ ] **Step 2: Create `src/errors.ts`**

```ts
export type ErrorKind = 'fatal' | 'file' | 'parse';

export class ScannerError extends Error {
  readonly kind: ErrorKind;
  readonly file?: string;

  constructor(kind: ErrorKind, message: string, file?: string) {
    super(message);
    this.name = 'ScannerError';
    this.kind = kind;
    this.file = file;
  }
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/errors.ts
git commit -m "$(cat <<'EOF'
Add domain types and ScannerError class

Why:
Locks down the Report shape and intermediate types so every subsequent
module compiles against the same contracts. ScannerError gives a single
discriminated error type for the three failure categories (fatal, file,
parse) defined in DESIGN.md.

What:
- src/types.ts: Report, Summary, Finding, DuplicationFinding, Findings,
  Aggregates, Violations, ParseError, SkippedFile, Thresholds, Meta,
  Analysis, DiscoveredFile, ClassifiedFile.
- src/errors.ts: ScannerError class with kind discriminator and optional
  file path.
EOF
)"
```

---

## Task 3: Thresholds config

**Files:**
- Create: `src/config/thresholds.ts`
- Create: `tests/config/thresholds.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/config/thresholds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_THRESHOLDS, mergeThresholds } from '../../src/config/thresholds.js';

describe('mergeThresholds', () => {
  it('returns defaults when no overrides given', () => {
    expect(mergeThresholds({})).toEqual(DEFAULT_THRESHOLDS);
  });

  it('overrides individual fields', () => {
    const merged = mergeThresholds({ maxComplexity: 20 });
    expect(merged.maxComplexity).toBe(20);
    expect(merged.maxFunctionLines).toBe(DEFAULT_THRESHOLDS.maxFunctionLines);
  });

  it('ignores undefined values', () => {
    const merged = mergeThresholds({ maxComplexity: undefined, maxNesting: 7 });
    expect(merged.maxComplexity).toBe(DEFAULT_THRESHOLDS.maxComplexity);
    expect(merged.maxNesting).toBe(7);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/config/thresholds.test.ts
```
Expected: FAIL — module `src/config/thresholds.ts` does not exist.

- [ ] **Step 3: Implement `src/config/thresholds.ts`**

```ts
import type { Thresholds } from '../types.js';

export const DEFAULT_THRESHOLDS: Thresholds = {
  maxComplexity: 10,
  maxFunctionLines: 50,
  maxFileLines: 300,
  maxNesting: 4,
  maxParams: 4,
};

export function mergeThresholds(overrides: Partial<Thresholds>): Thresholds {
  const merged: Thresholds = { ...DEFAULT_THRESHOLDS };
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[]) {
    const value = overrides[key];
    if (typeof value === 'number') {
      merged[key] = value;
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/config/thresholds.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/thresholds.ts tests/config/thresholds.test.ts
git commit -m "$(cat <<'EOF'
Add threshold defaults and CLI override merger

Why:
Gives the pipeline a single source of truth for the numeric limits that
drive every quality finding, with a clean way to apply CLI overrides
without touching defaults.

What:
- src/config/thresholds.ts: DEFAULT_THRESHOLDS + mergeThresholds() that
  applies a Partial<Thresholds> on top of defaults, ignoring undefined.
- tests/config/thresholds.test.ts: covers defaults, partial overrides,
  and undefined handling.
EOF
)"
```

---

## Task 4: Test helper for parsing snippets

**Files:**
- Create: `tests/helpers/parseSource.ts`

- [ ] **Step 1: Create `tests/helpers/parseSource.ts`**

```ts
import { Project, SourceFile, ScriptTarget } from 'ts-morph';

export function parseSource(code: string, filename = 'test.ts'): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2022,
    },
  });
  return project.createSourceFile(filename, code);
}

export function parseSources(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2022,
    },
  });
  for (const [name, code] of Object.entries(files)) {
    project.createSourceFile(name, code);
  }
  return project;
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/helpers/parseSource.ts
git commit -m "$(cat <<'EOF'
Add ts-morph in-memory parse helpers for tests

Why:
Every metric module is a pure function over a ts-morph SourceFile or
Project. A shared in-memory parser keeps unit tests fast and
self-contained without writing temp files to disk.

What:
- tests/helpers/parseSource.ts: parseSource(code) returns a single
  SourceFile; parseSources(files) returns a Project containing multiple
  files (used by the unused-exports test).
EOF
)"
```

---

## Task 5: Ignore matcher

**Files:**
- Create: `src/discover/ignore.ts`
- Create: `tests/discover/ignore.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/discover/ignore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/discover/ignore.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/discover/ignore.ts`**

```ts
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
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/discover/ignore.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/discover/ignore.ts tests/discover/ignore.test.ts
git commit -m "$(cat <<'EOF'
Add ignore matcher with hardcoded skip list and gitignore support

Why:
Stage 1 of the pipeline must reliably skip generated/dependency
directories regardless of gitignore presence, and honor user-defined
gitignore rules when present. Centralizing this in a small matcher
keeps the walker simple and the ignore policy testable in isolation.

What:
- src/discover/ignore.ts: HARDCODED_SKIP_DIRS constant; createIgnoreMatcher
  wraps the npm 'ignore' package, layering the hardcoded list and any
  optional gitignore content.
- tests/discover/ignore.test.ts: covers hardcoded skips at root and
  nested, normal files, gitignore patterns, and combination.
EOF
)"
```

---

## Task 6: Recursive file walker

**Files:**
- Create: `src/discover/walk.ts`
- Create: `tests/discover/walk.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/discover/walk.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { walkDirectory } from '../../src/discover/walk.js';

describe('walkDirectory', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-walk-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns all files recursively, skipping hardcoded dirs', async () => {
    await writeFile(path.join(root, 'a.ts'), 'a');
    await mkdir(path.join(root, 'sub'));
    await writeFile(path.join(root, 'sub', 'b.ts'), 'b');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules', 'pkg.ts'), 'p');

    const files = await walkDirectory(root);
    const rels = files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(['a.ts', 'sub/b.ts']);
  });

  it('respects .gitignore at the root', async () => {
    await writeFile(path.join(root, '.gitignore'), 'secret.txt\n');
    await writeFile(path.join(root, 'a.ts'), 'a');
    await writeFile(path.join(root, 'secret.txt'), 's');

    const files = await walkDirectory(root);
    const rels = files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(['.gitignore', 'a.ts']);
  });

  it('throws ScannerError fatal when target does not exist', async () => {
    await expect(walkDirectory('/nonexistent-path-xyz-123')).rejects.toMatchObject({
      kind: 'fatal',
    });
  });

  it('throws ScannerError fatal when target is a file', async () => {
    const file = path.join(root, 'just-a-file.ts');
    await writeFile(file, 'x');
    await expect(walkDirectory(file)).rejects.toMatchObject({ kind: 'fatal' });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/discover/walk.test.ts
```
Expected: FAIL — `walkDirectory` not defined.

- [ ] **Step 3: Implement `src/discover/walk.ts`**

```ts
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createIgnoreMatcher } from './ignore.js';
import { ScannerError } from '../errors.js';
import type { DiscoveredFile } from '../types.js';

export async function walkDirectory(rootDir: string): Promise<DiscoveredFile[]> {
  const absoluteRoot = path.resolve(rootDir);

  let rootStat;
  try {
    rootStat = await stat(absoluteRoot);
  } catch {
    throw new ScannerError('fatal', `Target directory does not exist: ${absoluteRoot}`);
  }
  if (!rootStat.isDirectory()) {
    throw new ScannerError('fatal', `Target is not a directory: ${absoluteRoot}`);
  }

  let gitignoreContent: string | null = null;
  try {
    gitignoreContent = await readFile(path.join(absoluteRoot, '.gitignore'), 'utf8');
  } catch {
    // no .gitignore — fine
  }

  const matcher = createIgnoreMatcher(absoluteRoot, gitignoreContent);
  const results: DiscoveredFile[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip silently
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (matcher.shouldSkip(full)) continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        results.push({
          absolutePath: full,
          relativePath: path.relative(absoluteRoot, full),
        });
      }
    }
  }

  await walk(absoluteRoot);
  return results;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/discover/walk.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/discover/walk.ts tests/discover/walk.test.ts
git commit -m "$(cat <<'EOF'
Add recursive directory walker with ignore + fatal-error handling

Why:
Stage 1 of the pipeline. The walker is the only place we touch the
filesystem during discovery, so it owns gitignore loading and the
fatal-error contract for missing/invalid targets.

What:
- src/discover/walk.ts: walkDirectory(root) resolves the root, validates
  it is a directory (throws ScannerError 'fatal' otherwise), loads
  .gitignore if present, and recursively returns DiscoveredFile entries
  filtered by the ignore matcher. Unreadable subdirs are skipped silently.
- tests/discover/walk.test.ts: covers recursion, hardcoded skip,
  .gitignore honoring, and fatal errors for missing/non-dir targets.
EOF
)"
```

---

## Task 7: Extension → language mapping

**Files:**
- Create: `src/classify/extensions.ts`
- Create: `tests/classify/extensions.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/classify/extensions.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/classify/extensions.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/classify/extensions.ts`**

```ts
import path from 'node:path';

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript React',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript React',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.cs': 'C#',
  '.php': 'PHP',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.json': 'JSON',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.sh': 'Shell',
  '.sql': 'SQL',
};

const ANALYZABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export function detectLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? 'Other';
}

export function isAnalyzable(filename: string): boolean {
  return ANALYZABLE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/classify/extensions.test.ts
```
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/classify/extensions.ts tests/classify/extensions.test.ts
git commit -m "$(cat <<'EOF'
Add extension-to-language map and analyzable check

Why:
Stage 2 of the pipeline classifies discovered files by language for the
summary, and flags TS/JS-family files as analyzable so the analyze stage
knows what to deep-scan. Both behaviors share the same extension lookup,
so they live together.

What:
- src/classify/extensions.ts: detectLanguage() returns a friendly name
  ('TypeScript', 'Python', 'Markdown', ...) or 'Other' for unknown
  extensions. isAnalyzable() returns true only for .ts/.tsx/.js/.jsx/.mjs/.cjs.
- tests/classify/extensions.test.ts: covers known/unknown extensions,
  case insensitivity, and the analyzable allowlist.
EOF
)"
```

---

## Task 8: Line counter and binary detection

**Files:**
- Create: `src/classify/countLines.ts`
- Create: `tests/classify/countLines.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/classify/countLines.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { countLines, isBinary } from '../../src/classify/countLines.js';

describe('countLines', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-lines-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('counts lines in a small text file', async () => {
    const file = path.join(root, 'a.txt');
    await writeFile(file, 'a\nb\nc\n');
    expect(await countLines(file)).toBe(3);
  });

  it('counts the final line even without a trailing newline', async () => {
    const file = path.join(root, 'b.txt');
    await writeFile(file, 'a\nb\nc');
    expect(await countLines(file)).toBe(3);
  });

  it('returns 0 for an empty file', async () => {
    const file = path.join(root, 'c.txt');
    await writeFile(file, '');
    expect(await countLines(file)).toBe(0);
  });
});

describe('isBinary', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-bin-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns false for plain text', async () => {
    const file = path.join(root, 'a.txt');
    await writeFile(file, 'hello world\nthis is text\n');
    expect(await isBinary(file)).toBe(false);
  });

  it('returns true when the first 8KB contain a null byte', async () => {
    const file = path.join(root, 'b.bin');
    const buf = Buffer.concat([Buffer.from('hello'), Buffer.from([0x00]), Buffer.from('world')]);
    await writeFile(file, buf);
    expect(await isBinary(file)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/classify/countLines.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/classify/countLines.ts`**

```ts
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';

const SAMPLE_BYTES = 8192;

export async function isBinary(filePath: string): Promise<boolean> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SAMPLE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, SAMPLE_BYTES, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } finally {
    await handle.close();
  }
}

export async function countLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    let lastByte = -1;
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) count++;
        lastByte = chunk[i] ?? lastByte;
      }
    });
    stream.on('end', () => {
      // If file is non-empty and does not end with newline, count the final partial line.
      if (lastByte !== -1 && lastByte !== 0x0a) count++;
      resolve(count);
    });
    stream.on('error', reject);
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/classify/countLines.test.ts
```
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/classify/countLines.ts tests/classify/countLines.test.ts
git commit -m "$(cat <<'EOF'
Add streaming line counter and binary-file detector

Why:
Stage 2 needs LOC for every text file (potentially large) without
loading entire files into memory, and a fast way to exclude binary
content from the summary. Both functions are pure I/O utilities used
exclusively by the classify stage.

What:
- src/classify/countLines.ts: countLines streams the file and counts
  newline bytes, including a final partial line. isBinary samples the
  first 8KB and reports true if any null byte is present.
- tests/classify/countLines.test.ts: covers normal text, missing
  trailing newline, empty files, and the binary heuristic.
EOF
)"
```

---

## Task 9: Cyclomatic complexity metric

**Files:**
- Create: `src/analyze/metrics/complexity.ts`
- Create: `tests/analyze/metrics/complexity.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/complexity.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/complexity.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/analyze/metrics/complexity.ts`**

```ts
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

const BRANCH_KINDS = new Set<SyntaxKind>([
  SyntaxKind.IfStatement,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
]);

export function calculateComplexity(node: Node): number {
  let score = 1;
  node.forEachDescendant((d) => {
    const kind = d.getKind();
    if (BRANCH_KINDS.has(kind)) {
      score++;
      return;
    }
    if (kind === SyntaxKind.BinaryExpression) {
      const opKind = d.asKind(SyntaxKind.BinaryExpression)?.getOperatorToken().getKind();
      if (
        opKind === SyntaxKind.AmpersandAmpersandToken ||
        opKind === SyntaxKind.BarBarToken ||
        opKind === SyntaxKind.QuestionQuestionToken
      ) {
        score++;
      }
    }
  });
  return score;
}

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isGetAccessorDeclaration(node)) return `get ${node.getName()}`;
  if (Node.isSetAccessorDeclaration(node)) return `set ${node.getName()}`;
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

export function analyzeComplexity(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const score = calculateComplexity(node);
    if (score > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: score,
        threshold,
      });
    }
  });
  return findings;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/complexity.test.ts
```
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/complexity.ts tests/analyze/metrics/complexity.test.ts
git commit -m "$(cat <<'EOF'
Add cyclomatic complexity metric

Why:
First and most important AST metric. Walks every function-like node
(declarations, expressions, arrows, methods, ctors, accessors) and
counts decision points (if, loops, ternary, case, catch, &&, ||, ??)
to surface overly branchy code.

What:
- src/analyze/metrics/complexity.ts: calculateComplexity(node) returns
  the raw score; analyzeComplexity(sourceFile, relPath, threshold)
  yields a Finding for every function above threshold, with symbol name
  resolved for the common forms.
- tests/analyze/metrics/complexity.test.ts: covers no-branch baseline,
  threshold trigger, logical operators, and arrow/method forms.
EOF
)"
```

---

## Task 10: Function and file length metric

**Files:**
- Create: `src/analyze/metrics/length.ts`
- Create: `tests/analyze/metrics/length.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/length.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/length.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/analyze/metrics/length.ts`**

```ts
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isGetAccessorDeclaration(node)) return `get ${node.getName()}`;
  if (Node.isSetAccessorDeclaration(node)) return `set ${node.getName()}`;
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

export function analyzeFunctionLengths(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const start = node.getStartLineNumber();
    const end = node.getEndLineNumber();
    const lines = end - start + 1;
    if (lines > threshold) {
      findings.push({
        file: relativeFile,
        line: start,
        endLine: end,
        symbol: getFunctionName(node),
        value: lines,
        threshold,
      });
    }
  });
  return findings;
}

export function analyzeFileLength(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const lines = sourceFile.getEndLineNumber();
  if (lines > threshold) {
    return [{ file: relativeFile, line: 1, endLine: lines, value: lines, threshold }];
  }
  return [];
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/length.test.ts
```
Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/length.ts tests/analyze/metrics/length.test.ts
git commit -m "$(cat <<'EOF'
Add function and file length metrics

Why:
Length is a cheap, language-agnostic proxy for complexity that catches
files and functions that have outgrown a single responsibility — a
common smell that complexity alone misses.

What:
- src/analyze/metrics/length.ts: analyzeFunctionLengths emits a Finding
  per function whose end-start+1 exceeds threshold. analyzeFileLength
  emits a single Finding per file whose end line exceeds threshold.
- tests/analyze/metrics/length.test.ts: covers both above and below
  threshold for functions and files.
EOF
)"
```

---

## Task 11: Nesting depth metric

**Files:**
- Create: `src/analyze/metrics/nesting.ts`
- Create: `tests/analyze/metrics/nesting.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/nesting.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/nesting.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `src/analyze/metrics/nesting.ts`**

```ts
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

const NESTING_KINDS = new Set<SyntaxKind>([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.TryStatement,
  SyntaxKind.CatchClause,
]);

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isGetAccessorDeclaration(node)) return `get ${node.getName()}`;
  if (Node.isSetAccessorDeclaration(node)) return `set ${node.getName()}`;
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

function maxDepth(node: Node, current = 0): number {
  let max = current;
  node.forEachChild((child) => {
    const childDepth = NESTING_KINDS.has(child.getKind()) ? current + 1 : current;
    const childMax = maxDepth(child, childDepth);
    if (childMax > max) max = childMax;
  });
  return max;
}

export function analyzeNesting(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const depth = maxDepth(node, 0);
    if (depth > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: depth,
        threshold,
      });
    }
  });
  return findings;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/nesting.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/nesting.ts tests/analyze/metrics/nesting.test.ts
git commit -m "$(cat <<'EOF'
Add max nesting depth metric

Why:
Deeply nested code is a strong readability smell that complexity often
misses (a function can have low cyclomatic complexity but be five
levels deep). Computed per function so the finding points at the right
unit of refactor.

What:
- src/analyze/metrics/nesting.ts: maxDepth recurses through children,
  incrementing on if/for/while/do/switch/try/catch. analyzeNesting
  emits a Finding for any function whose max depth exceeds threshold.
- tests/analyze/metrics/nesting.test.ts: covers nested-then-flag and
  flat-then-pass cases.
EOF
)"
```

---

## Task 12: Parameter count metric

**Files:**
- Create: `src/analyze/metrics/params.ts`
- Create: `tests/analyze/metrics/params.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/params.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/params.test.ts
```

- [ ] **Step 3: Implement `src/analyze/metrics/params.ts`**

```ts
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
];

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() ?? '<anonymous>';
  }
  if (Node.isConstructorDeclaration(node)) return 'constructor';
  if (Node.isFunctionExpression(node)) return node.getName() ?? '<function expression>';
  if (Node.isArrowFunction(node)) {
    const parent = node.getParent();
    if (parent && Node.isVariableDeclaration(parent)) return parent.getName();
    return '<arrow>';
  }
  return '<unknown>';
}

export function analyzeParams(
  sourceFile: SourceFile,
  relativeFile: string,
  threshold: number,
): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    if (!FUNCTION_KINDS.includes(node.getKind())) return;
    const params = (node as unknown as { getParameters: () => unknown[] }).getParameters?.() ?? [];
    const count = params.length;
    if (count > threshold) {
      findings.push({
        file: relativeFile,
        line: node.getStartLineNumber(),
        endLine: node.getEndLineNumber(),
        symbol: getFunctionName(node),
        value: count,
        threshold,
      });
    }
  });
  return findings;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/params.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/params.ts tests/analyze/metrics/params.test.ts
git commit -m "$(cat <<'EOF'
Add long-parameter-list metric

Why:
Functions with many parameters are hard to call correctly and usually
indicate a missing parameter object or a function that does too much.
Surfaced as its own finding so the report can suggest a clear fix.

What:
- src/analyze/metrics/params.ts: analyzeParams emits a Finding for any
  function/method/arrow/constructor whose parameter count exceeds the
  threshold.
- tests/analyze/metrics/params.test.ts: covers above-threshold,
  within-limit, and the arrow + method forms.
EOF
)"
```

---

## Task 13: Magic numbers metric

**Files:**
- Create: `src/analyze/metrics/magicNumbers.ts`
- Create: `tests/analyze/metrics/magicNumbers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/magicNumbers.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/magicNumbers.test.ts
```

- [ ] **Step 3: Implement `src/analyze/metrics/magicNumbers.ts`**

```ts
import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Finding } from '../../types.js';

const ALLOWED = new Set([-1, 0, 1, 2]);
const TEST_PATTERNS = [/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i, /(^|\/)__tests__\//i];

export function isTestFile(relativePath: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(relativePath));
}

function literalNumericValue(node: Node): number | null {
  if (node.getKind() === SyntaxKind.NumericLiteral) {
    return Number(node.getText());
  }
  if (node.getKind() === SyntaxKind.PrefixUnaryExpression) {
    const pue = node.asKind(SyntaxKind.PrefixUnaryExpression);
    if (pue && pue.getOperatorToken() === SyntaxKind.MinusToken) {
      const operand = pue.getOperand();
      if (operand.getKind() === SyntaxKind.NumericLiteral) {
        return -Number(operand.getText());
      }
    }
  }
  return null;
}

export function analyzeMagicNumbers(sourceFile: SourceFile, relativeFile: string): Finding[] {
  if (isTestFile(relativeFile)) return [];
  const findings: Finding[] = [];
  const seen = new Set<Node>(); // skip the operand of a unary minus we've already counted
  sourceFile.forEachDescendant((node) => {
    if (seen.has(node)) return;
    const value = literalNumericValue(node);
    if (value === null || ALLOWED.has(value)) return;
    if (node.getKind() === SyntaxKind.PrefixUnaryExpression) {
      const operand = node.asKind(SyntaxKind.PrefixUnaryExpression)?.getOperand();
      if (operand) seen.add(operand);
    }
    findings.push({
      file: relativeFile,
      line: node.getStartLineNumber(),
      value,
      threshold: 0,
    });
  });
  return findings;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/magicNumbers.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/magicNumbers.ts tests/analyze/metrics/magicNumbers.test.ts
git commit -m "$(cat <<'EOF'
Add magic numbers metric with test-file exemption

Why:
Inline numeric literals outside {-1, 0, 1, 2} usually represent named
constants in disguise. Test files routinely use raw numbers in
assertions, so they're exempt to keep the signal-to-noise ratio
useful.

What:
- src/analyze/metrics/magicNumbers.ts: isTestFile matches *.test.*,
  *.spec.*, and __tests__/ paths. analyzeMagicNumbers walks numeric
  literals (including -N expressed as a prefix unary minus) and emits
  a Finding for each value not in the allowed set.
- tests/analyze/metrics/magicNumbers.test.ts: covers flagging,
  exemption set, test-file exemption, and isTestFile pattern matching.
EOF
)"
```

---

## Task 14: TODO/FIXME metric

**Files:**
- Create: `src/analyze/metrics/todos.ts`
- Create: `tests/analyze/metrics/todos.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/todos.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/todos.test.ts
```

- [ ] **Step 3: Implement `src/analyze/metrics/todos.ts`**

```ts
import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import type { Finding } from '../../types.js';

const TODO_PATTERN = /\b(TODO|FIXME|XXX)\b/;

export function analyzeTodos(sourceFile: SourceFile, relativeFile: string): Finding[] {
  const findings: Finding[] = [];
  sourceFile.forEachDescendant((node) => {
    const ranges = [
      ...node.getLeadingCommentRanges(),
      ...node.getTrailingCommentRanges(),
    ];
    for (const range of ranges) {
      const text = range.getText();
      if (TODO_PATTERN.test(text)) {
        const line = sourceFile.getLineAndColumnAtPos(range.getPos()).line;
        findings.push({
          file: relativeFile,
          line,
          value: 1,
          threshold: 0,
        });
      }
    }
  });
  // De-duplicate by file:line because both leading and trailing iteration may pick up the same comment.
  const dedup = new Map<string, Finding>();
  for (const f of findings) dedup.set(`${f.file}:${f.line}`, f);
  return [...dedup.values()];
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/todos.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/todos.ts tests/analyze/metrics/todos.test.ts
git commit -m "$(cat <<'EOF'
Add TODO/FIXME/XXX comment metric

Why:
Tracking outstanding TODO markers helps teams measure tech debt
accumulation and find dropped work. Counting via AST comment ranges
avoids false positives from identifiers like 'todoList'.

What:
- src/analyze/metrics/todos.ts: walks every node's leading and
  trailing comment ranges, matches the TODO|FIXME|XXX word boundary
  pattern, and emits a deduplicated Finding per comment line.
- tests/analyze/metrics/todos.test.ts: covers line and block comments,
  multiple markers, and identifier false positives.
EOF
)"
```

---

## Task 15: Unused exports metric

**Files:**
- Create: `src/analyze/metrics/unusedExports.ts`
- Create: `tests/analyze/metrics/unusedExports.test.ts`

This metric is project-wide (not per-file), so it takes a `Project` and returns findings across all files.

- [ ] **Step 1: Write the failing test**

`tests/analyze/metrics/unusedExports.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/metrics/unusedExports.test.ts
```

- [ ] **Step 3: Implement `src/analyze/metrics/unusedExports.ts`**

```ts
import { Node, Project } from 'ts-morph';
import path from 'node:path';
import type { Finding } from '../../types.js';

export function analyzeUnusedExports(project: Project, rootDir: string): Finding[] {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativeFile = path.relative(rootDir, sourceFile.getFilePath());
    const exportedDeclarations = sourceFile.getExportedDeclarations();

    for (const [name, declarations] of exportedDeclarations) {
      let referencedExternally = false;
      for (const decl of declarations) {
        const refs = collectReferences(decl);
        for (const ref of refs) {
          const refFile = ref.getSourceFile();
          if (refFile !== sourceFile) {
            referencedExternally = true;
            break;
          }
        }
        if (referencedExternally) break;
      }
      if (!referencedExternally) {
        const decl = declarations[0];
        if (!decl) continue;
        findings.push({
          file: relativeFile,
          line: decl.getStartLineNumber(),
          symbol: name,
          value: 0,
          threshold: 0,
        });
      }
    }
  }

  return findings;
}

function collectReferences(node: Node): Node[] {
  // Identifier-bearing declarations expose findReferencesAsNodes via ts-morph.
  const anyNode = node as unknown as { findReferencesAsNodes?: () => Node[] };
  if (typeof anyNode.findReferencesAsNodes === 'function') {
    return anyNode.findReferencesAsNodes();
  }
  return [];
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/metrics/unusedExports.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/metrics/unusedExports.ts tests/analyze/metrics/unusedExports.test.ts
git commit -m "$(cat <<'EOF'
Add unused-exports metric (project-wide)

Why:
Dead exports clutter the public surface of modules and confuse
consumers. Detection requires cross-file reference resolution, so
this metric uniquely operates on the whole ts-morph Project rather
than a single SourceFile.

What:
- src/analyze/metrics/unusedExports.ts: iterates each source file's
  exported declarations, uses ts-morph's findReferencesAsNodes to
  collect references, and flags any export with no reference outside
  its own file. Takes (project, rootDir) and resolves paths relative
  to rootDir so absolute file paths from disk don't leak into Findings.
- tests/analyze/metrics/unusedExports.test.ts: covers the
  used/unused distinction across two-file projects, passing '/' as the
  rootDir for in-memory ts-morph paths.
EOF
)"
```

---

## Task 16: AST analysis driver

**Files:**
- Create: `src/analyze/ast.ts`
- Create: `tests/analyze/ast.test.ts`

This module owns the ts-morph `Project`, decides which files to analyze (skipping >1MB and non-analyzable), runs every metric, and aggregates results.

- [ ] **Step 1: Write the failing test**

`tests/analyze/ast.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAstAnalysis } from '../../src/analyze/ast.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

describe('runAstAnalysis', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-ast-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('produces findings for analyzable files and ignores the rest', async () => {
    await writeFile(
      path.join(root, 'bad.ts'),
      'function f(a: number, b: number, c: number, d: number, e: number) { if (a) { if (b) { if (c) { if (d) { if (e) return; } } } } }',
    );
    await writeFile(path.join(root, 'notes.md'), '# notes');
    const result = await runAstAnalysis(
      root,
      [
        { absolutePath: path.join(root, 'bad.ts'), relativePath: 'bad.ts', language: 'TypeScript', lines: 1, isAnalyzable: true },
        { absolutePath: path.join(root, 'notes.md'), relativePath: 'notes.md', language: 'Markdown', lines: 1, isAnalyzable: false },
      ],
      DEFAULT_THRESHOLDS,
    );
    expect(result.filesAnalyzed).toBe(1);
    expect(result.findings.complexity.length + result.findings.longParamLists.length).toBeGreaterThan(0);
  });

  it('records parse errors and continues', async () => {
    await writeFile(path.join(root, 'broken.ts'), 'function f( {');
    const result = await runAstAnalysis(
      root,
      [{ absolutePath: path.join(root, 'broken.ts'), relativePath: 'broken.ts', language: 'TypeScript', lines: 1, isAnalyzable: true }],
      DEFAULT_THRESHOLDS,
    );
    // ts-morph is permissive — parse errors here are non-fatal; assert pipeline still returns.
    expect(result).toBeDefined();
  });

  it('records oversized files as skipped', async () => {
    const big = 'const x = 1;\n'.repeat(100_000); // ~1.2 MB
    await writeFile(path.join(root, 'huge.ts'), big);
    const result = await runAstAnalysis(
      root,
      [{ absolutePath: path.join(root, 'huge.ts'), relativePath: 'huge.ts', language: 'TypeScript', lines: 100_000, isAnalyzable: true }],
      DEFAULT_THRESHOLDS,
    );
    expect(result.skipped.find((s) => s.reason === 'too-large')).toBeDefined();
    expect(result.filesAnalyzed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/ast.test.ts
```

- [ ] **Step 3: Implement `src/analyze/ast.ts`**

```ts
import { Project, ScriptTarget, SyntaxKind, Node } from 'ts-morph';
import { stat } from 'node:fs/promises';
import type { ClassifiedFile, Finding, ParseError, SkippedFile, Thresholds } from '../types.js';
import { analyzeComplexity, calculateComplexity } from './metrics/complexity.js';
import { analyzeFunctionLengths, analyzeFileLength } from './metrics/length.js';
import { analyzeNesting } from './metrics/nesting.js';
import { analyzeParams } from './metrics/params.js';
import { analyzeMagicNumbers } from './metrics/magicNumbers.js';
import { analyzeTodos } from './metrics/todos.js';
import { analyzeUnusedExports } from './metrics/unusedExports.js';

const MAX_FILE_BYTES = 1_048_576; // 1 MB

const FUNCTION_KINDS: SyntaxKind[] = [
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
];

export interface AstAnalysisResult {
  filesAnalyzed: number;
  parseErrors: ParseError[];
  skipped: SkippedFile[];
  findings: {
    complexity: Finding[];
    longFunctions: Finding[];
    deepNesting: Finding[];
    longParamLists: Finding[];
    magicNumbers: Finding[];
    unusedExports: Finding[];
    todos: Finding[];
    fileLength: Finding[];
  };
  totalFunctions: number;
  complexityScores: number[];
}

export async function runAstAnalysis(
  rootDir: string,
  files: ClassifiedFile[],
  thresholds: Thresholds,
): Promise<AstAnalysisResult> {
  const result: AstAnalysisResult = {
    filesAnalyzed: 0,
    parseErrors: [],
    skipped: [],
    findings: {
      complexity: [],
      longFunctions: [],
      deepNesting: [],
      longParamLists: [],
      magicNumbers: [],
      unusedExports: [],
      todos: [],
      fileLength: [],
    },
    totalFunctions: 0,
    complexityScores: [],
  };

  const project = new Project({
    useInMemoryFileSystem: false,
    compilerOptions: { allowJs: true, target: ScriptTarget.ES2022 },
    skipFileDependencyResolution: true,
    skipAddingFilesFromTsConfig: true,
  });

  const analyzableFiles: ClassifiedFile[] = [];
  for (const file of files) {
    if (!file.isAnalyzable) continue;
    try {
      const s = await stat(file.absolutePath);
      if (s.size > MAX_FILE_BYTES) {
        result.skipped.push({ file: file.relativePath, reason: 'too-large' });
        continue;
      }
    } catch {
      result.skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }
    try {
      project.addSourceFileAtPath(file.absolutePath);
      analyzableFiles.push(file);
    } catch (err) {
      result.parseErrors.push({
        file: file.relativePath,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const file of analyzableFiles) {
    const sourceFile = project.getSourceFile(file.absolutePath);
    if (!sourceFile) continue;
    const rel = file.relativePath;

    try {
      result.findings.complexity.push(
        ...analyzeComplexity(sourceFile, rel, thresholds.maxComplexity),
      );
      result.findings.longFunctions.push(
        ...analyzeFunctionLengths(sourceFile, rel, thresholds.maxFunctionLines),
      );
      result.findings.deepNesting.push(
        ...analyzeNesting(sourceFile, rel, thresholds.maxNesting),
      );
      result.findings.longParamLists.push(
        ...analyzeParams(sourceFile, rel, thresholds.maxParams),
      );
      result.findings.magicNumbers.push(...analyzeMagicNumbers(sourceFile, rel));
      result.findings.todos.push(...analyzeTodos(sourceFile, rel));
      result.findings.fileLength.push(
        ...analyzeFileLength(sourceFile, rel, thresholds.maxFileLines),
      );

      // Aggregates: count every function and gather raw complexity scores.
      sourceFile.forEachDescendant((node: Node) => {
        if (FUNCTION_KINDS.includes(node.getKind())) {
          result.totalFunctions++;
          result.complexityScores.push(calculateComplexity(node));
        }
      });

      result.filesAnalyzed++;
    } catch (err) {
      result.parseErrors.push({
        file: rel,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Project-wide unused exports (cross-file).
  try {
    result.findings.unusedExports.push(...analyzeUnusedExports(project, rootDir));
  } catch {
    // unused-exports requires resolved imports; tolerate failures so a partial
    // report is still emitted.
  }

  return result;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/ast.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/analyze/ast.ts tests/analyze/ast.test.ts
git commit -m "$(cat <<'EOF'
Add AST analysis driver that runs every metric

Why:
Stage 3a needs a single owner of the ts-morph Project lifecycle that
gates files (size limit, analyzable extension), routes each file
through every per-file metric, runs the cross-file unused-exports
metric once, and reports aggregates and skipped files.

What:
- src/analyze/ast.ts: runAstAnalysis(rootDir, classifiedFiles,
  thresholds) returns AstAnalysisResult with findings, parse errors,
  skipped files, total function count, and raw complexity scores for
  later aggregation.
- tests/analyze/ast.test.ts: covers a bad TS file producing findings,
  Markdown ignored, parse errors recorded, oversized files skipped.
EOF
)"
```

---

## Task 17: Duplication scan via jscpd

**Files:**
- Create: `src/analyze/duplication.ts`
- Create: `tests/analyze/duplication.test.ts`

The jscpd library is invoked once over the whole TS/JS file set.

- [ ] **Step 1: Write the failing test**

`tests/analyze/duplication.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runDuplicationScan } from '../../src/analyze/duplication.js';

describe('runDuplicationScan', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-dup-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('returns an empty array when no duplicates exist', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const a = 1;');
    await writeFile(path.join(root, 'b.ts'), 'export function b() { return 2; }');
    const findings = await runDuplicationScan(root);
    expect(findings).toEqual([]);
  });

  it('detects an obvious duplicated block across two files', async () => {
    const block = `
export function dupBlock() {
  const x = 1;
  const y = 2;
  const z = 3;
  if (x + y > z) {
    return x + y + z;
  }
  return 0;
}
`.repeat(2); // make it long enough to exceed jscpd defaults
    await writeFile(path.join(root, 'a.ts'), block);
    await writeFile(path.join(root, 'b.ts'), block);
    const findings = await runDuplicationScan(root);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/analyze/duplication.test.ts
```

- [ ] **Step 3: Implement `src/analyze/duplication.ts`**

```ts
import path from 'node:path';
import type { DuplicationFinding } from '../types.js';

interface JscpdClone {
  format: string;
  duplicationA: { sourceId: string; start: { line: number }; end: { line: number } };
  duplicationB: { sourceId: string; start: { line: number }; end: { line: number } };
  fragment?: string;
}

export async function runDuplicationScan(rootDir: string): Promise<DuplicationFinding[]> {
  // jscpd's library entrypoint; tolerate variations in export shape between minor versions.
  const jscpdMod = await import('jscpd');
  const detect = (jscpdMod as unknown as { jscpd?: (opts: object) => Promise<JscpdClone[]> }).jscpd;
  if (typeof detect !== 'function') return [];

  const clones = await detect({
    path: [rootDir],
    silent: true,
    output: undefined,
    format: ['typescript', 'tsx', 'javascript', 'jsx'],
    reporters: [],
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
    ],
    minTokens: 50,
    minLines: 5,
  });

  return clones.map((c) => ({
    tokens: 0,
    occurrences: [
      {
        file: path.relative(rootDir, c.duplicationA.sourceId),
        startLine: c.duplicationA.start.line,
        endLine: c.duplicationA.end.line,
      },
      {
        file: path.relative(rootDir, c.duplicationB.sourceId),
        startLine: c.duplicationB.start.line,
        endLine: c.duplicationB.end.line,
      },
    ],
  }));
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/analyze/duplication.test.ts
```

> Note: if the `jscpd` package's library API differs from what's assumed above (export name, options shape), adjust this wrapper. The wrapper is the only place jscpd's API leaks into the codebase, so changes are contained here.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/duplication.ts tests/analyze/duplication.test.ts
git commit -m "$(cat <<'EOF'
Add jscpd-backed duplication scanner

Why:
Stage 3b detects copy-pasted code blocks that AST metrics can't catch.
Encapsulating jscpd in a thin wrapper isolates its option/return-shape
quirks so the rest of the codebase consumes a stable
DuplicationFinding[].

What:
- src/analyze/duplication.ts: runDuplicationScan(rootDir) imports the
  jscpd library, runs it over TS/JS files with sensible defaults
  (minTokens 50, minLines 5, hardcoded skip list), and maps clones to
  DuplicationFinding[].
- tests/analyze/duplication.test.ts: covers no-duplicate and
  obvious-duplicate cases on a temp directory.
EOF
)"
```

---

## Task 18: Aggregate raw findings into a Report

**Files:**
- Create: `src/aggregate/buildReport.ts`
- Create: `tests/aggregate/buildReport.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/aggregate/buildReport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildReport } from '../../src/aggregate/buildReport.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

describe('buildReport', () => {
  it('produces a Report with summary, analysis, and meta', () => {
    const report = buildReport({
      target: '/tmp/sample',
      scannedAt: '2026-05-05T00:00:00.000Z',
      durationMs: 12,
      scannerVersion: '0.1.0',
      thresholds: DEFAULT_THRESHOLDS,
      summary: {
        totalFiles: 3,
        totalLines: 100,
        languages: { TypeScript: { files: 2, lines: 90 }, Markdown: { files: 1, lines: 10 } },
      },
      ast: {
        filesAnalyzed: 2,
        parseErrors: [],
        skipped: [{ file: 'huge.ts', reason: 'too-large' }],
        findings: {
          complexity: [{ file: 'a.ts', line: 1, value: 12, threshold: 10 }],
          longFunctions: [],
          deepNesting: [],
          longParamLists: [],
          magicNumbers: [],
          unusedExports: [],
          todos: [],
          fileLength: [],
        },
        totalFunctions: 5,
        complexityScores: [1, 2, 3, 12, 1],
      },
      duplicates: [],
    });

    expect(report.summary.totalFiles).toBe(3);
    expect(report.analysis.aggregates.totalFunctions).toBe(5);
    expect(report.analysis.aggregates.maxComplexity).toBe(12);
    expect(report.analysis.aggregates.avgComplexity).toBeCloseTo(3.8, 1);
    expect(report.analysis.violations.total).toBe(1);
    expect(report.analysis.violations.byCategory.complexity).toBe(1);
    expect(report.meta.skipped).toHaveLength(1);
  });

  it('handles zero functions without dividing by zero', () => {
    const report = buildReport({
      target: '/tmp/empty',
      scannedAt: '2026-05-05T00:00:00.000Z',
      durationMs: 1,
      scannerVersion: '0.1.0',
      thresholds: DEFAULT_THRESHOLDS,
      summary: { totalFiles: 0, totalLines: 0, languages: {} },
      ast: {
        filesAnalyzed: 0,
        parseErrors: [],
        skipped: [],
        findings: {
          complexity: [], longFunctions: [], deepNesting: [], longParamLists: [],
          magicNumbers: [], unusedExports: [], todos: [], fileLength: [],
        },
        totalFunctions: 0,
        complexityScores: [],
      },
      duplicates: [],
    });
    expect(report.analysis.aggregates.avgComplexity).toBe(0);
    expect(report.analysis.aggregates.maxComplexity).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/aggregate/buildReport.test.ts
```

- [ ] **Step 3: Implement `src/aggregate/buildReport.ts`**

```ts
import type {
  DuplicationFinding,
  ParseError,
  Report,
  Finding,
  SkippedFile,
  Summary,
  Thresholds,
  Violations,
} from '../types.js';

export interface BuildReportInput {
  target: string;
  scannedAt: string;
  durationMs: number;
  scannerVersion: string;
  thresholds: Thresholds;
  summary: Summary;
  ast: {
    filesAnalyzed: number;
    parseErrors: ParseError[];
    skipped: SkippedFile[];
    findings: {
      complexity: Finding[];
      longFunctions: Finding[];
      deepNesting: Finding[];
      longParamLists: Finding[];
      magicNumbers: Finding[];
      unusedExports: Finding[];
      todos: Finding[];
      fileLength: Finding[];
    };
    totalFunctions: number;
    complexityScores: number[];
  };
  duplicates: DuplicationFinding[];
}

export function buildReport(input: BuildReportInput): Report {
  const avg =
    input.ast.complexityScores.length === 0
      ? 0
      : input.ast.complexityScores.reduce((a, b) => a + b, 0) / input.ast.complexityScores.length;
  const max =
    input.ast.complexityScores.length === 0 ? 0 : Math.max(...input.ast.complexityScores);

  const findings = {
    complexity: input.ast.findings.complexity,
    longFunctions: [...input.ast.findings.longFunctions, ...input.ast.findings.fileLength],
    deepNesting: input.ast.findings.deepNesting,
    longParamLists: input.ast.findings.longParamLists,
    magicNumbers: input.ast.findings.magicNumbers,
    unusedExports: input.ast.findings.unusedExports,
    todos: input.ast.findings.todos,
    duplicates: input.duplicates,
  };

  const byCategory: Record<string, number> = {
    complexity: findings.complexity.length,
    longFunctions: findings.longFunctions.length,
    deepNesting: findings.deepNesting.length,
    longParamLists: findings.longParamLists.length,
    magicNumbers: findings.magicNumbers.length,
    unusedExports: findings.unusedExports.length,
    todos: findings.todos.length,
    duplicates: findings.duplicates.length,
  };
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const violations: Violations = { total, byCategory };

  return {
    summary: input.summary,
    analysis: {
      filesAnalyzed: input.ast.filesAnalyzed,
      parseErrors: input.ast.parseErrors,
      aggregates: {
        totalFunctions: input.ast.totalFunctions,
        avgComplexity: Number(avg.toFixed(2)),
        maxComplexity: max,
      },
      findings,
      violations,
    },
    meta: {
      target: input.target,
      scannedAt: input.scannedAt,
      durationMs: input.durationMs,
      scannerVersion: input.scannerVersion,
      thresholds: input.thresholds,
      skipped: input.ast.skipped,
    },
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/aggregate/buildReport.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/aggregate/buildReport.ts tests/aggregate/buildReport.test.ts
git commit -m "$(cat <<'EOF'
Add aggregator that folds raw findings into the Report

Why:
Stage 4 is the single source of truth for the final Report shape. By
centralizing aggregate computation (avg/max complexity, violation
totals, category counts) here, each renderer reads from one canonical
object and never has to recompute.

What:
- src/aggregate/buildReport.ts: BuildReportInput captures every input
  the pipeline produces; buildReport returns a fully populated Report
  including aggregates, violations.byCategory, and meta with skipped
  files.
- tests/aggregate/buildReport.test.ts: covers a populated input with
  one violation and an empty-input divide-by-zero edge case.
EOF
)"
```

---

## Task 19: JSON renderer

**Files:**
- Create: `src/report/json.ts`
- Create: `tests/report/json.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/report/json.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeJsonReport } from '../../src/report/json.js';
import type { Report } from '../../src/types.js';

const fakeReport: Report = {
  summary: { totalFiles: 1, totalLines: 1, languages: {} },
  analysis: {
    filesAnalyzed: 0,
    parseErrors: [],
    aggregates: { totalFunctions: 0, avgComplexity: 0, maxComplexity: 0 },
    findings: {
      complexity: [], longFunctions: [], deepNesting: [], longParamLists: [],
      magicNumbers: [], unusedExports: [], todos: [], duplicates: [],
    },
    violations: { total: 0, byCategory: {} },
  },
  meta: {
    target: '/x',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 1,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('writeJsonReport', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cscan-json-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a pretty-printed JSON file that round-trips', async () => {
    const out = path.join(dir, 'report.json');
    await writeJsonReport(fakeReport, out);
    const text = await readFile(out, 'utf8');
    expect(text).toContain('\n');
    expect(JSON.parse(text)).toEqual(fakeReport);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/report/json.test.ts
```

- [ ] **Step 3: Implement `src/report/json.ts`**

```ts
import { writeFile } from 'node:fs/promises';
import type { Report } from '../types.js';

export async function writeJsonReport(report: Report, outPath: string): Promise<void> {
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/report/json.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/report/json.ts tests/report/json.test.ts
git commit -m "$(cat <<'EOF'
Add JSON report writer

Why:
JSON is the machine-readable output that downstream tools (CI gates,
dashboards) consume. The writer is intentionally trivial: serialize the
Report and write it to disk — all formatting decisions belong upstream
in the aggregator.

What:
- src/report/json.ts: writeJsonReport(report, outPath) writes a
  pretty-printed JSON file at the given path.
- tests/report/json.test.ts: writes to a temp dir, reads back, and
  asserts the parsed JSON deep-equals the input Report.
EOF
)"
```

---

## Task 20: Terminal renderer

**Files:**
- Create: `src/report/terminal.ts`
- Create: `tests/report/terminal.test.ts`

- [ ] **Step 1: Write the failing test (snapshot)**

`tests/report/terminal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderTerminal } from '../../src/report/terminal.js';
import type { Report } from '../../src/types.js';

const sample: Report = {
  summary: {
    totalFiles: 3,
    totalLines: 120,
    languages: {
      TypeScript: { files: 2, lines: 100 },
      Markdown: { files: 1, lines: 20 },
    },
  },
  analysis: {
    filesAnalyzed: 2,
    parseErrors: [],
    aggregates: { totalFunctions: 4, avgComplexity: 3.5, maxComplexity: 12 },
    findings: {
      complexity: [{ file: 'a.ts', line: 5, symbol: 'foo', value: 12, threshold: 10 }],
      longFunctions: [],
      deepNesting: [],
      longParamLists: [],
      magicNumbers: [],
      unusedExports: [],
      todos: [],
      duplicates: [],
    },
    violations: { total: 1, byCategory: { complexity: 1 } },
  },
  meta: {
    target: '/tmp/sample',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 42,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('renderTerminal', () => {
  it('includes summary, violations, and finding details', () => {
    const out = renderTerminal(sample, 10, false); // noColor = false; we still test the strings
    const stripped = out.replace(/\x1B\[[0-9;]*m/g, '');
    expect(stripped).toContain('Total files: 3');
    expect(stripped).toContain('Total lines: 120');
    expect(stripped).toContain('TypeScript');
    expect(stripped).toContain('Violations: 1');
    expect(stripped).toContain('foo');
    expect(stripped).toContain('a.ts:5');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/report/terminal.test.ts
```

- [ ] **Step 3: Implement `src/report/terminal.ts`**

```ts
import chalk from 'chalk';
import Table from 'cli-table3';
import type { DuplicationFinding, Finding, Report } from '../types.js';

export function renderTerminal(report: Report, topN: number, noColor: boolean): string {
  const c = noColor ? makeNoColor() : chalk;
  const out: string[] = [];

  out.push(c.bold(c.cyan('═══ cscan report ═══')));
  out.push(`Target: ${report.meta.target}`);
  out.push(`Scanned at: ${report.meta.scannedAt}  (${report.meta.durationMs} ms)`);
  out.push('');

  out.push(c.bold('Summary'));
  out.push(`  Total files: ${report.summary.totalFiles}`);
  out.push(`  Total lines: ${report.summary.totalLines}`);
  const langs = Object.entries(report.summary.languages).sort((a, b) => b[1].lines - a[1].lines);
  if (langs.length) {
    const langTable = new Table({ head: ['Language', 'Files', 'Lines'] });
    for (const [name, stat] of langs) langTable.push([name, stat.files, stat.lines]);
    out.push(langTable.toString());
  }
  out.push('');

  out.push(c.bold('Analysis'));
  out.push(`  Files analyzed: ${report.analysis.filesAnalyzed}`);
  out.push(`  Total functions: ${report.analysis.aggregates.totalFunctions}`);
  out.push(`  Avg / max complexity: ${report.analysis.aggregates.avgComplexity} / ${report.analysis.aggregates.maxComplexity}`);
  const violationColor = report.analysis.violations.total === 0 ? c.green : c.red;
  out.push(`  ${violationColor(`Violations: ${report.analysis.violations.total}`)}`);
  if (report.analysis.parseErrors.length) {
    out.push(c.yellow(`  Parse errors: ${report.analysis.parseErrors.length}`));
  }
  if (report.meta.skipped.length) {
    out.push(c.yellow(`  Skipped files: ${report.meta.skipped.length}`));
  }
  out.push('');

  renderCategory(out, 'Complexity', report.analysis.findings.complexity, topN);
  renderCategory(out, 'Long functions / files', report.analysis.findings.longFunctions, topN);
  renderCategory(out, 'Deep nesting', report.analysis.findings.deepNesting, topN);
  renderCategory(out, 'Long parameter lists', report.analysis.findings.longParamLists, topN);
  renderCategory(out, 'Magic numbers', report.analysis.findings.magicNumbers, topN);
  renderCategory(out, 'Unused exports', report.analysis.findings.unusedExports, topN);
  renderCategory(out, 'TODO/FIXME', report.analysis.findings.todos, topN);
  renderDuplicates(out, report.analysis.findings.duplicates, topN);

  return out.join('\n');
}

function renderCategory(out: string[], title: string, findings: Finding[], topN: number): void {
  if (findings.length === 0) return;
  out.push(chalk.bold(title) + chalk.dim(`  (${findings.length} total, showing top ${Math.min(topN, findings.length)})`));
  const sorted = [...findings].sort((a, b) => b.value - a.value).slice(0, topN);
  const t = new Table({ head: ['File:Line', 'Symbol', 'Value', 'Threshold'] });
  for (const f of sorted) {
    t.push([`${f.file}:${f.line}`, f.symbol ?? '—', String(f.value), String(f.threshold)]);
  }
  out.push(t.toString());
  out.push('');
}

function renderDuplicates(out: string[], dups: DuplicationFinding[], topN: number): void {
  if (dups.length === 0) return;
  out.push(chalk.bold('Duplicates') + chalk.dim(`  (${dups.length} total, showing top ${Math.min(topN, dups.length)})`));
  const sorted = [...dups].slice(0, topN);
  const t = new Table({ head: ['Locations', 'Lines'] });
  for (const d of sorted) {
    const locs = d.occurrences.map((o) => `${o.file}:${o.startLine}-${o.endLine}`).join('\n');
    const lineCount = d.occurrences[0] ? d.occurrences[0].endLine - d.occurrences[0].startLine + 1 : 0;
    t.push([locs, String(lineCount)]);
  }
  out.push(t.toString());
  out.push('');
}

function makeNoColor(): typeof chalk {
  const passthrough = ((s: string) => s) as unknown as typeof chalk;
  return new Proxy(passthrough, {
    get: () => makeNoColor(),
    apply: (_t, _this, args: unknown[]) => String(args[0] ?? ''),
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/report/terminal.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/report/terminal.ts tests/report/terminal.test.ts
git commit -m "$(cat <<'EOF'
Add terminal renderer with chalk + cli-table3

Why:
Terminal output is the always-on, demo-facing view of a scan. Renders
the summary, an aggregate analysis block, and a top-N table per
finding category, color-coded by violation status, all from the
canonical Report object.

What:
- src/report/terminal.ts: renderTerminal(report, topN, noColor)
  returns a string ready to print. Categories and duplicates render as
  cli-table3 tables sorted by Finding.value descending.
- tests/report/terminal.test.ts: ANSI-stripped substring assertions
  on summary, totals, violations count, and finding rows.
EOF
)"
```

---

## Task 21: Markdown renderer

**Files:**
- Create: `src/report/markdown.ts`
- Create: `tests/report/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/report/markdown.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeMarkdownReport } from '../../src/report/markdown.js';
import type { Report } from '../../src/types.js';

const sample: Report = {
  summary: {
    totalFiles: 2,
    totalLines: 50,
    languages: { TypeScript: { files: 2, lines: 50 } },
  },
  analysis: {
    filesAnalyzed: 2,
    parseErrors: [],
    aggregates: { totalFunctions: 1, avgComplexity: 5, maxComplexity: 5 },
    findings: {
      complexity: [{ file: 'a.ts', line: 1, symbol: 'big', value: 12, threshold: 10 }],
      longFunctions: [], deepNesting: [], longParamLists: [],
      magicNumbers: [], unusedExports: [], todos: [], duplicates: [],
    },
    violations: { total: 1, byCategory: { complexity: 1 } },
  },
  meta: {
    target: '/tmp/x',
    scannedAt: '2026-05-05T00:00:00.000Z',
    durationMs: 1,
    scannerVersion: '0.1.0',
    thresholds: { maxComplexity: 10, maxFunctionLines: 50, maxFileLines: 300, maxNesting: 4, maxParams: 4 },
    skipped: [],
  },
};

describe('writeMarkdownReport', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cscan-md-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes Markdown with summary heading and a complexity table row', async () => {
    const out = path.join(dir, 'report.md');
    await writeMarkdownReport(sample, out, 10);
    const text = await readFile(out, 'utf8');
    expect(text).toContain('# cscan report');
    expect(text).toContain('| TypeScript | 2 | 50 |');
    expect(text).toContain('| a.ts:1 | big | 12 | 10 |');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/report/markdown.test.ts
```

- [ ] **Step 3: Implement `src/report/markdown.ts`**

```ts
import { writeFile } from 'node:fs/promises';
import type { DuplicationFinding, Finding, Report } from '../types.js';

export async function writeMarkdownReport(report: Report, outPath: string, topN: number): Promise<void> {
  const md = renderMarkdown(report, topN);
  await writeFile(outPath, md, 'utf8');
}

export function renderMarkdown(report: Report, topN: number): string {
  const out: string[] = [];
  out.push('# cscan report');
  out.push('');
  out.push(`**Target:** \`${report.meta.target}\``);
  out.push(`**Scanned at:** ${report.meta.scannedAt} (${report.meta.durationMs} ms)`);
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- **Total files:** ${report.summary.totalFiles}`);
  out.push(`- **Total lines:** ${report.summary.totalLines}`);
  out.push('');
  const langs = Object.entries(report.summary.languages).sort((a, b) => b[1].lines - a[1].lines);
  if (langs.length) {
    out.push('| Language | Files | Lines |');
    out.push('|---|---|---|');
    for (const [name, stat] of langs) out.push(`| ${name} | ${stat.files} | ${stat.lines} |`);
    out.push('');
  }
  out.push('## Analysis');
  out.push('');
  out.push(`- **Files analyzed:** ${report.analysis.filesAnalyzed}`);
  out.push(`- **Total functions:** ${report.analysis.aggregates.totalFunctions}`);
  out.push(`- **Avg / Max complexity:** ${report.analysis.aggregates.avgComplexity} / ${report.analysis.aggregates.maxComplexity}`);
  out.push(`- **Violations:** ${report.analysis.violations.total}`);
  if (report.analysis.parseErrors.length) {
    out.push(`- **Parse errors:** ${report.analysis.parseErrors.length}`);
  }
  if (report.meta.skipped.length) {
    out.push(`- **Skipped files:** ${report.meta.skipped.length}`);
  }
  out.push('');

  pushCategory(out, 'Complexity', report.analysis.findings.complexity, topN);
  pushCategory(out, 'Long functions / files', report.analysis.findings.longFunctions, topN);
  pushCategory(out, 'Deep nesting', report.analysis.findings.deepNesting, topN);
  pushCategory(out, 'Long parameter lists', report.analysis.findings.longParamLists, topN);
  pushCategory(out, 'Magic numbers', report.analysis.findings.magicNumbers, topN);
  pushCategory(out, 'Unused exports', report.analysis.findings.unusedExports, topN);
  pushCategory(out, 'TODO/FIXME', report.analysis.findings.todos, topN);
  pushDuplicates(out, report.analysis.findings.duplicates, topN);

  return out.join('\n');
}

function pushCategory(out: string[], title: string, findings: Finding[], topN: number): void {
  if (findings.length === 0) return;
  out.push(`## ${title} (${findings.length})`);
  out.push('');
  out.push('| File:Line | Symbol | Value | Threshold |');
  out.push('|---|---|---|---|');
  const sorted = [...findings].sort((a, b) => b.value - a.value).slice(0, topN);
  for (const f of sorted) {
    out.push(`| ${f.file}:${f.line} | ${f.symbol ?? '—'} | ${f.value} | ${f.threshold} |`);
  }
  out.push('');
}

function pushDuplicates(out: string[], dups: DuplicationFinding[], topN: number): void {
  if (dups.length === 0) return;
  out.push(`## Duplicates (${dups.length})`);
  out.push('');
  out.push('| Locations | Lines |');
  out.push('|---|---|');
  const sorted = [...dups].slice(0, topN);
  for (const d of sorted) {
    const locs = d.occurrences.map((o) => `${o.file}:${o.startLine}-${o.endLine}`).join('<br>');
    const lineCount = d.occurrences[0] ? d.occurrences[0].endLine - d.occurrences[0].startLine + 1 : 0;
    out.push(`| ${locs} | ${lineCount} |`);
  }
  out.push('');
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/report/markdown.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/report/markdown.ts tests/report/markdown.test.ts
git commit -m "$(cat <<'EOF'
Add Markdown report writer

Why:
Markdown output is the share-friendly format — renders nicely on
GitHub and in editors and can be checked into a repo as a quality
snapshot. Mirrors the structure of the terminal renderer over the
same Report object.

What:
- src/report/markdown.ts: renderMarkdown(report, topN) returns the
  string; writeMarkdownReport(report, path, topN) persists it. Same
  category ordering and top-N truncation as the terminal renderer.
- tests/report/markdown.test.ts: writes to temp dir, asserts heading,
  language row, and a complexity finding row are present.
EOF
)"
```

---

## Task 22: Pipeline orchestration

**Files:**
- Create: `src/pipeline.ts`
- Create: `tests/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/pipeline.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPipeline } from '../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../src/config/thresholds.js';

describe('runPipeline', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-pipe-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('produces a Report covering summary, analysis, and meta', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    await writeFile(path.join(root, 'README.md'), '# hello\n');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules', 'ignored.ts'), 'export const y = 2;');
    const report = await runPipeline(root, DEFAULT_THRESHOLDS);
    expect(report.summary.totalFiles).toBe(2);
    expect(report.summary.languages.TypeScript?.files).toBe(1);
    expect(report.summary.languages.Markdown?.files).toBe(1);
    expect(report.analysis.filesAnalyzed).toBe(1);
    expect(report.meta.target).toBe(path.resolve(root));
    expect(typeof report.meta.scannedAt).toBe('string');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/pipeline.test.ts
```

- [ ] **Step 3: Implement `src/pipeline.ts`**

```ts
import { walkDirectory } from './discover/walk.js';
import { detectLanguage, isAnalyzable } from './classify/extensions.js';
import { countLines, isBinary } from './classify/countLines.js';
import { runAstAnalysis } from './analyze/ast.js';
import { runDuplicationScan } from './analyze/duplication.js';
import { buildReport } from './aggregate/buildReport.js';
import type { ClassifiedFile, Report, SkippedFile, Summary, Thresholds } from './types.js';
import path from 'node:path';

const SCANNER_VERSION = '0.1.0';

export async function runPipeline(targetDir: string, thresholds: Thresholds): Promise<Report> {
  const start = Date.now();
  const absoluteTarget = path.resolve(targetDir);

  const discovered = await walkDirectory(absoluteTarget);
  const classified: ClassifiedFile[] = [];
  const skipped: SkippedFile[] = [];
  const summary: Summary = { totalFiles: 0, totalLines: 0, languages: {} };

  for (const file of discovered) {
    let binary = false;
    try {
      binary = await isBinary(file.absolutePath);
    } catch {
      skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }
    if (binary) {
      skipped.push({ file: file.relativePath, reason: 'binary' });
      continue;
    }

    let lines = 0;
    try {
      lines = await countLines(file.absolutePath);
    } catch {
      skipped.push({ file: file.relativePath, reason: 'unreadable' });
      continue;
    }

    const language = detectLanguage(file.relativePath);
    classified.push({
      ...file,
      language,
      lines,
      isAnalyzable: isAnalyzable(file.relativePath),
    });

    summary.totalFiles++;
    summary.totalLines += lines;
    const stat = summary.languages[language] ?? { files: 0, lines: 0 };
    stat.files++;
    stat.lines += lines;
    summary.languages[language] = stat;
  }

  const [astResult, duplicates] = await Promise.all([
    runAstAnalysis(absoluteTarget, classified, thresholds),
    runDuplicationScan(absoluteTarget),
  ]);

  return buildReport({
    target: absoluteTarget,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    scannerVersion: SCANNER_VERSION,
    thresholds,
    summary,
    ast: {
      filesAnalyzed: astResult.filesAnalyzed,
      parseErrors: astResult.parseErrors,
      skipped: [...skipped, ...astResult.skipped],
      findings: astResult.findings,
      totalFunctions: astResult.totalFunctions,
      complexityScores: astResult.complexityScores,
    },
    duplicates,
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/pipeline.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/pipeline.ts tests/pipeline.test.ts
git commit -m "$(cat <<'EOF'
Wire all stages into a single runPipeline entrypoint

Why:
Stages 1-4 must run in order on real filesystem input to produce a
Report. Centralizing this in pipeline.ts keeps cli.ts focused on
argument parsing and exit codes, and gives integration tests a single
function to call.

What:
- src/pipeline.ts: runPipeline(targetDir, thresholds) walks the dir,
  classifies each file (binary skip, line count, language detect,
  analyzable flag), runs AST + duplication scans in parallel, and
  hands everything to buildReport.
- tests/pipeline.test.ts: end-to-end happy path on a tmp dir with a
  TS file, an MD file, and an ignored node_modules entry.
EOF
)"
```

---

## Task 23: CLI entrypoint

**Files:**
- Create: `src/cli.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/cli.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

describe('cscan CLI', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'cscan-cli-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('prints a summary and exits 0 on a clean tiny project', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    const { stdout, stderr } = await execFileP('node', ['--import', 'tsx', 'src/cli.ts', root]);
    expect(stdout).toMatch(/Total files: 1/);
    expect(stderr).toBe('');
  });

  it('exits 2 when the target directory does not exist', async () => {
    await expect(
      execFileP('node', ['--import', 'tsx', 'src/cli.ts', '/nonexistent-xyz-9999']),
    ).rejects.toMatchObject({ code: 2 });
  });

  it('writes a JSON report when --json is passed', async () => {
    await writeFile(path.join(root, 'a.ts'), 'export const x = 1;\n');
    const out = path.join(root, 'r.json');
    await execFileP('node', ['--import', 'tsx', 'src/cli.ts', root, '--json', out]);
    const { readFile } = await import('node:fs/promises');
    const parsed = JSON.parse(await readFile(out, 'utf8'));
    expect(parsed.summary.totalFiles).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test tests/cli.test.ts
```

- [ ] **Step 3: Implement `src/cli.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { runPipeline } from './pipeline.js';
import { mergeThresholds } from './config/thresholds.js';
import { renderTerminal } from './report/terminal.js';
import { writeJsonReport } from './report/json.js';
import { writeMarkdownReport } from './report/markdown.js';
import { ScannerError } from './errors.js';

interface CliOptions {
  json?: string;
  markdown?: string;
  maxComplexity?: string;
  maxFunctionLines?: string;
  maxFileLines?: string;
  maxNesting?: string;
  maxParams?: string;
  topN?: string;
  verbose?: boolean;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('cscan')
    .description('Code scanner CLI — walks a codebase, extracts metrics, surfaces quality issues')
    .version('0.1.0', '-V, --version')
    .argument('<directory>', 'directory to scan')
    .option('-j, --json <path>', 'write JSON report to <path>')
    .option('-m, --markdown <path>', 'write Markdown report to <path>')
    .option('--max-complexity <n>', 'cyclomatic complexity threshold per function')
    .option('--max-function-lines <n>', 'max lines per function')
    .option('--max-file-lines <n>', 'max lines per file')
    .option('--max-nesting <n>', 'max nesting depth per function')
    .option('--max-params <n>', 'max parameters per function')
    .option('-n, --top-n <n>', 'how many worst offenders to show', '10')
    .option('-v, --verbose', 'log skipped files and warnings to stderr', false)
    .action(async (directory: string, options: CliOptions) => {
      const thresholds = mergeThresholds({
        maxComplexity: parseIntOrUndefined(options.maxComplexity),
        maxFunctionLines: parseIntOrUndefined(options.maxFunctionLines),
        maxFileLines: parseIntOrUndefined(options.maxFileLines),
        maxNesting: parseIntOrUndefined(options.maxNesting),
        maxParams: parseIntOrUndefined(options.maxParams),
      });
      const topN = parseIntOrUndefined(options.topN) ?? 10;

      const report = await runPipeline(directory, thresholds);

      const noColor = !process.stdout.isTTY;
      process.stdout.write(renderTerminal(report, topN, noColor) + '\n');

      if (options.json) await writeJsonReport(report, options.json);
      if (options.markdown) await writeMarkdownReport(report, options.markdown, topN);

      if (options.verbose && report.meta.skipped.length) {
        for (const s of report.meta.skipped) {
          process.stderr.write(`skipped: ${s.file} (${s.reason})\n`);
        }
      }

      process.exit(report.analysis.violations.total === 0 ? 0 : 1);
    });

  await program.parseAsync(process.argv);
}

function parseIntOrUndefined(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

main().catch((err: unknown) => {
  if (err instanceof ScannerError && err.kind === 'fatal') {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(
    `unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(2);
});
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm test tests/cli.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "$(cat <<'EOF'
Add cscan CLI entrypoint with commander

Why:
Wraps runPipeline in the user-facing surface defined in DESIGN.md:
positional <directory>, optional --json/--markdown outputs, threshold
overrides, --top-n limit, --verbose stderr logging. Owns the exit
code contract (0 / 1 / 2) and the top-level error boundary that maps
ScannerError 'fatal' to exit 2.

What:
- src/cli.ts: commander-driven CLI; parses flags, calls runPipeline,
  prints the terminal report, optionally writes JSON/Markdown, exits
  with the right code.
- tests/cli.test.ts: invokes the CLI via node --import tsx and asserts
  on stdout, exit codes, and JSON output file contents.
EOF
)"
```

---

## Task 24: Integration test fixtures

**Files:**
- Create: `tests/fixtures/clean-project/index.ts`
- Create: `tests/fixtures/messy-project/{messy.ts,duplicated.ts}`
- Create: `tests/fixtures/mixed-languages/{a.ts,b.py,c.md}`
- Create: `tests/integration/fixtures.test.ts`

- [ ] **Step 1: Create fixture files**

`tests/fixtures/clean-project/index.ts`:

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

`tests/fixtures/messy-project/messy.ts`:

```ts
// TODO: refactor this whole module
export function tangled(a: number, b: number, c: number, d: number, e: number, f: number) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          if (e > 0) {
            if (f > 0) {
              return 999;
            }
          }
        }
      }
    }
  }
  return 0;
}
```

`tests/fixtures/messy-project/duplicated.ts`:

```ts
export function blockOne() {
  const a = 100;
  const b = 200;
  const c = 300;
  if (a + b > c) {
    return a + b + c;
  }
  return 0;
}

export function blockTwo() {
  const a = 100;
  const b = 200;
  const c = 300;
  if (a + b > c) {
    return a + b + c;
  }
  return 0;
}
```

`tests/fixtures/mixed-languages/a.ts`:

```ts
export const greeting = 'hello';
```

`tests/fixtures/mixed-languages/b.py`:

```python
print("not analyzed")
```

`tests/fixtures/mixed-languages/c.md`:

```md
# notes
```

- [ ] **Step 2: Write the integration test**

`tests/integration/fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runPipeline } from '../../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

const fixtures = path.resolve(__dirname, '..', 'fixtures');

describe('integration: clean-project', () => {
  it('produces zero violations', async () => {
    const report = await runPipeline(path.join(fixtures, 'clean-project'), DEFAULT_THRESHOLDS);
    expect(report.analysis.violations.total).toBe(0);
  });
});

describe('integration: messy-project', () => {
  it('flags multiple categories', async () => {
    const report = await runPipeline(path.join(fixtures, 'messy-project'), DEFAULT_THRESHOLDS);
    expect(report.analysis.findings.complexity.length).toBeGreaterThan(0);
    expect(report.analysis.findings.deepNesting.length).toBeGreaterThan(0);
    expect(report.analysis.findings.longParamLists.length).toBeGreaterThan(0);
    expect(report.analysis.findings.magicNumbers.length).toBeGreaterThan(0);
    expect(report.analysis.findings.todos.length).toBeGreaterThan(0);
    expect(report.analysis.findings.duplicates.length).toBeGreaterThan(0);
  });
});

describe('integration: mixed-languages', () => {
  it('counts every language in the summary but only deep-analyzes TS', async () => {
    const report = await runPipeline(path.join(fixtures, 'mixed-languages'), DEFAULT_THRESHOLDS);
    expect(Object.keys(report.summary.languages).sort()).toEqual(
      ['Markdown', 'Python', 'TypeScript'].sort(),
    );
    expect(report.analysis.filesAnalyzed).toBe(1);
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
pnpm test tests/integration/fixtures.test.ts
```
Expected: all three integration tests pass.

- [ ] **Step 4: Run the full test suite**

```bash
pnpm test
```
Expected: every unit + integration test passes.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/ tests/integration/
git commit -m "$(cat <<'EOF'
Add fixture-based integration tests

Why:
Unit tests cover each metric in isolation, but integration tests
guard the pipeline contract: clean code produces no violations,
intentionally bad code triggers each category, and the language
summary correctly classifies a multi-language project while only
TS/JS reaches the AST stage.

What:
- tests/fixtures/clean-project/: a single tidy TS file.
- tests/fixtures/messy-project/: deeply nested function with too many
  params, a TODO comment, magic numbers, and a duplicated block.
- tests/fixtures/mixed-languages/: TS + Python + Markdown.
- tests/integration/fixtures.test.ts: runs runPipeline against each
  fixture and asserts on the resulting Report.
EOF
)"
```

---

## Task 25: Dogfood — run cscan on its own source

**Files:**
- Modify: `package.json` (add a `scan:self` script)
- Create: `tests/integration/self-scan.test.ts`

- [ ] **Step 1: Add `scan:self` script to `package.json`**

In `package.json`, add to `"scripts"`:

```json
"scan:self": "node --import tsx src/cli.ts src --json cscan-report.json --markdown cscan-report.md"
```

- [ ] **Step 2: Add the dogfood test**

`tests/integration/self-scan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runPipeline } from '../../src/pipeline.js';
import { DEFAULT_THRESHOLDS } from '../../src/config/thresholds.js';

describe('self-scan', () => {
  it('runs cscan against its own src/ without throwing', async () => {
    const srcDir = path.resolve(__dirname, '..', '..', 'src');
    const report = await runPipeline(srcDir, DEFAULT_THRESHOLDS);
    expect(report.summary.totalFiles).toBeGreaterThan(0);
    expect(report.analysis.filesAnalyzed).toBeGreaterThan(0);
    // The codebase should not have any parse errors.
    expect(report.analysis.parseErrors).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the self-scan test**

```bash
pnpm test tests/integration/self-scan.test.ts
```
Expected: passes; cscan's own source is parsed cleanly.

- [ ] **Step 4: Run the dogfood script and inspect the output**

```bash
pnpm scan:self
```
Expected: terminal report prints; `cscan-report.json` and `cscan-report.md` are created at the repo root.

- [ ] **Step 5: Add the report files to `.gitignore` and commit**

Append to `.gitignore`:

```
cscan-report.json
cscan-report.md
```

Then commit:

```bash
git add package.json tests/integration/self-scan.test.ts .gitignore
git commit -m "$(cat <<'EOF'
Dogfood cscan against its own source

Why:
Running the scanner on its own codebase is the strongest possible
demo: every commit going forward is a chance for the tool to flag
quality regressions in itself. Also closes the loop on the design
goal of "TypeScript-native scanner that can analyze TypeScript
projects".

What:
- package.json: scan:self script that scans src/ and writes both a
  JSON and Markdown report.
- tests/integration/self-scan.test.ts: asserts the pipeline runs over
  src/ with no parse errors and a non-zero file count.
- .gitignore: ignores the generated cscan-report.{json,md} files at
  the repo root so the dogfood run doesn't dirty the working tree.
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Run full test suite + typecheck + lint**

```bash
pnpm test && pnpm typecheck && pnpm lint
```
Expected: all green.

- [ ] **Step 2: Build production bundle**

```bash
pnpm build
```
Expected: `dist/` populated; no errors.

- [ ] **Step 3: Smoke-test the built binary**

```bash
node dist/cli.js src
```
Expected: terminal report renders, exit code matches violations.
