# Project conventions

## Git commits

Every commit in this repository must follow the company commit convention:

1. **Subject line** — a short, imperative summary of the change (≤ 72 characters).
2. **Body** — two labeled sections, in this order:
   - `Why:` — the motivation for the change (the problem, requirement, or decision driving it).
   - `What:` — a concise list of what was actually changed.

This format applies to every commit, including small ones. No exceptions.

### Example

```
Add Code Ratings design document

Why:
Establishes the architecture and scope for the code scanner CLI before
implementation begins. Captures the agreed decisions (TS-only analysis,
ts-morph + jscpd, three report formats) so future work has a single
source of truth.

What:
- New DESIGN.md covering goals, CLI shape, the 5-stage pipeline, data
  shapes, project structure, error handling, and testing strategy.
```

## Test-driven development

For every behaviour change, write the failing test first, run it to confirm it
fails for the expected reason, then write the minimal code that makes it pass.
Do not bundle implementation and test in a single edit pass — the failing run
is the proof the test exercises the new behaviour. Tests live next to the
code they cover under `tests/` mirroring the `src/` layout.

## Scope discipline

Do only what was asked. Do not add features, refactors, abstractions, error
handling for impossible states, or "while I'm here" cleanups outside the
stated task. If you spot something worth changing that isn't in scope, raise
it as a follow-up — do not silently expand the diff. Three similar lines beat
a premature abstraction.

## Dogfood before declaring done

Before reporting a feature or refactor as finished, run Code Ratings on
`src/` (`npm run scan:self`) and confirm the report is clean for the area
you touched. The scanner's own findings are the fastest signal that
something regressed.
