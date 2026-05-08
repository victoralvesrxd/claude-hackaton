# cscan

A TypeScript-native code scanner CLI. Walks a codebase, classifies files,
runs AST-driven quality analysis on TypeScript / JavaScript sources, and
emits a leadership-readable scorecard graded on Moody's long-term rating
scale (Aaa–C) adapted to code quality.

```
$ npx cscan src

  cscan summary
  -------------
  Total files:      24    Total lines:    2,057
  Total functions:  106   Avg complexity: 3.06

  Violations: 75 across 7 categories
  Overall rating: Baa3 (medium grade)
```

## Why

Static analysis output is usually written for engineers — long tables of
findings, threshold values, file paths. Leadership needs a different
view: one number, one paragraph, and the option to drill in. cscan keeps
the engineer-friendly outputs (terminal table, JSON, Markdown) and adds
an HTML scorecard styled as a Moody's-style rating action so a manager
can read the codebase in 30 seconds.

## Install

Requires Node 20+. From the repo root:

```bash
npm install
npm run build      # optional — tsx runs the sources directly
```

## Usage

```bash
# scan a directory, print to terminal only
npx cscan path/to/src

# emit all four output formats
npx cscan src \
  --json    cscan-report.json \
  --markdown cscan-report.md \
  --html    code-quality.html
```

### Flags

| Flag                  | Alias | Description                                   | Default |
|-----------------------|-------|-----------------------------------------------|---------|
| `--json <path>`       | `-j`  | Write the full report as JSON                 | —       |
| `--markdown <path>`   | `-m`  | Write a Markdown report (top-N tables)        | —       |
| `--html <path>`       | `-H`  | Write the Moody's-style scorecard HTML        | —       |
| `--top-n <n>`         | `-n`  | How many worst offenders per category to show | `10`    |
| `--verbose`           | `-v`  | Log skipped files and warnings to stderr      | off     |
| `--max-complexity`    |       | Cyclomatic complexity threshold per function  | `10`    |
| `--max-function-lines`|       | Max lines per function                        | `50`    |
| `--max-file-lines`    |       | Max lines per file                            | `300`   |
| `--max-nesting`       |       | Max nesting depth                             | `4`     |
| `--max-params`        |       | Max parameters per function                   | `4`     |
| `--version`           | `-V`  | Print scanner version                         | —       |
| `--help`              | `-h`  | Print help                                    | —       |

### Exit codes

- `0` — scan completed, no violations
- `1` — scan completed, one or more violations found
- `2` — fatal error (target missing, unreadable, etc.)

## Output

cscan always prints a terminal summary. Each `--*` flag enables an
additional format. The four outputs share the same in-memory `Report`
shape, so they stay consistent with each other.

| Audience           | Format         | What it's good for                                    |
|--------------------|----------------|--------------------------------------------------------|
| Engineers          | Terminal       | Quick triage in CI logs                                |
| Engineers / tools  | JSON (`-j`)    | Pipeline integrations, diffing across scans            |
| Reviewers          | Markdown (`-m`)| PR comments, design docs                               |
| Managers / leads   | HTML (`-H`)    | Moody's scorecard for non-technical stakeholders       |

### The Moody's-style rating

The HTML scorecard rates the codebase on the 21-tier Moody's long-term
scale, adapted to code quality:

```
Aaa  Aa1 Aa2 Aa3   A1 A2 A3   Baa1 Baa2 Baa3   Ba1 Ba2 Ba3   B1 B2 B3   Caa1 Caa2 Caa3   Ca   C
└── investment grade ──────────────────────┘ └── speculative ─────────────────────────────────┘
```

Each category (complexity, duplication, long functions, deep nesting,
long parameter lists, magic numbers, unused exports, TODOs) is
normalised per 1,000 lines of code. The weighted composite is bucketed
into a tier; the formula is shown transparently in the report's
Methodology panel so leadership can audit how the grade was derived.

## Quality categories

| Category              | What it measures                                                    |
|-----------------------|---------------------------------------------------------------------|
| Cyclomatic complexity | Decision branches per function (`if`, `switch`, `&&`, …)            |
| Long functions        | Function bodies exceeding `--max-function-lines`                    |
| Deep nesting          | Conditionals or loops nested beyond `--max-nesting`                 |
| Long parameter lists  | Functions with more than `--max-params` arguments                   |
| Magic numbers         | Unnamed numeric literals embedded in code                           |
| Code duplication      | Repeated blocks across files (via [jscpd](https://github.com/kucherenko/jscpd)) |
| Unused exports        | Public symbols declared but never imported elsewhere                |
| TODOs                 | `TODO` / `FIXME` / `HACK` / `XXX` markers                           |

Files matching common generated paths (`.git/`, `node_modules/`,
`dist/`, `__pycache__/`, …) and any `.gitignore` patterns at the target
root are skipped. Binary files and unreadable files are skipped with a
recorded reason. Non-TS/JS sources are still counted toward the LOC and
language summary; only TS/JS is analysed at the AST level.

## Development

```bash
npm test            # vitest run, ~75 tests
npm run typecheck   # tsc --noEmit, strict mode
npm run lint        # eslint
npm run scan:self   # dogfood: scan src/ and emit all three reports
```

The dogfood loop is the primary feedback signal. Before declaring a
change complete, `npm run scan:self` should be re-run and any new
findings in the area you touched should be addressed (per `CLAUDE.md`).

There is also a Claude Code slash command at `.claude/commands/scan-self.md`
that runs the dogfood loop and triages findings against a fix-now /
defer rubric.

## Architecture

A 5-stage pipeline: **discover** → **classify** → **analyze** →
**aggregate** → **report**. See `DESIGN.md` for the full design,
trade-offs, and rationale.

```
src/
  cli.ts                  commander entrypoint
  pipeline.ts             orchestrates the 5 stages
  discover/walk.ts        recursive file traversal + ignore matching
  classify/               extension → language, line counts, binary skip
  analyze/                ts-morph AST metrics + jscpd duplication
  aggregate/buildReport   single Report shape consumed by all renderers
  report/                 json | markdown | terminal | html renderers
  config/thresholds.ts    DEFAULT_THRESHOLDS + mergeThresholds
```

## License

MIT.
