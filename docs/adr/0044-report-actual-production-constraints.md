# ADR-0044: Report constraints from actual foregone production

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S4
- **Findings:** Q14 / R-7.6
- **Spec rules touched:** R-7.3, R-7.4, R-7.6, R-11.1

## Context

The production loop allocates output in two stages: demand and enterprise capacity set
the tentative quantity, then separate grant and loan ledgers determine how much of that
quantity can be financed. The monthly `dataConstraintBinding` series was calculated
before the grant limit and final production were known. The headline
`dominantConstraint` KPI ignored that series and inferred a cause from ending reach,
minimum cash, and insolvency instead. Both labels could therefore disagree with the
production decision they purported to explain.

On 2026-10-21 the model owner selected option 1A: use actual binding constraints, retain
grant and loan affordability as separate causes, report simultaneous causes, and rank
the horizon-level causes by foregone output rather than by a count of months.

## Decision

For every month, partition the unserved whole-toilet production opportunity in the
same order as R-7.4:

1. `capacityForegone = demand - min(demand, capacity)`;
2. `loanCapitalForegone = min(demand, capacity) - actual production`.

Those two quantities are additive and reconcile to demand minus actual production.
Because loans backfill any missed grant target, a loan-cap limit is the direct final
capital limit. Also calculate `grantCapitalForegone` as the additional output that
would have been produced that month if the intended grant allocation had been fully
funded while the loan cap stayed unchanged. This is an overlapping explanatory
sub-cause, not a third additive component.

Monthly reporting says `Mixed` when capacity and capital both suppress output. The
headline ranks capacity and loan-capital by their summed foregone monthly output,
lists every other positive cause as secondary, and reports demand met only when no
output was foregone. The same household backlog can remain constrained in successive
months, so the aggregate is a ranking of monthly production opportunities, not a
count of unique households.

## Prediction

No cashflow, production, reach, impact, balance-sheet, viability, or solver number will
move. Only constraint reporting and the new explanatory audit series will change.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| all 21 golden scenarios | every numeric field | none | exactly zero |
| demand constrained | `dominantConstraint` | none | remains demand met |
| other unfinished-demand scenarios | `dominantConstraint` | relabel | ME capacity is expected to rank first; loan and sometimes grant capital appear as secondary where they reduce monthly output |
| monthly CSV audit | constraint column | relabel | uses the actual post-allocation constraint, including mixed months |

If any numeric golden field moves, or demand-constrained output is no longer reported
as demand met, the implementation does not match this decision and must stop.

## Alternatives considered

- **Keep the existing heuristics.** Rejected because a label derived before grant
  allocation cannot describe the final production decision, and the KPI used a second,
  unrelated heuristic.
- **Force one label from the smallest apparent limit.** Rejected because capacity and
  capital can suppress output in the same month and the two ring-fenced capital ledgers
  are not interchangeable.
- **Use a uniform sensitivity percentage or a probabilistic attribution.** Rejected
  because it would introduce an unsupported number or distribution into a diagnostic
  that can be derived directly from the model's existing decision path.

## Consequences

Constraint reporting becomes auditable against the monthly production series and can
name a secondary bottleneck without changing model economics. Grant-capital impact is
explicitly non-additive; consumers must not sum it with the capacity and loan-capital
partition. The longer headline is intentional because it prevents a single label from
hiding a material secondary bottleneck.

Reversing this decision requires a new ADR defining a different attribution rule and
showing how it reconciles to actual production.

## Verification

Observed after implementation:

```bash
npm test                  # 105 pass, 0 fail
npm run golden:diff       # No behaviour change; golden.json is current
npm run lint              # 0 errors, 0 warnings
node tools/verify-findings.js  # 52/52 findings resolved; no open modelling questions
```

The pre-record comparison showed exactly 20 `dominantConstraint` string changes and
no numeric movement. The demand-constrained scenario remained `Demand Met (Success)`.
This matches the prediction above.
