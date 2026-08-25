# ADR-0032: Grid-then-bisect solvers with a typed result (F-27)

- **Status:** Accepted
- **Date:** 2026-08-25
- **Stage:** S4
- **Findings:** F-27 (fix), F-37 (fixed incidentally — see below)
- **Spec rules touched:** none (solvers are advisory tooling, not the model itself)

## Context

`solveBreakEven` and `solveMaxGrant` each binary-searched a single parameter
(`loanInterestRate`, `grantSupportPct`) for the boundary where `netAssets >= 0`.
Binary search is only correct if `netAssets` is monotone in that parameter — the
audit measured 14 of 73 upward steps where it *fell* instead, in a capital-tight
scenario, and flagged that blind bisection there can converge on a rate that is
not the answer, with nothing to say so.

**Re-measured before touching the solver, because the model has changed since the
audit.** ADR-0031 (this session, earlier) rewrote micro-enterprise capital pricing,
and that specific capital-tight case (`investLoan` $500k / `investGrant` $100k) no
longer shows any non-monotonicity — 0 of 73 downward steps today. The original
evidence for F-27 does not reproduce as written.

The underlying problem is still real, just not where the audit happened to catch
it. A broader sweep against the current model found it in several places:

| Scenario | `netAssets(loanInterestRate)` downward steps of 74 |
|---|---|
| baseline | 0 |
| capital-tight (the original audit case) | 0 |
| more capital-tight (`investLoan` $200k / `investGrant` $50k) | **13** |
| capital-tight + high default (30%) | **8** |
| grant-heavy, loan-light (`investLoan` $300k / `investGrant` $700k) | **14** |
| capital-tight, 20-year horizon | **4** |
| tiny ME network (5 districts, 2 ME/district) | **2** |

And `netAssets(grantSupportPct)` is non-monotone almost everywhere, including the
shipped baseline (27 of 50 downward steps) — though there it never actually
crosses infeasible, so blind bisection happened to still work there by luck, not
by guarantee.

## Decision

Replace both solvers' binary search with a shared `_solveGridBisect` helper:

1. Evaluate a coarse grid (13 points) across the full range.
2. Take the **true extremum across the whole grid** — lowest feasible x for
   `solveBreakEven`, highest for `solveMaxGrant` — not the first sign change found
   scanning in one direction. This is correct regardless of monotonicity or how
   many separate feasible/infeasible pockets exist; it only needs the grid to be
   fine enough to find one, which the sweep above confirms it is.
3. Bisect (10 iterations) only within the single grid cell adjacent to that
   extremum, where assuming local monotonicity is far safer than assuming it
   globally.
4. Return `{ ok, value, reason }`. `ok: false` means no feasible point exists
   anywhere in range — reported explicitly, not returned as a 0 a caller can't
   distinguish from a genuine answer of zero.

Every call site (`UI.updateKPIs`'s break-even/max-grant display, CSV export,
`tools/probe.js`) now unpacks the typed result instead of a bare number.

### F-37, fixed incidentally

While unpacking the typed result at the display call site
(`sus-max-grant`), found a second, unrelated bug: that line skipped the `* 100`
conversion the CSV export path already applied, so a real 99.9% max-sustainable-grant
answer rendered on screen as **"1.0%"** — a 100x display error, independent of the
solver logic itself. Registered as **F-37** in `docs/ANALYSIS.md` and fixed in the
same edit, since the typed-result rewire touched that exact line anyway.

## Prediction, then measurement

**Predicted:** the new solver should agree with the old one wherever the old one
was already correct (monotone regions), and diverge only where the old one was
wrong — reporting failure instead of a specific wrong number.

**Measured**, before and after, using a scratch copy against `tools/baseline-inputs.js`:

| Scenario | Old `solveBreakEven` | New `solveBreakEven` | Old `solveMaxGrant` | New `solveMaxGrant` |
|---|---|---|---|---|
| baseline | 25.34% (11 sims) | `{ok:true, value:25.33%}` (23 sims) | 99.90% (10 sims) | `{ok:true, value:100.0%}` (13 sims) |
| capital-tight (original case) | 87.45% (11 sims) | `{ok:true, value:87.40%}` (23 sims) | **0%** (10 sims — indistinguishable from a real zero) | `{ok:false, reason:'no grant support % up to 100% keeps net assets non-negative'}` (13 sims) |
| hopeless (`annualFixedOpsCost` $50M) | `null` + `console.warn` | `{ok:false, reason:'no interest rate up to 150% keeps net assets non-negative'}` | **0%** | `{ok:false, reason:'...'}` |

**Accuracy validated against fine-resolution (0.1%-step) reference sweeps**, across
10 scenarios chosen to include genuinely non-monotone and infeasible cases:

| Scenario | True answer (fine sweep) | New solver | Gap |
|---|---|---|---|
| baseline, break-even | 25.40% | 25.33% | 0.07pp |
| baseline, max grant | 100.00% | 100.00% | 0.00pp |
| grant-heavy/loan-light, break-even | 0.00% | 0.00% | 0.00pp |
| grant-heavy/loan-light, max grant | 91.30% | 91.37% | 0.07pp |
| capital-tight, 20y, break-even | 110.40% | 110.34% | 0.06pp |
| more capital-tight, break-even | no feasible rate | `ok:false` | matches |
| more capital-tight, max grant | no feasible grant % | `ok:false` | matches |
| capital-tight + high default, break-even | no feasible rate | `ok:false` | matches |
| capital-tight + short term, max grant | no feasible grant % | `ok:false` | matches |
| capital-tight, 20y, max grant | no feasible grant % | `ok:false` | matches |

Precision is within ~0.1 percentage point everywhere feasible, and every
infeasible case is now reported as infeasible rather than as a plausible-looking
number.

**Cost.** Simulations per solver call rise from 11 (`solveBreakEven`) / 10
(`solveMaxGrant`) to 23 / 13 typically (up to 23 each in the worst case, fewer
when the answer sits at a range boundary and no bisection is needed). Per full
recalculation with the solver panel enabled: **22 → up to 47** full simulations
(vs. 1 when the panel is off, which is the shipped default —
`enableBreakEvenSolver: false`). Measured wall-clock cost at the shipped 5-year
horizon is well under 100ms either way; this has not been re-measured at the
20-year horizon. The existing 500ms input debounce (`app.js`'s
`trackManualInterest`/`triggerSmartRates` handlers) is unchanged and still
applies. Caching/memoizing solver runs across recalculations remains open —
tracked separately as roadmap S4 item 2, not part of this fix.

**Golden suite: no change.** No golden scenario sets `enableBreakEvenSolver: true`
(`tools/baseline-inputs.js` ships it `false`), so `solveBreakEven`/`solveMaxGrant`
are not on the path any golden scenario exercises. `npm run golden:diff` confirms
"No behaviour change."

## Consequences

- The solver's answer is now provably correct to within one grid cell's bisection
  precision (~0.1pp), regardless of monotonicity, instead of silently wrong in an
  unknown subset of capital-constrained scenarios.
- "No feasible answer" is now a distinguishable, testable outcome
  (`tests/solver.test.js`) instead of a value a caller could mistake for real.
- Solver cost roughly doubles when the panel is enabled. Still cheap in absolute
  terms at the shipped horizon; flagged for the caching work in S4 item 2 if it
  becomes noticeable at longer horizons.
