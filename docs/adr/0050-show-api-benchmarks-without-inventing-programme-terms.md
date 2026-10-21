# ADR-0050: Show API benchmarks without inventing programme terms

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S6
- **Findings:** F-59
- **Spec rules touched:** R-2.4, R-2.7, R-10.7

## Context

Users reasonably ask whether household and enterprise loan rates, annual fixed operating cost, and
annual cost escalation can be derived from country APIs. The app already fetches commercial lending
and local CPI, but shows them only in the country strip. The relevant form controls do not explain
why those indicators are not copied into the model, and fixed operating cost has no nearby
calibration guidance. This makes defensible manual assumptions look like incomplete auto-fill.

The four values are not directly observable country facts:

- World Bank `FR.INR.LEND` is a commercial-bank lending rate, not the programme's household or
  sanitation-enterprise APR. Product pricing also needs cost of funds, servicing cost, expected
  losses, affordability, subsidy, and margin.
- A national macro API cannot infer a programme management unit's salaries, offices, vehicles,
  systems, audit, or field-service budget.
- World Bank `FP.CPI.TOTL.ZG` is local-currency consumer-price inflation. The model is USD-labelled;
  applying local CPI without an exchange-rate and cost-basket view mixes currencies.

## Decision

Keep all four values editable programme assumptions. Mark their controls amber and explain that
amber means “programme assumption; API context does not set this value.” After each country load,
show the dated commercial lending benchmark below both borrower-rate fields, the dated local CPI
below cost escalation, and a fixed explanation below operating cost. Never apply these observations
to the inputs and never give them the blue country-observation state.

## Prediction

No model output or golden scenario moves. The recorded Malawi startup retains 40% household APR,
10% enterprise APR, $60,000 annual fixed operations, and 3.32% USD cost escalation. Its new help text
shows 37.1% commercial lending (2024), 28.4% local CPI (2025), and the limitations above.

## Alternatives considered

- **Auto-fill both portfolio rates from commercial lending.** Rejected: it mistakes a bank-market
  observation for two product term sheets and previously made the blended-finance scenario fail.
- **Derive operations as a share of capital or per capita.** Rejected: either formula invents a cost
  relationship without a staffing or delivery budget.
- **Auto-fill USD escalation from local CPI.** Rejected: it ignores currency denomination, exchange
  rates, and the programme's actual cost basket.
- **Show context only in the top strip.** Rejected: users need the explanation where they make the
  assumption, not elsewhere on the page.

## Consequences

The distinction between country evidence and programme judgement becomes visible at the point of
use. The app still requires programme calibration; it does not manufacture precision. If a future
country source directly observes a programme parameter, adding auto-fill requires a new ADR and a
startup regression proving source, units, date, and fallback behavior.

## Verification

`tests/startup.test.js` pins the four unchanged values, amber state, dated benchmark text, and lack
of blue API provenance. `npm test`, `npm run lint`, and `npm run golden:diff` must remain green.
