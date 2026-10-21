# ADR-0034: Import observations, preserve programme assumptions

- **Status:** Accepted
- **Date:** 2026-10-20
- **Stage:** Post-S5 audit
- **Findings:** F-38, F-39, F-40, F-41
- **Spec rules touched:** R-2.4, R-6.1, R-7.1, R-8.2, R-8.3, R-8.6

## Context

The country loader currently turns World Bank observations into programme assumptions:
poverty becomes grant-funded pacing, political stability becomes a contingency mark-up,
commercial lending and inflation become household and enterprise loan prices, and GDP per
capita becomes a three-tier toilet price. It also replaces default and operating-cost assumptions
with fixed numbers that do not come from the selected country at all.

This contradicts ADR-0018 and the repository rule that a fetch may fill observed data but may
not move negotiated terms or policy choices. It is also unsafe across the 44-country selector:
the latest available CPI observations range from deflation to 138.8%, lending-rate data are
missing for 25 countries, and the `PV.EST` governance estimate is approximately -2.5 to 2.5
while the code treats it as a 0-100 percentile. The separate administrative-unit API mixes
levels for Malawi (27 districts plus three regions, while omitting Neno) and reports 30 rather
than the official 28 districts.

The loader asks for `MRV=5`, which means five calendar periods rather than the latest
non-empty observation. It therefore loses older-but-latest poverty and Gini observations for
many countries. It also discards observation years, so users cannot see whether a number is
current or stale.

The Malawi static scenario also contains values that can now be replaced or documented from
primary evidence:

- World Bank/JMP: 18,307,197 rural people in 2025 and 49.5054% basic rural sanitation in
  2024, hence 9,244,139 people without basic rural sanitation; 2.56% population growth and
  $600 GNI per capita in 2025.
- Malawi NSO IHS5: 4.4 people per rural household.
- UNICEF Malawi: 28 districts; household sanitation loans run 3-12 months; sanitation
  enterprise loans are about $3,000 over 12 months; a rural VIP latrine sold for $83.80 in
  2020. Applying published US CPI for 2021-2024 gives about $101 in 2024 dollars, supporting
  the existing rounded $100 USD planning cost.
- World Bank's Lilongwe Water and Sanitation Project appraisal: 15 minutes saved per person
  per day and time valued at 50% of adult opportunity cost for conservative benefit analysis.

No programme-specific source was found for the default DALYs averted per person or their
dollar value. Leaving both non-zero would make an unsupported health claim in the headline
SROI.

## Decision

Country loading will populate only three model inputs from dated observations: the rural
population without basic sanitation, population growth, and GNI per capita (falling back to GDP
per capita). Inflation, commercial lending, poverty, Gini, and sanitation coverage remain
visible as dated context but do not move model assumptions. The loader will use the World Bank
API's latest-non-empty mode and preserve indicator labels and years.

The third-party administrative-unit call and every heuristic policy write will be removed.
Missing essential observations will be shown on screen and will not silently reuse another
country's values.

The static Malawi defaults will become: 9,244,139 people requiring toilets, 2.56% population
growth, $600 annual income, 4.4 people per household, 28 districts, $3,000 enterprise setup
cost, a 12-month household term, and a 50% time-value factor. The $100 toilet cost and 15
minutes saved per person per day remain, now with sources. DALYs averted and DALY value will
default to zero until programme evidence is supplied. Carbon already defaults to zero and its
HTML will be made honest rather than relying on a load-time override.

The sourced 50% Malawi time-value factor supersedes ADR-0030's provisional 30% global default;
ADR-0030 remains part of the decision history.

All financing terms, write-down rates, operating costs, capacity/productivity assumptions and
subsidy policy remain editable illustrative programme assumptions. Their documentation will
say so plainly; selecting another country does not make them country-specific.

The form's inflation input will be relabelled as cost escalation in model currency. Malawi CPI
is a local-currency historical observation; applying it mechanically to a USD model without an
exchange-rate path is dimensionally wrong.

## Prediction

Written before implementation, using direct diagnostic runs for the baseline direction and
rough size.

| Scenario | Field | Direction | Rough magnitude |
|---|---|---|---|
| baseline | toilets | up | about 15-25% (shorter HH term lowers enterprise working-capital requirement) |
| baseline | net assets | down | about 40-60% |
| baseline | SROI | down | about 50%, because unsupported DALY value is disabled |
| startup (Malawi fixture) | viability | unchanged | remains viable with full senior repayment |
| all scenarios | carbon | unchanged | already zero at runtime; HTML is aligned to reality |

Changes in scenarios dominated by deliberately overridden parameters may be smaller. The
golden direction must be inspected scenario by scenario before recording.

## Alternatives considered

- **Keep generating country-specific assumptions from API data.** Rejected. The mappings are
  not measurements, several are dimensionally wrong, and missingness varies sharply by country.
- **Build a 44-country assumptions database now.** Rejected. Comparable programme terms and
  sanitation-market costs do not exist in one API; pretending otherwise would replace one set
  of invented numbers with another. A country may be added only with cited programme evidence.
- **Apply Malawi CPI to USD costs.** Rejected. Without an FX path, local CPI cannot consistently
  escalate USD cashflows.
- **Retain non-zero DALY defaults as placeholders.** Rejected. Unsupported social value is more
  dangerous than an obvious zero in a model used for funding decisions.

## Consequences

Country loading becomes less magical and more auditable. Users selecting a country other than
Malawi receive real observed context but must calibrate programme assumptions. Malawi opens on
an evidenced reference scenario rather than a chain of hidden heuristics. SROI is lower and no
longer includes an unsupported default health valuation.

## Verification

Measured after implementation:

- baseline toilets: 97,744 → 118,509 (+21.2%); net assets: $914,174 → $472,563
  (-48.3%); the fund remains viable and senior debt is fully repaid;
- baseline SROI: 4.46 → 4.09, with unsupported DALYs reduced from 7,082 to zero;
- `npm run audit:countries`: all 44 selector countries have the four essential latest-non-empty
  observations and pass semantic range checks; context-only CPI, lending, Gini, and poverty
  coverage remains incomplete, which no longer changes model assumptions;
- the recorded startup fixture and missing-observation regression both pass.

The direction and baseline magnitude match the prediction. Carbon defaults remain zero.
Two stress cases move more than the baseline prediction anticipated: 45% cost escalation becomes
slightly insolvent, and the 20-year horizon falls from 351,462 to 164,749 toilets and from
$5.28m to -$11,751 net assets. The mechanism is economically interpretable rather than a ledger
break: the sourced 12-month household term turns capital faster but earns less interest per loan,
so the illustrative 40% portfolio rate and $60,000 annual operating budget do not sustain an
indefinite programme. The model owner accepted and disclosed that result on 2026-10-20 rather
than tuning an unsupported rate or cost to make the stress case pass.

