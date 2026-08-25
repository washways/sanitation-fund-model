# ADR-0024: The collections floor stops abruptly at wind-up, no taper (Q9)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Spec rules touched:** R-9.2
- **Resolves:** Q9

## Context

`docs/MODEL_SPEC.md` §13 Q9 asked whether the collections floor (ops cost cut to 30% during hibernation/insolvency) should taper down gradually as the portfolio runs off, rather than dropping straight to zero the month the fund winds up (R-9.2, ADR-0006).

## Decision

**Keep the abrupt stop.** No taper.

## Prediction

No code changes; no golden scenario moves.

## Alternatives considered

- **Taper the floor over N months before wind-up.** Rejected: a taper needs a rate and a shape (linear? exponential? over how many months?), and nothing in `docs/PARAMETERS.md` or any World Bank indicator supplies one — it would be an invented number, which Rule 5 of `AGENTS.md` exists specifically to prevent. The abrupt version needs no such invention: at wind-up (R-9.1) the fund by definition has nothing left to collect, nothing being built, and no capital to redeploy, so a collections team has nothing to do the month after.
- **Taper is unnecessary in practice — the abrupt stop is already the conservative assumption.** This is the actual reason to prefer it, not just the absence of a rate: stopping ops costs abruptly cannot *understate* the fund's true cost, whereas an invented taper rate could accidentally flatter a fund that is closer to insolvent than the taper implies.

## Consequences

None — this is the behaviour already shipped since ADR-0006. Closing the ADR removes it from the open-questions list rather than leaving a settled decision looking undecided.

## Verification

Documentation only. `docs/MODEL_SPEC.md` §13 Q9 marked resolved.
