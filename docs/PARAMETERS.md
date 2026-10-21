# Parameter Dictionary

**The canonical unit, source and meaning of every input.** Check this file before changing a field. Every rate is entered as a percentage (`12` means 12%) and converted once, at the UI boundary, to a decimal.

Source categories matter:

- **Observed** values may be populated from a dated World Bank indicator.
- **Malawi reference** values have country-specific evidence but remain editable.
- **Programme assumption** values are illustrative terms or operating choices. They are never made country-specific by an API heuristic.

## Capital and structure

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `wiz-invest-grant-sidebar` | Initial Grant Capital | 1,000,000 | USD / USD | programme assumption | Seeds the grant ledger and caps total grant-funded output. |
| `wiz-invest-loan-sidebar` | Initial Loan Capital | 4,000,000 | USD / USD | programme assumption | Senior debt that seeds the loan ledger. |
| `wiz-duration-sidebar` | Duration | 5 | years / years | programme assumption | Simulation horizon; a completed fund winds up before it. |
| `fundRepaymentTerm` | Fund Repayment | 5 | years / years | programme assumption | Flat principal amortisation after grace. |
| `investorGracePeriod` | Investor Grace Period | 6 | months / months | programme assumption | Defers principal only; interest accrues from month 1. |
| `fundCostOfCapital` | Fund Cost of Capital | 2 | percent / decimal | programme assumption | Illustrative concessional term. The dated commercial lending rate is displayed as context and never overwrites it. |

