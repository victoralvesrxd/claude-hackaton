# `cscan` — Code Scanner CLI

A TypeScript-native CLI that walks a codebase, extracts metrics, surfaces quality issues, and emits structured reports.

## Goals

1. Walk any directory recursively and produce a per-language file/LOC summary.
2. Run deep AST-level quality analysis on TypeScript and JavaScript files.
3. Emit reports in three formats from a single source of truth: terminal, JSON, Markdown.
4. Be production-ready: typed end-to-end, modular, tested, with proper error handling and CI-friendly exit codes.

## Non-goals

- Polyglot deep analysis (Python/Go/Rust/etc. are counted, not analyzed).
- A configuration file format. Thresholds are set via CLI flags.
- Publishing to npm. The CLI runs locally via the `bin` entry.
- Auto-fixing or refactoring. `cscan` reports; it does not modify code.

## CLI

```bash
cscan <directory> [options]
```

**Positional argument**

| Argument      | Required | Description                          |
|---------------|----------|--------------------------------------|
| `<directory>` | yes      | Path to the codebase to scan.        |

**Options**

| Flag                       | Short | Default | Description                                              |
|----------------------------|-------|---------|----------------------------------------------------------|
| `--json <path>`            | `-j`  | —       | Write JSON report to `<path>`.                           |
| `--markdown <path>`        | `-m`  | —       | Write Markdown report to `<path>`.                       |
| `--max-complexity <n>`     |       | `10`    | Cyclomatic complexity threshold per function.            |
| `--max-function-lines <n>` |       | `50`    | Max lines per function.                                  |
| `--max-file-lines <n>`     |       | `300`   | Max lines per file.                                      |
| `--max-nesting <n>`        |       | `4`     | Max nesting depth inside a function.                     |
| `--max-params <n>`         |       | `4`     | Max parameters per function.                             |
| `--top-n <n>`              | `-n`  | `10`    | Number of worst offenders to show per category.          |
| `--verbose`                | `-v`  | `false` | Log skipped files and warnings to stderr.                |
| `--help`                   | `-h`  |         | Show usage and exit.                                     |
| `--version`                | `-V`  |         | Print version and exit.                                  |

**Exit codes**

| Code | Meaning                                            |
|------|----------------------------------------------------|
| `0`  | Scan completed; no threshold violations.           |
| `1`  | Scan completed; threshold violations found.        |
| `2`  | Fatal error (e.g., target directory does not exist). |

## Architecture

