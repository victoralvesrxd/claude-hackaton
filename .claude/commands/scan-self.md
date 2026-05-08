---
description: Run cscan on its own src/, then triage findings against thresholds
---

You are running the cscan dogfood feedback loop. Steps:

1. From the repo root, run the self-scan:

   ```bash
   npm run scan:self
   ```

   This produces `cscan-report.json` and `cscan-report.md` at the repo root and
   prints a terminal summary. If the build hasn't happened yet, `tsx` runs the
   TS sources directly so no build step is needed.

2. Read `cscan-report.md` and summarise the violation counts by category
   (complexity, longFunctions, deepNesting, longParamLists, magicNumbers,
   unusedExports, todos, duplicates).

3. For each non-zero category, list the top 3 offenders with `file:line` and
   the value vs. threshold. Cite them using the `path:line` convention so the
   user can jump straight to them.

4. Recommend which findings are worth fixing now vs. accepting. Use this
   triage rubric:
   - **Fix now:** complexity > threshold, deep nesting > threshold, long
     functions in core pipeline files, real (non-test) duplicates ≥ 50 tokens.
   - **Defer / accept:** magic numbers that are clearly named constants in
     `config/`, unused exports that are part of the public type surface,
     duplicates inside test fixtures.

5. Do not edit any code in this command. Only triage and report. The user
   decides what to act on.

Stop after the triage report. Do not start fixing without confirmation.