## Market and demand

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `popReqToilets` | Pop. Needing Toilets | 9,244,139 | people / people | observed: `SP.RUR.TOTL × (1 − SH.STA.BASS.RU.ZS/100)` | Malawi uses 18,307,197 rural people (2025) and 49.5054% basic rural sanitation (2024). Divided by household size to form the toilet backlog. |
| `popGrowthRate` | Annual Pop Growth | 2.56 | percent / decimal | observed: `SP.POP.GROW` | Compounds the carried backlog monthly before current production is subtracted. |
| `avgHHSize` | Avg Household Size | 4.4 | people / people | Malawi reference: [NSO IHS5 2019/20](https://microdata.worldbank.org/catalog/3818) | One toilet serves one household. Not auto-filled for other countries. |
| `avgToiletCost` | Avg Toilet Cost | 100 | USD / USD | Malawi reference: [UNICEF Malawi sanitation revolving funds](https://www.unicef.org/malawi/media/3886/file/Sanitation%2520Revolving%2520Funds%2520for%2520Rural%2520and%2520Peri-Urban%2520Communities%2520in%2520Malawi.pdf) | Rounded 2024-USD planning value; the cited 2020 rural VIP retail price was $83.80. Replace with a current local bill of quantities. |
| `avgAnnualIncome` | Avg Annual Income | 600 | USD/year / USD/year | observed: `NY.GNP.PCAP.CD`, falling back to `NY.GDP.PCAP.CD` | Used only to value saved time; it is not household disposable income. |

## Delivery network

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `districts` | Administrative Units | 28 | count / count | Malawi reference: official district count | With enterprises per unit, sets the network ceiling. It is not fetched because third-party administrative-unit data mixed districts and regions. |
| `mePerDistrict` | Micro-enterprises / Unit | 20 | count / count | programme assumption | Capacity ceiling, not an observed country statistic. |
| `toiletsPerMeMonth` | Toilets / ME / Month | 7 | count/month / count/month | programme assumption | Flat productivity; no learning, seasonality, or supply-chain lag. |
| `meSetupCost` | ME Setup Cost | 3,000 | USD / USD | Malawi reference: [UNICEF Malawi sanitation revolving funds](https://www.unicef.org/malawi/media/3886/file/Sanitation%2520Revolving%2520Funds%2520for%2520Rural%2520and%2520Peri-Urban%2520Communities%2520in%2520Malawi.pdf) | Approximate enterprise-loan size, added to working capital by `meCapitalRequirement()`. |

## Lending terms

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `loanInterestRate_v2` | HH Loan Interest Rate | 40 | percent / decimal | programme assumption | Illustrative annual portfolio rate; never derived from CPI or commercial lending. Zero is valid. |
| `meLoanInterestRate_v2` | ME Loan Interest Rate | 10 | percent / decimal | programme assumption | Illustrative annual portfolio rate. Zero is valid. |
| `termHh` | HH Loan Term | 12 | months / months | Malawi reference: UNICEF reports 3–12 months | Affects affordability and realised loss exposure. |
| `termMe` | ME Loan Term | 12 | months / months | Malawi reference: UNICEF enterprise loans | Loan tenor for enterprise capital. |
| `hhDefaultRate` | HH Annual Write-down Rate | 5 | percent / decimal | programme assumption | Continuous annual hazard on outstanding balance, not “share of borrowers failing.” At the 12-month default, 5% headline produces about 2.81% realised loss on disbursed principal. Zero is valid. |
| `meDefaultRate` | ME Annual Write-down Rate | 5 | percent / decimal | programme assumption | Same convention as household write-down; reduces portfolio value, not enterprise capacity. Zero is valid. |
| `meExitRate` | ME Annual Closure Rate | 10 | percent / decimal | programme assumption | Reduces productive capacity and is deliberately separate from loan write-down. |
| `meExpansionBudgetShare` | ME Expansion Budget Share | 10 | percent / decimal | programme assumption | Share of lendable cash available for enterprise expansion each month. |
| `meMaxMonthlyGrowthRate` | ME Max Monthly Growth Rate | 10 | percent / decimal | programme assumption | Ceiling on monthly network growth; a strong driver of reach. |
| `grantSupportPct` | Grant-Funded Pacing | 10 | percent / decimal | policy choice | Target share of monthly production funded from the grant ledger. This controls pacing, not total subsidy depth. |

## Costs

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `annualFixedOpsCost` | Annual Fixed Ops Cost | 60,000 | USD/year / USD/year | programme assumption | Inflated monthly; falls to the 30% collections floor in hibernation and stops at wind-up. |
| `mgmtFeeRatio` | Mgmt Fee Ratio | 1 | percent / decimal | programme assumption | Variable fee charged on each disbursement. |
| `meCostRate` | M&E Cost | 2 | percent / decimal | programme assumption | Monitoring-and-evaluation cost charged on each disbursement. |
| `contingencyRate` | Cost Contingency | 5 | percent / decimal | programme assumption | Per-unit delivery-cost mark-up, not a reserve and not a governance-index transform. |
| `opsReserveCap` | Starting Capacity Throttle | 15 | percent / decimal | programme assumption | Sizes only the month-0 enterprise cohort. The rolling solvency reserve is separately derived as three months of full fixed ops plus the next three months of scheduled investor principal. |
| `inflationRate` | Annual Cost Escalation in Model Currency | 3.32 | percent / decimal | programme assumption | Escalates USD-labelled unit and fixed operating costs. Local-currency CPI is displayed as context but is not applied without an exchange-rate path. |

## Impact

| id | Label | Default | Entered / model unit | Source | Meaning |
|---|---|---:|---|---|---|
| `dalyPerPerson` | DALYs Averted / Person | 0 | DALY/person/year / same | unsupported by default | Set only from an approved programme impact study. Zero prevents an unsupported health claim from entering SROI. |
| `dalyValue` | Value per DALY | 0 | USD/DALY / same | unsupported by default | Included in SROI when supplied; zero by default because no approved Malawi valuation was identified. |
| `co2PerToilet` | CO2e / Toilet | 0 | tonnes/toilet/year / same | unsupported by default | Carbon is off until a methodology supplies an abatement factor. Accrual stops at service-life expiry. |
| `co2Value` | Value per Tonne CO2e | 15 | USD/tonne / same | programme assumption | Used only when an abatement factor is supplied. |
| `carbonCreditShare` | Fund Carbon Share | 50 | percent / decimal | programme assumption | Fund share after transaction and verification costs. |
| `timeValueFactor` | Value of Saved Time | 50 | percent / decimal | Malawi reference: [World Bank Lilongwe project appraisal](https://documents1.worldbank.org/curated/en/419171513998119839/pdf/MALAWI-PAD-12012017.pdf) | Applies 50% of income per working hour, following the appraisal’s conservative opportunity-cost convention. |
| `toiletLifespanYears` | Toilet Service Life | 5 | years / years | programme assumption | Gates carbon, DALYs, and time-saved benefits. Does not create replacement demand. |
| `hoursPerPersonPerDay` | Hours Saved / Person / Day | 0.25 | hours/day / same | Malawi reference: World Bank appraisal | Fifteen minutes per person per day. |

## Country-data boundary

The World Bank client requests the latest non-empty observation (`mrnev=1`) and preserves its year. It writes only:

| Model input | Indicator |
|---|---|
| population needing toilets | `SP.RUR.TOTL` and `SH.STA.BASS.RU.ZS` |
| population growth | `SP.POP.GROW` |
| annual income proxy | `NY.GNP.PCAP.CD`, falling back to `NY.GDP.PCAP.CD` |

Safely managed sanitation, CPI inflation, commercial lending, Gini, and poverty are dated context only. Missing essential observations clear the affected field and pause automatic calculation; they never reuse the previous country’s value. Programme terms, costs, capacity, write-downs, and subsidy policy remain the user’s responsibility for every country.

## Controller-only inputs

| id | Meaning |
|---|---|
| `countryInput` | Chooses the ISO country used by the World Bank fetch; passed to the model as a label only. |
| `enableBreakEvenSolver` | Turns the solver panel on or off; not part of the monthly mathematics. |

Every other collected input reaches `ModelModule`; `tests/wiring.test.js` enforces this. No function may inspect a number’s magnitude to infer whether it is a percentage. That convention is fixed by [ADR-0012](adr/0012-percentage-entry-convention.md).