A 5-stage pipeline. Each stage is a pure(-ish) function: takes an input, returns an output. Only the CLI entry and the report stage perform I/O.

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ 1. Discover │──▶│ 2. Classify │──▶│ 3. Analyze  │──▶│ 4. Aggregate│──▶│  5. Report  │
│  (walk all) │   │  (extension │   │  (TS/JS AST │   │  (folding,  │   │ (JSON+TTY+MD│
│             │   │   + LOC)    │   │   + jscpd)  │   │   top-N)    │   │  + exit code│
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

### Stage 1 — Discover

Recursive walk of the target directory, returning absolute paths to **all** files (not just TS/JS).

**Hardcoded skip list** (always skipped, regardless of `.gitignore`):
`.git`, `node_modules`, `__pycache__`, `dist`, `build`, `.next`, `coverage`.

**`.gitignore` support**: if a `.gitignore` exists at the target directory root, its patterns are also applied. Implementation uses the `ignore` npm package.

### Stage 2 — Classify

For every discovered file:

1. Detect language via extension (`.ts`→TypeScript, `.tsx`→TypeScript React, `.js`→JavaScript, `.py`→Python, `.md`→Markdown, etc.).
2. Skip binary files (null-byte heuristic on first 8 KB). Binary files are excluded from `summary` entirely.
3. Stream-count lines on all non-binary files, regardless of size.

(There is no file-size cap at this stage — every text file contributes to `totalFiles` and `totalLines`. The 1 MB cap applies later, in Stage 3, where it skips AST analysis on very large files.)

Produces the `summary` object:

```ts
{
  totalFiles: number;
  totalLines: number;
  languages: Record<string, { files: number; lines: number }>;
}
```

### Stage 3 — Analyze

Runs **only on `.ts/.tsx/.js/.jsx`** files. Files larger than 1 MB are skipped (recorded in `meta.skipped`) — AST parsing of huge files is too expensive and rarely useful. Two parallel sub-phases:

**3a. AST traversal** (`ts-morph`)

Single pass per file. Each file's AST is walked once, and all per-function/per-file metrics are computed during that single walk. Metrics:

| Module                | What it computes                                                  |
|-----------------------|-------------------------------------------------------------------|
| `complexity.ts`       | Cyclomatic complexity per function.                               |
| `length.ts`           | Function length and file length in lines.                         |
| `nesting.ts`          | Max nesting depth inside each function.                           |
| `params.ts`           | Parameter count per function.                                     |
| `magicNumbers.ts`     | Numeric literals other than `-1`, `0`, `1`, `2`. Test files are exempt: filenames matching `*.test.{ts,tsx,js,jsx}`, `*.spec.{ts,tsx,js,jsx}`, or under a `__tests__/` directory. |
| `unusedExports.ts`    | Exported symbols never imported elsewhere in the project.         |
| `todos.ts`            | `TODO` / `FIXME` / `XXX` comments.                                |

Files that fail to parse are skipped and recorded in `analysis.parseErrors`. The run continues.

**3b. Duplication scan** (`jscpd` library)

Run once over the full TS/JS file set. Emits clone groups (≥ 50 tokens, ≥ 5 lines — jscpd defaults).

### Stage 4 — Aggregate

Folds raw findings into the final `Report` object:

- Counts violations per category.
- Computes aggregates (total functions, average/max complexity).
- Records run metadata (target path, timestamp, duration, scanner version, thresholds used, skipped files).
- The full set of findings (every violation, not just top-N) is included on the `Report`. `--top-n` only limits how many rows the human-readable renderers display; JSON always contains the complete list.

### Stage 5 — Report

Three renderers, all reading from the same `Report` object:

- **Terminal** (always): summary block → violations dashboard → top-N tables per category. Uses `chalk` for color and `cli-table3` for tables.
- **JSON** (when `--json <path>` is set): `JSON.stringify(report, null, 2)` to file.
- **Markdown** (when `--markdown <path>` is set): same content as terminal, rendered as Markdown.

Sets the process exit code based on whether any thresholds were violated.

## Data shapes

```ts
interface Report {
  summary: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, { files: number; lines: number }>;
  };

  analysis: {
    filesAnalyzed: number;
    parseErrors: { file: string; message: string }[];
    aggregates: {
      totalFunctions: number;
      avgComplexity: number;
      maxComplexity: number;
    };
    findings: {
      complexity:     Finding[];
      longFunctions:  Finding[];
      deepNesting:    Finding[];
      longParamLists: Finding[];
      magicNumbers:   Finding[];
      unusedExports:  Finding[];
      todos:          Finding[];
      duplicates:     DuplicationFinding[];
    };
    violations: {
      total: number;
      byCategory: Record<string, number>;
    };
  };

  meta: {
    target: string;
    scannedAt: string;       // ISO 8601
    durationMs: number;
    scannerVersion: string;
    thresholds: Thresholds;
    skipped: { file: string; reason: 'binary' | 'too-large' | 'unreadable' }[];
  };
}

interface Finding {
  file: string;       // path relative to target
  line: number;
  endLine?: number;
  symbol?: string;    // function or variable name when applicable
  value: number;      // measured value (complexity score, line count, etc.)
  threshold: number;  // the threshold it exceeded
}

interface DuplicationFinding {
  tokens: number;
  occurrences: { file: string; startLine: number; endLine: number }[];
}

interface Thresholds {
  maxComplexity: number;
  maxFunctionLines: number;
  maxFileLines: number;
  maxNesting: number;
  maxParams: number;
}
```

## Project structure

```
hackaton/
├── src/
│   ├── cli.ts                    # arg parsing, entrypoint, exit codes
│   ├── pipeline.ts               # orchestrates discover→classify→analyze→aggregate→report
│   ├── discover/
│   │   ├── walk.ts               # recursive file walk
│   │   └── ignore.ts             # hardcoded skip list + .gitignore parsing
│   ├── classify/
│   │   ├── extensions.ts         # extension → language map
│   │   └── countLines.ts         # LOC counter + binary detection
│   ├── analyze/
│   │   ├── ast.ts                # ts-morph traversal driver
│   │   ├── metrics/
│   │   │   ├── complexity.ts
│   │   │   ├── length.ts
│   │   │   ├── nesting.ts
│   │   │   ├── params.ts
│   │   │   ├── magicNumbers.ts
│   │   │   ├── unusedExports.ts
│   │   │   └── todos.ts
│   │   └── duplication.ts        # jscpd library wrapper
│   ├── aggregate/
│   │   └── buildReport.ts        # raw findings → Report object
│   ├── report/
│   │   ├── terminal.ts           # chalk + cli-table3
│   │   ├── json.ts
│   │   └── markdown.ts
│   ├── config/
│   │   └── thresholds.ts         # defaults + CLI flag merging
│   ├── types.ts                  # shared domain types
│   └── errors.ts                 # ScannerError class, error categories
├── tests/
│   ├── fixtures/
│   │   ├── clean-project/
│   │   ├── messy-project/
│   │   ├── mixed-languages/
│   │   └── binary-and-large/
│   └── *.test.ts
├── DESIGN.md
├── README.md
├── package.json                  # bin: { "cscan": "./dist/cli.js" }
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── .gitignore
```

Each module has one responsibility and a clear interface. Pipeline stages are pure where possible; only `cli.ts` and `report/*` perform I/O.

## Error handling

Three categories with explicit policies:

| Class            | Examples                                  | Policy                                                                       |
|------------------|-------------------------------------------|------------------------------------------------------------------------------|
| **Fatal**        | Target dir missing, unreadable, not a dir | Print message to stderr, exit code `2`. No partial report.                   |
| **File-level**   | File unreadable, too large, binary        | Skip the file, increment a counter, list in `meta.skipped` in JSON output.   |
| **Parse-level**  | TS/JS file fails to parse                 | Skip AST analysis for that file, push to `analysis.parseErrors`. Run continues. |

Implementation rules:

- One `ScannerError` class with a `kind` discriminator (`'fatal' | 'file' | 'parse'`). Thrown only at fatal boundaries; non-fatal failures are captured as data.
- Async I/O wrapped in try/catch at **stage boundaries** (`discover`, `classify`, `analyze`), not sprinkled throughout.
- The CLI's top-level handler catches `ScannerError` (clean message + appropriate exit code) and unknown errors (full stack trace + "please report this" + exit code `2`).
- `--verbose` promotes file-level skip messages to stderr; otherwise they are silent unless inspected via JSON.

## Testing

**Tooling**: Vitest (fast, native TS, ESM-friendly, built-in snapshot support).

**Three layers:**

1. **Unit tests** — one per metric calculator and per utility module. Each metric is a pure function over a `ts-morph` `SourceFile` (or a parsed snippet), so tests are short and fast:

   ```ts
   it('flags functions whose cyclomatic complexity exceeds the threshold', () => {
     const findings = analyzeComplexity(parseSnippet(`
       function f(a) { if (a) { if (a > 1) { if (a > 2) { return; } } } }
     `), 5);
     expect(findings).toHaveLength(1);
   });
   ```

   Coverage targets: every metric module, the line counter, the ignore matcher, the extension classifier, the threshold merger.

2. **Integration tests** — fixture directories under `tests/fixtures/`:
   - `clean-project/` — should produce zero violations.
   - `messy-project/` — known issues, asserts each is detected.
   - `mixed-languages/` — TS + Python + Markdown; asserts the language summary is correct and only TS is deep-analyzed.
   - `binary-and-large/` — binary files and >1MB files; asserts they are skipped without error.

   Each test runs the full pipeline against a fixture and asserts on the resulting `Report`.

3. **Snapshot tests** — for the terminal, JSON, and Markdown renderers. Feed a fixed `Report` object, snapshot the output. Catches accidental rendering regressions.

**CI**: `pnpm test` (Vitest) + `pnpm typecheck` (`tsc --noEmit`) + `pnpm lint` (ESLint) on every commit.

## Tooling and runtime

- **Runtime**: Node 20+ (uses native `fs/promises`, ESM, top-level await).
- **Language**: TypeScript, strict mode.
- **Package manager**: pnpm.
- **Key dependencies**:
  - `ts-morph` — AST traversal
  - `jscpd` — duplication detection (library, not CLI)
  - `commander` — CLI argument parsing
  - `chalk` — terminal coloring
  - `cli-table3` — terminal tables
  - `ignore` — `.gitignore` pattern matching
- **Dev dependencies**: `vitest`, `typescript`, `eslint`, `@typescript-eslint/*`, `prettier`.
- **License**: MIT.

## Out of scope (for now)

These are deliberate omissions to keep MVP scope tight. Each can be added later without rearchitecting:

- Configuration file (`.cscanrc.json`) — easy to layer on top of the existing CLI flag parsing.
- Additional languages — the analyze stage is isolated; a Python analyzer could plug in alongside the TS/JS one.
- HTML report output — another renderer over the same `Report` object.
- Diff mode (compare two reports) — pure function over two `Report` objects.
- Plugin system for custom metrics — would require formalizing the metric interface, which is currently informal.
