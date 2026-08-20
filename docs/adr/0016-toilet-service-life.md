# ADR-0016: Carbon crediting stops after a configurable service life

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S3
- **Findings:** F-33
- **Spec rules:** R-8.5
- **Resolves:** Q11

## Context

[ADR-0005](0005-carbon-units-and-accrual.md) fixed carbon to accrue annually against toilets in service, rather than once at construction. It left one thing undecided: crediting ran for as long as the simulation happened to run. A 20-year horizon credited every toilet ever built for the whole 20 years.

That is wrong in two ways. Carbon methodologies issue credits over a **finite crediting period**, not in perpetuity. And a toilet past its service life is not abating anything to be credited for.

## Decision

A new input, `toiletLifespanYears`, defaulting to **5**.

Toilets are retired `toiletLifespanYears` after the month they were built, and stop earning credits from that point. Retirement is applied to vintages, not to an undifferentiated stock — the model keeps a monthly production history so that the toilets built in month 7 retire in month 67, regardless of what has been built since.

```
creditingToilets[m] = toiletsBuiltCumulative[m] - retiredCumulative[m]
newTonnes[m]        = creditingToilets[m] × co2PerToiletPerYear / 12
```

`dataMonthlyCreditingToilets` is exported alongside `dataMonthlyActiveToilets`, so the gap between "built" and "still crediting" is visible in the audit trail and the CSV rather than hidden inside the revenue figure.

Five years is conservative for a basic latrine and short for a well-built one. It is an input for exactly that reason.

## Prediction

No change to any scenario with carbon disabled, which is the shipped default. In carbon-enabled scenarios, revenue falls, and falls further the longer the horizon — because it is long runs that were over-crediting.

## Alternatives considered

- **Leave crediting uncapped.** Rejected: it makes carbon revenue a function of the chosen horizon, which is the same class of defect as F-31 (ending cash depending on how long you left the simulation running).
- **Retire toilets from the stock entirely** — removing them from health and time benefits too. Not done here; see Consequences.
- **Model a separate carbon crediting period distinct from physical life.** More faithful to how methodologies actually work, but it is a second parameter for a component most users leave switched off. Revisit if carbon becomes central to a real case.

## Consequences

Carbon revenue now responds sensibly to service life. Measured, on a 10-year run with carbon enabled:

| `toiletLifespanYears` | Carbon revenue | Still crediting at M120 |
|---|---|---|
| 2 | $622,267 | 42,405 of 228,657 built |
| **5** (default) | **$1,378,660** | **95,950 of 234,336 built** |
| 10 | $2,000,953 | 238,603 of 238,603 built |
| 50 | $2,000,953 | 238,603 of 238,603 built |

**This introduces an inconsistency, and it is deliberate rather than overlooked.** A toilet past its service life now stops earning carbon but keeps averting DALYs and saving time indefinitely. Applying the same lifespan to health and time benefits is the logically coherent position — a decommissioned toilet delivers nothing — but it would move headline impact substantially, and that is a modelling decision for the model owner rather than a consequence to slip in alongside a carbon fix.

It is recorded as **Q13** and flagged in the source at the impact block.

## Verification

`tests/golden.scenarios.js` gains `carbon, short crediting life` (2 years) alongside `carbon enabled`. `creditingToiletsEnd` is recorded in every golden scenario.
