# ADR-0022: The grant and loan ledgers stay strictly separate (Q6)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Spec rules touched:** R-5.2
- **Resolves:** Q6

## Context

`docs/MODEL_SPEC.md` §13 Q6 asked whether the fund should be able to on-lend idle grant-ledger cash once the subsidy quota is met, rather than the two ledgers staying strictly separate (R-5.2).

## Decision

**Ledgers stay separate. No cross-lending.**

## Prediction

No code changes; no golden scenario moves.

## Alternatives considered

- **Allow on-lending of idle grant cash.** Rejected. The dual-ledger structure exists specifically so concessional subsidy capital and repayable capital cannot silently cross-subsidise each other (see [ARCHITECTURE.md](../ARCHITECTURE.md) §"The ledger model" and R-5.2). Idle grant cash sitting unused is a *visible* signal — it shows up as an under-spent grant fund, which is information a reader can act on (raise Grant Support %, extend the timeline, or accept slower subsidy deployment). Letting it flow into lending would hide that signal inside a blended cash balance, which is exactly the "healthy grant ledger masks an overdrawn loan ledger" risk `ARCHITECTURE.md` already flags as a reporting gap, not something to make structurally worse.
- **Allow it only after the grant quota is fully met.** Considered as a narrower version. Still rejected: grant capital is typically restricted (donor-designated) in real blended-finance vehicles, and a revolving-fund model that assumes it can be freely redeployed as senior-tranche lending would misrepresent what that capital is actually allowed to do in practice. If a specific programme's grant terms genuinely permit this, that is a scenario-specific override, not a default behaviour.

## Consequences

Grant capital that is not fully deployed as subsidy by the end of the run stays reported as unspent grant capital, not folded into loan-ledger performance. This is a real and currently under-reported quantity — see F-30 ("show grant-fund runway"), which is the more useful direction to invest in for this same underlying visibility gap.

## Verification

Documentation only. `docs/MODEL_SPEC.md` §13 Q6 marked resolved.
