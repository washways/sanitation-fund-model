# ADR-0014: Micro-enterprise closure is a separate parameter from loan write-down

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3
- **Findings:** F-20
- **Spec rules:** R-6.3
- **Resolves:** Q4

## Context

`currentMEs` only ever increased. Micro-enterprise loans were written down at `meDefaultRate`, and the balances disappeared — but the enterprise kept producing toilets forever at `toiletsPerMeMonth`. Measured: a **0%** ME write-down rate and a **50%** ME write-down rate both ended with exactly **1,000** micro-enterprises, despite $517,534 of ME loans being written off in the second case.

So production capacity was completely insensitive to enterprise failure. Over a ten-year run at a 10% annual write-down, a large share of modelled capacity belonged to businesses that had, financially speaking, collapsed.

## Decision

**Model closure and write-down as two parameters, because they are two events.**

A new input, `meExitRate` — the share of micro-enterprises that cease trading each year — reduces capacity:

```
monthlyExit = 1 - (1 - meExitRate)^(1/12)
currentMEs  = currentMEs × (1 - monthlyExit)
```

`meDefaultRate` continues to write down loan balances, unchanged. **Exit does not touch the loan cohorts**, and write-down does not touch the enterprise count. Combining them would double-count the same underlying failure.

`currentMEs` becomes continuous, and is floored only where a count is displayed.

### Why not derive exit from the write-down rate?

Because they measure different things, and the model's own definitions make that explicit:

- `meDefaultRate` is a **fractional continuous write-down on outstanding balance** (R-3.4), not a business-failure rate. On the shipped 18-month terms a 5% headline write-down produces a realised loss of roughly 1.5% of disbursed principal. It is a portfolio quantity.
- Business closure is an **operational** event. The two come apart in both directions: an enterprise can wind down in good order having repaid its loan in full — assets sold, obligations met, owner moved on — and an enterprise can fall behind on payments while continuing to trade and build toilets.

Deriving one from the other would bake in an equivalence that does not hold, and would hide it inside a formula. Two inputs make the assumption visible and lets a programme with real cohort data set each from evidence.

### Default: 10% per year

Small-enterprise mortality in low-income settings is high, and materially higher than loan-default rates — annual closure rates in the tens of percent are common for young micro-enterprises. Against that, the enterprises here are **programme-supported**: trained, financed, and supplied with a pipeline of demand, which is exactly the intervention that improves survival.

10% is chosen as a deliberately mid-range figure between unsupported micro-enterprise mortality and the ~5% write-down default. **It is a convention, not a measurement.** Any programme with cohort survival data should replace it, and the sensitivity table below is the argument for why it is worth measuring.

## Prediction

Fewer micro-enterprises means less capacity, so fewer toilets. ME lending *rises*, because the expansion logic keeps replacing lost capacity. Financial viability should be largely unaffected, since ME loans are a small share of the portfolio.

## Consequences

Capacity now responds to enterprise failure, so "supply chain constrained" becomes a meaningful diagnosis rather than an artefact.

Measured sensitivity on the shipped defaults:

| `meExitRate` | MEs at end | Toilets | Investor repaid |
|---|---|---|---|
| 0% | 1,000 | 139,148 | 100% |
| 5% | 1,000 | 135,395 | 100% |
| **10%** (default) | **879** | **133,469** | **100%** |
| 20% | 600 | 130,617 | 100% |
| 40% | 268 | 122,722 | 100% |

Reach is less sensitive than the enterprise count, because the fund replaces failed enterprises out of the same capital. Financial viability holds across the whole range — a useful result, and one the model previously could not produce at all.

## Verification

`tests/golden.scenarios.js` gains `no ME attrition` and `high ME attrition`. Baseline: 1,000 MEs → 879, toilets 139,148 → 133,469, ME lending +33.6% as capacity is replaced.
