# ADR-0049: Derive health impact conservatively and report jobs/carbon honestly

- **Status:** Accepted
- **Date:** 2026-10-21
- **Stage:** S3
- **Findings:** F-56, F-57, F-58
- **Spec rules touched:** R-8.1, R-8.3, R-8.7, R-10.7, R-11.1

## Context

Three impact selections currently look broken or more certain than they are:

1. The jobs headline multiplies ending enterprises by a hard-coded three, but the chart reads
   `series.dataJobs`, which the engine never creates. It therefore plots no jobs. The summary also
   applies an undocumented `$3,000` value per job even though job value is not included in SROI.
2. DALYs default to zero for every country even though WHO publishes country-level diarrhoeal DALYs
   attributable specifically to inadequate sanitation, including lower and upper uncertainty bounds.
3. Carbon displays `0 tCO2e` as if zero mitigation had been measured. IPCC wastewater accounting
   does not permit a mitigation factor to be inferred from people or toilets alone: it requires the
   baseline and project treatment systems and their methane-conversion factors.

For Malawi in 2019, WHO reports a lower-bound 105,249.6094 sanitation-attributable diarrhoeal DALYs.
The matching World Bank observations are population 19,025,752 and basic sanitation coverage
42.803838%. Dividing the conservative burden by the 10.883m people without basic sanitation gives
**0.0096719 DALY per exposed person-year**. This is a population-level burden estimate, not an
intervention effect. Treating every unit of that burden as averted by a basic rural toilet would
silently assume perfect implementation and 100% risk removal.

## Decision

### Jobs

Add an editable `jobsPerMe` input, default **3**, explicitly documented as the interim assumption of
one owner/operator plus two full-time-equivalent workers per active enterprise. Both the headline and
annual chart use `activeMEs * jobsPerMe`. Call the result “jobs supported,” not job-years or jobs
created, because the model observes active enterprise capacity at each reporting date rather than
tracking individual employment spells. Remove the unsupported `$3,000/job` valuation.

### DALYs

On country load, fetch WHO `WSH_30_SAN` for both sexes and all ages. Take the latest record's **lower
uncertainty bound**, then fetch World Bank total population (`SP.POP.TOTL`) and total basic-sanitation
coverage (`SH.STA.BASS.ZS`) for that exact year. Derive:

```
peopleWithoutBasicSanitation = totalPopulation * (1 - basicSanitationPct / 100)
dalyPerExposedPersonYear     = WHO lower-bound sanitation DALYs / peopleWithoutBasicSanitation
```

The engine's existing area-under-the-curve formula then applies that rate only to people served by
toilets still within service life. Add a separate editable `dalyImpactRealisation` assumption,
default **21%**, based on the 2022 Wolf et al. meta-analysis estimate for basic sanitation without a
sewer connection versus unimproved or limited sanitation (RR 0.79; 95% CI 0.61–1.03, moderate
certainty). Apply it to the country burden proxy before reporting DALYs averted. The point estimate
is an interim cross-country assumption, not a Malawi observation, and must be replaced when the
programme has measured service quality, use, coverage, or health effects. The burden field is blue
and names both APIs, year, numerator, and denominator. A user edit removes the provenance. If any component is unavailable or invalid, reset
the optional DALY factor to zero and label it “not estimated”; never retain the prior country.

`dalyValue` stays zero. The country burden estimate therefore makes the physical DALY chart useful
without silently monetising uncertain health effects or changing SROI.

### Carbon

Keep `co2PerToilet = 0` until a project methodology supplies net tonnes avoided per toilet-year.
When the factor is zero, display “Not estimated — project factor required,” not a measured zero.
People reached may scale an already-supported per-person factor, but cannot create the factor.

## Prediction

- Static/golden Malawi calculations remain unchanged except for the new jobs series; the jobs
  headline remains 801 at the default (`267 * 3`).
- The post-fetch Malawi startup receives approximately 0.0096719 DALY/person/year and reports about
  2,139 physical DALYs averted over five years after the explicit 21% realisation factor. Financials, SROI, and viability do not move because
  `dalyValue` remains zero.
- The jobs chart ends at 801 rather than an absent/zero dataset.
- Carbon remains financially and physically zero by default, but is labelled not estimated.

## Alternatives considered

- **Use central WHO DALYs.** Rejected for the default; the lower uncertainty bound is more prudent.
- **Treat all attributable burden as averted.** Rejected because the WHO quantity is a population
  counterfactual, not proof that one toilet intervention removes 100% of risk. The 21% basic,
  non-sewered sanitation effect is explicit and editable.
- **Use all WASH DALYs.** Rejected because the intervention finances sanitation, not water and
  hygiene improvements.
- **Infer carbon from users.** Rejected: without a baseline and project sanitation technology the
  sign and magnitude of methane change are unknown under IPCC methods.
- **Keep three jobs hard-coded.** Rejected: a decision-facing assumption must be visible, editable,
  and used consistently.

## Sources

- [WHO GHO sanitation DALY indicator](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/number-of-diarrhoea-dalys-from-inadequate-sanitation)
- [WHO GHO OData API](https://www.who.int/data/gho/info/gho-odata-api)
- [Wolf et al. 2022 sanitation intervention meta-analysis](https://doi.org/10.1016/S0140-6736(22)00937-0)
- [World Bank total population](https://data.worldbank.org/indicator/SP.POP.TOTL)
- [World Bank basic sanitation coverage](https://data.worldbank.org/indicator/SH.STA.BASS.ZS)
- [IPCC wastewater emissions guidance](https://www.ipcc-nggip.iges.or.jp/public/2019rf/vol5.html)

## Verification

Startup tests use recorded WHO and World Bank responses—never the live network—and pin the exact
Malawi derivation, provenance, user-edit transition, and zero reset when evidence is missing. Model
tests pin the jobs input, KPI, annual series, and zero case. A live audit checks API coverage and
semantic ranges across all selector countries.
