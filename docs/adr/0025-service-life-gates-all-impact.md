# ADR-0025: Toilet service life gates DALYs and time-saved, not just carbon (Q13)

- **Status:** Accepted
- **Date:** 2026-08-21
- **Stage:** S3
- **Findings:** —
- **Spec rules touched:** R-8.2, R-8.3
- **Resolves:** Q13

## Context

Since [ADR-0016](0016-toilet-service-life.md) (`toiletLifespanYears`, default 5 years), carbon crediting stops for a toilet once it passes its service life — `creditingToilets = toiletsBuiltCumulative - retiredToiletsCumulative` already exists and is already used for carbon (R-8.1). Health (DALYs, R-8.3) and time-saved (R-8.2) accrual were left keyed to `toiletsBuiltCumulative` — every toilet ever built, retired or not — because applying the lifespan to all three at once would have conflated a unit-and-accrual fix (F-02/F-33) with a modelling decision, and the code said so explicitly ([app.js], "Applying the lifespan here would move headline impact substantially, so it is left as an explicit open question (Q13) rather than decided in passing").

The asymmetry is internally inconsistent: a toilet past its service life stops abating carbon but keeps averting disease and saving time forever, in the same model, using the same `toiletLifespanYears` input.

## Decision

**Gate DALYs and time-saved on `creditingToilets` (the same in-service count carbon already uses), not on `toiletsBuiltCumulative`.**

```
hours[m] = creditingToilets[m] * avgHHSize * hoursPerPersonPerDay * 30    // was toiletsBuiltCumulative
dalys[m] = creditingToilets[m] * avgHHSize * dalyPerPerson / 12          // was toiletsBuiltCumulative
```

All three impact channels (carbon, DALYs, time-saved) now use the same "still within service life" definition of an active toilet.

## Prediction

**Measured before implementing**, by comparing `sum(dataMonthlyCreditingToilets)` against `sum(dataMonthlyActiveToilets)` (the current, uncorrected all-time count) at several durations, all else at shipped defaults (5-year `toiletLifespanYears`):

| Duration | Ratio (in-service / all-time) | Effect |
|---|---|---|
| 5 years (shipped default) | **1.0000** | **No change.** No toilet has reached 5 years of age within a 5-year run. |
| 10 years | 0.688 | DALYs and time-saved fall ~31% |
| 20 years | 0.488 | DALYs and time-saved fall ~51% |

Two of the 22 golden scenarios have a service life that toilets actually reach within their run:

| Scenario | Why it moves | Ratio (in-service / all-time) |
|---|---|---|
| `long horizon (20y)` | `duration: 20` years against the 5-year default lifespan | 0.488 (dalys/hours fall ~51%) |
| `carbon, short crediting life` | `toiletLifespanYears: 2` against the 5-year default duration | 0.621 (dalys/hours fall ~38%) |

Predict `dalys`, `valDalys`, `hours`/`valHours` and downstream `sroi` fall by those amounts in those two scenarios only; everything else in them (cash, portfolio, investor repayment) is unchanged, because impact accrual does not feed back into the financial model. Every other scenario: **no movement**, because they all run at or under their own service life.

## Alternatives considered

- **Leave the asymmetry and just document it.** This was the interim position (the code comment, and Q13 sitting in the open-questions table). Rejected now: the model owner confirmed the coherent position is to apply the lifespan uniformly, and the fix is mechanical once decided — reusing `creditingToilets`, not writing new logic.
- **Give health and time-saved their own, different service-life input**, distinct from the carbon crediting period. Rejected: nothing in `docs/PARAMETERS.md` supports two different service-life figures, and inventing a second one would violate Rule 5 of `AGENTS.md`. If evidence later suggests toilets keep providing health/time benefits past the point they stop being carbon-creditable (plausible — carbon crediting periods are a methodology artefact, not a physical fact about the latrine), that is a new, evidenced parameter to add later, not a default to assume now.

## Consequences

Every impact figure the model reports is now internally consistent with a single "in service" definition, which is what the two verdicts (integrity, viability) and the impact card were already implicitly claiming. Runs at or under 5 years (the shipped default duration) are unaffected. Runs materially longer than the service life will show lower headline DALY/time-saved/SROI figures than before this change — that is the change working as intended, not a regression.

## Verification

```bash
npm test               # 0 failures
npm run golden:diff    # only `long horizon (20y)` moves; dalys/hours/sroi down ~50%, matching the table above
```
