# ADR-0023: No repeat or upgrade demand — one household, one toilet (Q7)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3 (documentation); Stage 4 if reopened
- **Spec rules touched:** R-7.1
- **Resolves:** Q7

## Context

`docs/MODEL_SPEC.md` §13 Q7 asked whether a household is served once and never again, or whether repeat/upgrade demand (replacement after a toilet degrades, or a household growing and needing a second unit) should exist.

## Decision

**Keep the current behaviour: one household, one toilet, once.** No repeat or upgrade demand.

## Prediction

No code changes; no golden scenario moves.

## Alternatives considered

- **Model replacement demand tied to `toiletLifespanYears`.** The natural extension, since service life already exists as an input (ADR-0016) and already gates carbon crediting. Rejected *for now*: this is a real modelling addition (a served household re-enters the backlog after its toilet's service life ends), not a parameter tweak, and it would compound with the still-open Q13 decision (does service life expiry affect anything besides carbon) in ways that deserve to be reasoned through together rather than bolted on separately.
- **Ignore the question entirely.** Rejected: the simplification is real and already listed in `MODEL_SPEC.md`'s "Simplifications worth knowing" section (methodology.html §12) — "one household, one toilet, once. No repeat or upgrade demand." Closing the ADR formally, rather than leaving it in the open-questions table indefinitely, makes clear this is a stated scope limit, not an oversight.

## Consequences

The model continues to understate long-run demand on any run longer than one service-life cycle — a served household never re-enters the backlog even after 20+ years. This is disclosed in the methodology note. Revisit together with Q13 if either is reopened, since both hinge on what "service life expiring" means for a household already counted as served.

## Verification

Documentation only. `docs/MODEL_SPEC.md` §13 Q7 marked resolved.
