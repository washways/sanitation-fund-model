# ADR-0017: Contingency is a cost mark-up, not a drawable reserve — rename it

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3
- **Spec rules:** R-5.3
- **Resolves:** Q5

## Context

`contingencyRate` is added to `variableRate` alongside the management fee and M&E cost, and charged on every disbursement as a permanent per-unit mark-up. It is auto-filled from the World Bank political-stability indicator: 5% base, 7% below the 50th percentile, 10% below the 25th.

Its name implies something else — a pot of money held back and drawn on when a shock occurs. The audit flagged the mismatch (R-5.3) and asked which reading was intended.

## Decision

**Keep the implementation. Change the name** to "Cost Contingency (% mark-up)", with a tooltip stating that it is a per-unit uplift on delivery cost, not a reserve.

Three reasons the implementation is the right one:

1. **It matches what the driver measures.** The parameter is set from a political-stability score — a proxy for how much harder and costlier delivery is in fragile settings. That is cost escalation, not treasury policy.
2. **A drawable reserve has nothing to draw against.** The model is fully deterministic: no shock process, no stochastic events, nothing that arrives unexpectedly. A reserve would accumulate and then sit there. Building the shock process to justify it is a much larger decision, and is explicitly parked with Monte Carlo until the deterministic model is understood (see [ROADMAP.md](../ROADMAP.md), "What is deliberately not on this roadmap").
3. **It is standard practice.** Contingency in construction and infrastructure budgeting *is* a percentage uplift on base cost estimates. A bill of quantities carries contingency as a mark-up. The model is using the term the way the sector uses it; only the UI copy was ambiguous.

## Prediction

No behaviour change whatsoever. Label and tooltip only.

## Alternatives considered

- **Implement it as a real reserve.** Rejected for reason 2 — it would require inventing a shock process, which is out of scope and would make the model's outputs stochastic without the surrounding machinery (repeated runs, confidence intervals) to interpret them.
- **Remove it and fold the uplift into `avgToiletCost`.** Rejected: it would lose the link to the political-stability indicator, and hide a risk adjustment inside a cost estimate — the opposite of what this audit has been doing everywhere else.

## Consequences

The one open question here is that a fragility-driven cost uplift and a management fee are conceptually different things sharing one `variableRate` bucket. That is fine arithmetically and slightly muddy conceptually; splitting the reporting is a small Stage 4 improvement, not a correctness issue.

If a future version does add shocks, this ADR should be superseded rather than quietly reinterpreted.

## Verification

`npm run golden:diff` reports no behaviour change. The label in `index.html` reads "Cost Contingency (% mark-up)".
