# ADR-0030: Accept 30% as the value-of-time factor for now (Q2)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Spec rules touched:** R-8.6
- **Resolves:** Q2

## Context

R-8.6 values an hour of household time saved as `(avgAnnualIncome / 2,080) * timeValueFactor` — local income per working hour, discounted below the full wage because the hour saved is household time (walking to, queueing for, managing sanitation), not forgone paid employment. That method was settled 2026-08-20 (ADR-0015). The remaining question was the specific **0.30** factor: a conventional round number, not verified against a specific current source.

The model owner reviewed this and confirmed 30% is acceptable as the current default, on the condition that it stays clearly documented as a convention rather than a cited figure — the previous state was already correctly *labelled* as unverified (`docs/MODEL_SPEC.md`, `methodology.html`, and the `timeValueFactor` input's own tooltip all said so), so this ADR's job is to close the open-question status, not to add new caveats that don't already exist.

## Decision

**Keep 30% as the default `timeValueFactor`.** No code changes. The existing "confirm this before publishing" language stays in place across `MODEL_SPEC.md`, `methodology.html` and `PARAMETERS.md` — this ADR records that the model owner has accepted the number *provisionally*, not that it has been sourced. Anyone using the model for a real funding decision should still treat 30% as a placeholder to confirm against their own programme's cost-benefit guidance before publishing an SROI derived from it, exactly as the existing documentation already warns.

## Prediction

No code changes; no golden scenario moves.

## Alternatives considered

- **Pick a different round number** (e.g. 25% or 50%, both cited elsewhere in WASH/transport cost-benefit literature) instead of confirming 30%. Rejected: swapping one unverified convention for another unverified convention is not progress, and would move every SROI figure in the tool for no better-evidenced reason.
- **Leave Q2 open indefinitely.** Rejected: an open question with no path to resolution just sits in the register forever. Explicitly accepting the current default, documented as provisional, is more honest than an unresolved item that looks the same whether anyone has looked at it or not.

## Consequences

Q2 is no longer the blocking, undecided item it was — 30% is the accepted working default. It remains, deliberately, a number to revisit: if a specific programme's published cost-benefit guidance gives a different figure, that guidance should override this default via the `timeValueFactor` input, which already exists for exactly this purpose. Nothing about the model's behaviour or output changes as a result of this ADR.

## Verification

Documentation only. `docs/MODEL_SPEC.md` §13, `STATUS.md` and `methodology.html`'s open-questions section updated to reflect Q2 as resolved-for-now rather than open.
