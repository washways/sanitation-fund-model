# ADR-0011: SROI measures social value only, and includes DALYs

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3
- **Findings:** F-08
- **Spec rules:** R-8.4
- **Resolves:** Q1

## Context

SROI was:

```js
sroi = (totalHoursSaved * 0.5 + totalCarbon * co2Value + cashEnd) / (investGrant + investLoan)
```

Two problems, both of which the source code was visibly unsure about — `computeKPIs` contained a fifteen-line comment block in which the author argued with themselves and reached no conclusion.

**DALY value was excluded.** It was computed as `totalDalys * dalyValue`, displayed prominently on the impact card, and then left out of the ratio. A user reading the screen saw a large health-benefit figure and a social return that did not contain it. The screen contradicted itself.

**Ending cash was included.** A residual financial asset sat in the numerator of a *social* return measure, which means a fund that hoards capital and builds nothing scores well on impact.

## Decision

```
socialValue = DALYs × dalyValue  +  hoursSaved × hourValue  +  carbonTonnes × co2Value
SROI        = socialValue / capitalInvested
```

Financial performance is reported **beside** it, not folded into it, as a new `capitalPreservation = netAssets / capitalInvested`.

The `$0.50`/hour constant is unchanged and still uncited (Q2 remains open). It is now a named constant, `HOUR_VALUE_USD`, with a comment saying exactly that, rather than a bare `0.5` appearing twice.

## Prediction

SROI rises sharply in every scenario, because DALY value dominates the other two terms at the default `dalyValue` of $500. Ending cash leaves the numerator, which reduces it slightly in cash-rich scenarios and raises it in cash-negative ones. Net effect: up, by roughly the DALY share.

## Alternatives considered

- **Keep excluding DALYs.** Rejected: the UI already shows the number, so excluding it is not conservatism, it is inconsistency. If the DALY figure is not trustworthy enough to include, it is not trustworthy enough to display.
- **Report one blended figure including cash.** Rejected: it lets financial and social performance substitute for each other, which is the opposite of what a blended-finance tool should show. Two numbers, side by side, is more informative and harder to game.
- **Drop SROI entirely.** Considered seriously — SROI is a contested metric. Rejected because funders ask for it; the honest response is to define it clearly, not to omit it.

## Consequences

**SROI figures are not comparable to anything produced before 2026-08-20.** Two changes moved it: this one, and the hours-saved correction in [ADR-0010](0010-wire-up-collected-inputs.md), which was independently a ~4.4x move.

Q2 stays open. Until the value of an hour has a source, SROI carries an undocumented assumption — smaller than before, but present. `dalyValue` at least has a user-facing control and a conventional basis.

## Verification

Baseline: `sroi` 34.33, `socialValue` $171,656,311, `capitalPreservation` -0.190 at the time of the change (before the default scenario was replaced). The DALY term is now visible in the total, and `capitalPreservation` reports the financial side separately.
