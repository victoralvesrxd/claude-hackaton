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
Add cscan design document

Why:
Establishes the architecture and scope for the code scanner CLI before
implementation begins. Captures the agreed decisions (TS-only analysis,
ts-morph + jscpd, three report formats) so future work has a single
source of truth.

What:
- New DESIGN.md covering goals, CLI shape, the 5-stage pipeline, data
  shapes, project structure, error handling, and testing strategy.
```
