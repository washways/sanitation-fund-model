# ADR-0018: The country fetch sets observed data, not negotiated terms

- **Status:** Accepted
- **Date:** 2026-08-20
- **Stage:** S2
- **Findings:** F-34
- **Supersedes:** the auto-fill decision in [ADR-0004](0004-cost-of-capital-input.md)

## Context

The shipped defaults were tuned in [ADR-0013](0013-viable-default-scenario.md) to give a new user a fund that works, and every test agreed they did.

**A user opened the app and got an insolvent fund.**

The cause: the app auto-fetches country data half a second after load and overwrites most of the form. So the tuned defaults are a scenario **nobody ever runs**. `tools/baseline-inputs.js` mirrors `index.html`, the whole test suite was built on it, and all of it was measuring a state that exists for about 500 milliseconds.

The specific breakage was mine. [ADR-0004](0004-cost-of-capital-input.md) seeded `fundCostOfCapital` from the World Bank commercial lending rate, reasoning that a sourced number beat a guess. For Malawi that rate is **37.1%**. The tool therefore opened on a blended-finance vehicle borrowing at commercial rates — which is a contradiction in terms, since concessional pricing is the defining feature of the instrument. The fund went insolvent in month 28 and defaulted on 58% of its senior debt.

That ADR then said the static default should be 0 rather than invent a rate, and the model owner set it to 2% concessional in ADR-0013. The fetch path kept overwriting both with 37%.

## Decision

**The country fetch fills observed data. It does not fill negotiated terms or policy choices.**

| Auto-filled | Not auto-filled |
|---|---|
| Inflation, population, population growth, income, sanitation gap, administrative units | Cost of capital, grant support level |

`fundCostOfCapital` keeps its concessional default. The commercial lending rate is shown beside the field as context — *"commercial lending in this country runs at about 37.1% — set this from your actual term sheet"* — which is the honest role for a market observable that is not the thing being modelled.

The general rule, worth stating because it will come up again: **a market rate is not a term sheet, and a poverty statistic is not a policy.** Evidence should inform the user; it should not silently move the dials.

## Prediction

The startup scenario becomes viable. `golden.json` unchanged, since it is keyed off `index.html` defaults and this changes only the fetch path.

## Alternatives considered

- **Tune the other parameters until the 37% scenario balances.** Rejected: it would mean contorting ops costs and interest rates to survive a cost of capital the fund would never actually face. Fixing the wrong number to accommodate a wrong number.
- **Stop auto-fetching on load.** Tempting — it is the root of the "tested state is not the running state" problem — but the auto-fetch is genuinely useful, and removing it would make the tool feel broken to anyone expecting country data.
- **Also stop auto-filling grant support from the poverty headcount.** Partly done: the value is capped by the affordability logic rather than set directly to 75.4%. The deeper question — whether poverty should drive subsidy policy at all — is Q3 and stays open.

## Consequences

The real gap this exposed was in the **test strategy**, not the parameters. `tests/startup.test.js` now drives the actual fetch handler against recorded World Bank and administrative-unit responses for Malawi, and asserts that the resulting scenario is viable. That is the only test in the suite that answers *"does the thing a user opens actually work?"*.

Fixtures are recorded, never live. Country data changing under us should be a deliberate re-record with a visible diff, not a test that fails on a Tuesday because an indicator was revised.

## Verification

Startup scenario, driven through the real fetch handler with recorded Malawi data:

```
inflation 28.4%   HH rate 48.4%   CoC 2.0%   ops $25,000   grant 40%
districts 30      target pop 9,244,139      income $600

viability VIABLE | integrity OK
toilets 196,264 | people 981,320
minCash +$8,458 | repaid 100.0% | OSS 2.99 | netAssets $2,221,681
```

Before the fix, the same path produced: insolvent from month 28, 58.4% of senior debt in default, $584,913 of interest capitalised.
