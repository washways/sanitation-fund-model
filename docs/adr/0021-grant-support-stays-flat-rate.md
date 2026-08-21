# ADR-0021: Grant Support % stays a flat share of production (Q3)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Findings:** F-25 (context)
- **Resolves:** Q3

## Context

`docs/MODEL_SPEC.md` §13 Q3 asked whether grant support should stay a flat percentage of production or be means-tested against `avgAnnualIncome`, which the model already collects (and, since F-25/ADR-0015, actually uses — to value saved time, not to gate subsidy).

## Decision

**Stay flat-rate.** Means-testing is not implemented.

## Prediction

No code changes; no golden scenario moves.

## Alternatives considered

- **Means-test now.** Rejected for this pass: the model has one `avgAnnualIncome` figure per country run, not a household-level income distribution. Gating subsidy on a single national average would not means-test anything — it would just be a step function on a country selector, which is not what "means-tested" means and would be worse than being honest that the model doesn't do it. A real means-test needs an income *distribution* input, which is a bigger addition than this decision covers.
- **Add household-level income variance and means-test against it.** The right eventual answer if this is wanted, but it's a Stage 4 modelling addition (a new input, a new allocation rule), not a decision that can be implemented as a side effect of closing Q3.

## Consequences

Grant Support % keeps its existing meaning (a pacing lever on subsidised production, not a means test — see F-30). Revisit if/when household-level income data becomes available to the model.

## Verification

Documentation only. `docs/MODEL_SPEC.md` §13 Q3 marked resolved.
