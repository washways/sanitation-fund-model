# Changelog

All notable changes to this project — anything that alters what the model produces, what a user sees, or how the project is worked on. Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versions are dated working sessions, not formal releases (this project is pre-1.0).

**Rules for updating this file:**

1. Add the entry **in the same commit** as the change it describes.
2. If `tests/golden.json` moved, say so and say by how much — a reader needs to know whether their old numbers still stand.
3. Write for someone who was not there. "Fixed carbon" tells nobody anything; "carbon revenue was understated by roughly 250,000x because tonnes were treated as kilograms" does.
4. Link the decision record (`docs/adr/`) and the finding (`docs/ANALYSIS.md`) where one exists.

---

## [0.20.0] — 2026-10-23 — Verdicts read the right ledger and the right window

### Changed

- **Solvency is judged on the loan ledger, not the pooled balance.** The loan ledger pays debt service and operations; grant cash is ring-fenced and cannot. The viability check (V1), depletion year, months insolvent, minimum cash and ops coverage now read loan-ledger cash. A $5.0m grant with a $0.5m loan previously reported *never insolvent* and a 79.7-year runway while the loan ledger fell to -$32,588. ([ADR-0057](docs/adr/0057-judge-solvency-on-the-loan-ledger.md), F-66)

- **The repayment term and the horizon are independent inputs.** Editing one no longer rewrites the other. Two listeners bound them, one of them unguarded and two-way, so a fund longer than its debt could not be modelled. No test saw it because the harness never fired the browser's `load` event; it does now. ([ADR-0058](docs/adr/0058-separate-repayment-term-from-horizon.md), F-67)
- **Senior repayment is judged against what was due.** V2 now fails only on scheduled principal that fell due and was not paid. Principal scheduled after the horizon is shown as *not yet due* in the export, not as a default. A 5-year horizon with a 10-year term previously read "52.6% default". Only the `short horizon (1y)` scenario changes verdict.

### Golden movement

- `grant capital only`: depletion `Sustainable` → `0.0`, months insolvent 0 → 60. With no loan capital, nothing can pay operations.
- `demand constrained`: `Sustainable` → `4.5`, 0 → 6. `capacity constrained`: `Sustainable` → `4.4`, 0 → 7. `high ME attrition`: `Sustainable` → `4.9`, 0 → 1.
- `high defaults (40%)`: depletion 4.3 → 3.2, months insolvent 8 → 22.
- New fingerprint field `minLoanCash` in all 21 scenarios. No cash flow, toilet, net-asset or repayment figure moved. The Malawi baseline verdict is unchanged.

---

## [0.19.8] — 2026-10-22 — The social value ratio is no longer called an SROI

### Changed

- **"SROI Ratio" is now "Gross Social Value Multiple."** The ratio sums monetised DALYs, time saved and carbon over the run without discounting and applies no deadweight, attribution, displacement or drop-off, so it does not meet the Social Value International or Green Book definition of SROI. The dashboard tooltip, the clipboard report, the CSV export and the methodology now say so and list the missing adjustments. ([ADR-0056](docs/adr/0056-label-the-gross-social-value-multiple-honestly.md), F-65)
- **`grossSocialValueMultiple` is the canonical KPI field.** The `sroi` field and the `sroi` sensitivity metric remain as identical legacy aliases so existing sensitivity specification files keep working.
- **No generic adjustment percentages were invented.** A formal SROI remains unavailable until the programme supplies a counterfactual, attribution, displacement, time profile, discount rate and valuation basis.

### Documentation

- A robustness and logic review registered findings F-66 to F-73 in [docs/ANALYSIS.md §4B](docs/ANALYSIS.md) and open questions Q15–Q18 in [docs/MODEL_SPEC.md §13](docs/MODEL_SPEC.md). Three spec rules were corrected to describe the code as built. [docs/PARAMETERS.md](docs/PARAMETERS.md) gained a table of fixed model constants. Hard-coded test and finding counts were removed from AGENTS.md, README.md and TESTING.md.

### Golden movement

None. Labels and documentation only; the Malawi reference remains 2.73x and all 21 recorded scenarios are unchanged.

---

## [0.19.7] — 2026-10-22 — Monthly audit card is independent of chart sizing

### Fixed

- **Monthly Implementation Data no longer inherits the fixed-height chart component.** The first containment fix relied on a later CSS height override while leaving the audit table classified as a chart, so its background could still render incorrectly when the cascade or viewport changed. The section now owns its complete card box and locally contains its bounded two-axis scrolling table. ([ADR-0055](docs/adr/0055-decouple-the-monthly-audit-card-from-chart-sizing.md), F-61 follow-up)
- **The audit trail remains complete.** Five-year and longer scenarios retain every monthly row, sticky column headings, and horizontal and vertical scrolling; nothing is clipped or summarised away.
- **The regression now forbids reintroducing the chart class.** It also requires the dedicated card to define its own background, padding, radius, shadow, sizing, and overflow contract.

### Golden movement

None. This is a layout-only correction; inputs, calculations, table contents, and all 21 recorded scenarios are unchanged.

---

## [0.19.6] — 2026-10-22 — Population need is no longer presented as forecast demand

### Changed

- **The country-derived field is now “Rural Population Without Basic Sanitation.”** It is an observed measure of need, not a forecast of willing or eligible borrowers. ([ADR-0054](docs/adr/0054-distinguish-population-need-from-borrower-demand.md), F-64)
- **The dashboard now reports “Share of Unserved Rural Target Reached,” not “SDG6 Gap Closed.”** The model does not test construction quality or every SDG 6.2 service criterion, so the old label overstated what the ratio proved.
- **The methodology exposes the full-uptake condition.** It explains that the API does not observe willingness to borrow, affordability, eligibility, product choice, or monthly adoption. Calculated toilets are conditional delivery potential under sufficient uptake, not an adoption forecast.
- **No unsupported uptake rate was invented.** The cited Malawi pilot’s 80% geographic target is not treated as borrower uptake; decision users are directed to programme market research or explicit scenario bounds.

### Golden movement

None. Terminology and limitations changed; all numeric calculations and all 21 recorded scenario results are unchanged.

---

## [0.19.5] — 2026-10-22 — Sustainability scorecard uses canonical metrics

### Fixed

- **Grant Equity Multiple no longer shows a false `0.0%`.** The live renderer read a nonexistent field and used the wrong unit; the Malawi reference now displays its canonical value of about `0.18x`. ([ADR-0053](docs/adr/0053-use-canonical-sustainability-scorecard-metrics.md), F-63)
- **Capital Preservation replaces an invented loan-recovery proxy.** It reports ending net assets divided by all initial capital. Senior repayment remains a separate exact principal and percentage measure; ring-fenced grant cash is not presented as investor recovery.
- **OSS and FSS now have distinct, accurate labels and definitions.** OSS covers operating costs only; FSS additionally includes portfolio write-downs and investor interest. The Malawi reference displays about 165% OSS and 106% FSS.
- **One renderer now owns the programme summary.** An unused parallel renderer with competing formulas and stale field names was removed, and the browser-path regression pins the visible values to canonical KPIs.

### Golden movement

None. This release corrects displayed mappings and explanations only; engine values and all 21 recorded scenarios are unchanged.

---

## [0.19.4] — 2026-10-22 — Model flow and calibration are visible on site

### Changed

- **The application now links directly to a five-step “How it works” map.** It traces dated evidence and assumptions through the separate grant and loan ledgers, monthly waterfall, enterprise capacity, loan cohorts, and reported results. ([ADR-0052](docs/adr/0052-put-the-model-flow-and-calibration-path-on-site.md), F-62)
- **A decision-use checklist makes calibration explicit.** It tells users to verify dated blue country values, replace material amber assumptions with programme evidence, test delivery and financing assumptions, and report sensitivities plus both verdicts.
- **Unsupported capability claims are removed.** The splash no longer calls dated observations real-time, says interest rates affect demand, describes the model as double-entry accounting, or suggests a scenario can guarantee repayment.
- **Parameter-documentation coverage is now enforced.** A regression fails if any numeric control read by the UI lacks a complete row in the canonical parameter dictionary; all 41 currently pass.

### Golden movement

None. This release changes explanation and verification only; inputs, formulas, KPIs, and all 21 recorded scenarios are unchanged.

---

## [0.19.3] — 2026-10-22 — Monthly audit table stays inside its panel

### Fixed

- **Monthly Implementation Data no longer extends below its white card background.** The section had inherited the generic 400px chart height while its table viewport could reach 500px, so ordinary five-year results visibly spilled out of the panel. ([ADR-0051](docs/adr/0051-contain-the-monthly-audit-table-vertically.md), F-61)
- **Long audit tables now scroll locally in both directions.** The 22 readable no-wrap columns retain horizontal scrolling, while long horizons gain a bounded vertical scrollbar instead of lengthening beyond the card.
- **Column headings remain visible while scrolling through months.** A layout regression pins the dedicated auto-height card, two-axis containment, and sticky header row.

### Golden movement

None. This release changes presentation only; monthly values, formulas, KPIs, and all 21 recorded scenarios are unchanged.

---

## [0.19.2] — 2026-10-21 — Cross-country and parameter robustness audit

### Added

- **The live country audit now runs the complete model with every country’s current derived World Bank inputs.** It mirrors the browser’s whole-person target, two-decimal growth-rate entry, and whole-dollar GNI/GDP fallback before validating and calculating each scenario. The current audit passes for all 44 selector countries, not just Malawi. (F-60)
- **A permanent deterministic robustness test exercises 384 valid parameter combinations.** It spans capital structures, horizons, demand, growth, inflation, borrower rates, defaults, enterprise attrition and capacity, costs, health, carbon, and time-value assumptions. Every case must preserve the full ledger-invariant set.
- **Pure country-derivation helpers are now covered without live network calls.** CI tests both the GNI-over-GDP choice and the safe refusal of incomplete observation sets, while the optional live audit continues to expose changing API coverage.

### Golden movement

None. This release strengthens verification only; it does not change inputs, formulas, UI behavior, or any of the 21 recorded scenario results.

---

## [0.19.1] — 2026-10-21 — Financial assumptions show relevant API context

### Changed

- **Household and enterprise loan rates now show the dated country commercial-lending benchmark beside each control.** The benchmark is context for product pricing, not an auto-filled APR: an actual term also needs cost of funds, servicing cost, losses, affordability, subsidy, and margin. Malawi retains the 40% and 10% illustrative programme assumptions while showing 37.1% commercial lending for 2024. ([ADR-0050](docs/adr/0050-show-api-benchmarks-without-inventing-programme-terms.md), F-59)
- **Annual fixed operating cost now states why it cannot be derived from a country macro API.** Users are directed to enter a real staffing, office, vehicle, systems, audit, and field-service budget instead of a fabricated per-capita or percentage-of-capital formula.
- **USD cost escalation now shows dated local-currency CPI beside the control without applying it.** Malawi shows 28.4% local CPI for 2025, while the model retains its 3.32% USD cost-escalation assumption pending an exchange-rate and programme cost-basket forecast.
- **The visual distinction is explicit.** Blue fields are observed or transparently derived country data; amber fields are programme assumptions that APIs may inform but never set. A startup regression pins all four unchanged values, colours, dated benchmarks, and limitations.

### Golden movement

None. This release changes guidance and provenance only. All financial outputs, the post-fetch Malawi scenario, and all 21 recorded scenarios are unchanged.

---

## [0.19.0] — 2026-10-21 — Impact estimates are explicit and evidence-linked

### Changed

- **The Jobs chart now works and agrees with the headline.** A new editable `Jobs Supported / Active ME` assumption defaults to three for the Malawi reference case: one owner/operator plus two full-time-equivalent workers. Both outputs now use active enterprises × this assumption and are labelled “jobs supported,” not jobs created or job-years. The unsupported `$3,000/job` display is removed. ([ADR-0049](docs/adr/0049-derive-health-and-report-impact-honestly.md), F-56)
- **Country loading now derives a conservative sanitation DALY burden factor.** It divides the WHO lower uncertainty bound for diarrhoeal DALYs attributable to inadequate sanitation by the matching-year World Bank population without basic sanitation. Malawi 2019 produces `0.0096719` burden DALY per exposed person-year. The blue field names both APIs and the year. (F-57)
- **A separate, editable 21% health-effect assumption avoids treating all attributable burden as averted.** The default is the 2022 meta-analysis point estimate for basic sanitation without sewer connection versus unimproved/limited sanitation (RR 0.79; 95% CI 0.61–1.03, moderate certainty). It produces about 2,139 physical DALYs averted in the five-year Malawi reference. DALY value remains zero, so SROI does not change.
- **Missing health evidence fails safely.** A 44-country live audit found the derivation available for 42 countries. Eritrea lacks the matching World Bank exposure data and Tuvalu lacks the WHO numerator; they display not estimated. A missing WHO lower bound also resets the factor instead of being coerced to numeric zero.
- **Carbon no longer displays an unevidenced zero as a measured result.** The factor remains safely off until a project-specific baseline and technology methodology is supplied. The summary, chart, and export say “Not estimated — project factor required”; user/toilet counts alone do not create an emissions factor. (F-58)
- **All four country-derived model inputs are visibly blue.** Target population, population growth, income, and the WHO/World Bank DALY derivation share the same editable provenance treatment.
- **Four new regressions cover the jobs formula, zero case, and explicit health effect; startup and render-path tests cover the DALY calculation, missing-evidence fallback, jobs chart, and carbon limitation.** The suite now has 122 tests across 16 files.

### Golden movement

None. Static defaults retain a zero DALY factor, the existing jobs headline remains 801 because its former hidden multiplier is now the explicit default, and all financial outputs and 21 recorded scenarios are unchanged. The post-fetch Malawi browser scenario gains the physical DALY count only; its SROI remains 2.73 because DALY valuation is still zero.

---

## [0.18.1] — 2026-10-21 — Programme summary fits the page

### Fixed

- **The programme-summary cards now reflow to the available main-panel width.** The old inline layout always demanded three columns even after the fixed sidebar had consumed much of a laptop or tablet viewport. Cards now use an auto-fitting grid and move to two or one column when needed. ([ADR-0048](docs/adr/0048-fit-programme-summary-to-viewport.md), F-55)
- **Long summary labels and values wrap inside their cards.** A global rule had forced every summary cell to be at least 100px wide and prevented wrapping, which pushed the entire results area off-page.
- **Only the monthly audit table remains deliberately wide.** Its 22 columns stay readable and scroll horizontally inside their own bounded container instead of widening the page.
- **Two layout regressions pin the contract.** They require an adaptive grid, wrapping summary cells, and monthly-table-only no-wrap behavior.

### Golden movement

None. This release changes presentation only; all model calculations and the 21 recorded scenarios are unchanged.

---

## [0.18.0] — 2026-10-21 — Enterprise rollout starts as a pilot

### Changed

- **The model no longer launches the largest enterprise cohort that cash can buy before month one.** The Malawi default previously created 285 of the eventual 560 enterprises at time zero, lent them $3.249m, and therefore recorded $25,797 of enterprise interest and $259,190 of principal in month one. The arithmetic matched the cohort, but the instant national-scale mobilisation did not. ([ADR-0047](docs/adr/0047-start-with-a-pilot-enterprise-network.md), F-54)
- **A new `Initial ME Network (% of Target)` control starts an explicit, affordable pilot.** The 15% default starts 84 enterprises in Malawi and produces about $7,603 of month-one enterprise interest. Available loan capital and the network ceiling remain hard caps; an explicit zero seeds no hidden cohort.
- **The 15% default preserves a modest operating margin.** A smaller 10% pilot was also tested and repaid senior debt, but its five-year FSS was 0.995. At 15%, the network grows to about 232 enterprises by month 12 and 314 by month 24, senior principal is fully repaid, FSS is 1.064, and net assets are about $176,782.
- **The old capital holdback is removed.** `Starting Capacity Throttle` subtracted a percentage of combined grant and loan capital from the loan ledger only for month-zero sizing, then disappeared. The rolling reserve remains three months of full fixed operations plus the next three months of scheduled investor principal.
- **Three regressions pin the rollout contract.** They require the 15% Malawi pilot, affordability cap, continued network growth, full baseline senior repayment, operating margin, and a genuine zero-seed case.

### Golden movement

This intentional assumption correction changes 559 recorded values across the 21 scenarios. In the Malawi baseline, startup enterprises fall **285 → 84**, startup lending **$3.249m → $0.958m**, five-year toilets **118,509 → 83,350 (-29.7%)**, net assets **$472,563 → $176,782 (-62.6%)**, FSS **1.19 → 1.06**, and SROI **4.09 → 2.73**. The reference scenario remains solvent, internally consistent, and fully repays senior debt.

Stress cases become appropriately more conservative: the 8% cost-of-capital case repays 85.1% of senior principal, high inflation repays 94.4%, and high enterprise attrition repays 99.5%. The capital-constrained case starts 43 rather than 35 enterprises because the obsolete formula had incorrectly withheld a share of grant capital from the loan ledger. These movements follow ADR-0047 and are not tuned away.

---

## [0.17.0] — 2026-10-21 — Country-derived inputs are visibly sourced

### Fixed

- **All three model inputs written from World Bank data now share one clear blue provenance state.** Target population (derived from rural population and basic-sanitation access), population growth, and income per person are marked consistently after a country load. Each field records a source description and observation year(s). ([ADR-0046](docs/adr/0046-mark-country-derived-inputs-consistently.md), F-53)
- **The marker now tells the truth after editing.** Programmatic events during loading retain the World Bank state; a real user edit removes the blue treatment and records the value as user-entered. The old code removed the class from two formatted fields immediately, retained it on the third, and left an inline colour behind after editing.
- **Programme loan prices no longer carry misleading `api-field` labels.** Commercial lending remains dated context and does not colour or overwrite the household, enterprise, or fund term sheet.
- **The startup harness now tracks real element classes and formatted-number listeners.** Its new regression checks the exact post-fetch state a browser displays and verifies that user edits clear provenance.

### Golden movement

None. This release changes presentation and provenance only. All 21 recorded scenarios and the Malawi startup numbers are unchanged.

---

## [0.16.0] — 2026-10-21 — Evidence-bounded sensitivity analysis

### Added

- **A deterministic one-at-a-time sensitivity engine now compares up to eight explicit parameter ranges.** It runs one baseline plus each distinct low/high case, then ranks parameters by the selected outcome swing. Every case reports net assets, ending and minimum cash, toilets, senior repayment, SROI, and viability. ([ADR-0045](docs/adr/0045-require-evidence-bounded-sensitivity.md))
- **Every range must carry provenance.** Bounds must be finite, bracket the base value, pass the normal model validator, use a unique numeric input, and include a non-empty source. Unsupported metrics, duplicate or unknown inputs, invalid cases, and a ninth range return a typed failure rather than a partial analysis.
- **The CLI is reproducible and project-contained.** `npm run sensitivity -- <bounds.json> [inputs.json]` prints deterministic JSON, performs no network fetch, adds no timestamp, and refuses to read files outside the repository. No built-in Malawi range or generic percentage shock was invented.
- **The browser/model load order is now tested directly.** `index.html` must load exactly the same application files, in the same order, as `tools/app-source.js`; the new model module cannot silently exist in tests but be absent in the app.

### Golden movement

None. Sensitivity is opt-in and delegates every case to the existing pure `calculate()` path. All 21 recorded scenarios and the Malawi startup are unchanged.

---

## [0.15.0] — 2026-10-21 — Production constraints follow actual output

### Changed

- **The production-constraint headline now comes from the production allocation it explains.** The old monthly label was computed before grant affordability and final output were known, while the headline independently guessed from reach, minimum cash, and insolvency. The two could disagree with each other and with the actual bottleneck. ([ADR-0044](docs/adr/0044-report-actual-production-constraints.md), Q14 / R-7.6)
- **Primary and secondary constraints are both visible.** Monthly unmet output is partitioned between enterprise capacity and loan capital. Grant capital is reported separately as the output recoverable by fully funding the intended grant allocation while leaving loan capacity unchanged. Months affected by more than one cause are labelled `Mixed`.
- **The horizon headline ranks foregone monthly output, not constrained-month counts.** For the Malawi reference run, enterprise capacity is primary; loan capital and grant capital are secondary. Insolvency remains in the separate viability verdict instead of being substituted for a production constraint.
- **All original modelling questions are now resolved.** The owner also selected evidence-bounded one-at-a-time sensitivity analysis, retained the disclosed adverse 20-year Malawi stress result, retained an explicitly USD-only engine for now, and prioritized transparent JSON scenario comparison after sensitivity analysis.
- **A dedicated three-test regression now protects the explanation.** It reconciles monthly demand to production, verifies the Malawi primary/secondary ranking, and ensures a satisfied demand target receives no invented bottleneck.

### Golden movement

Only `dominantConstraint` changes in 20 of 21 scenarios. The demand-constrained scenario remains `Demand Met (Success)`. Every numeric field — cashflow, production, reach, impact, balance sheet, viability, and solver output — is unchanged.

---

## [0.14.0] — 2026-10-21 — Partial-year horizons fully reported

### Fixed

- **Valid month-granular horizons no longer disappear from annual views.** Duration already accepts any whole number of months, but annual series were recorded only at exact 12-month boundaries. A 6-month Malawi run built 12,814 toilets yet returned no annual labels, rows, or charts. An 18-month run built 43,802 toilets while every annual view stopped at month 12. ([ADR-0043](docs/adr/0043-report-final-partial-year.md), F-52)
- **The final partial period now uses the same aggregation path as complete years.** A 6-month run reports `Year 1 (6 months)`; an 18-month run reports `Year 1` and `Year 2 (6 months)`. Period flows sum the remaining months and cumulative reach snapshots the actual horizon end.
- **Both core and render paths are pinned.** Regressions reconcile partial-period grants and final toilets to monthly data, and require a valid 6-month scenario to produce Chart.js configurations rather than returning early.

### Golden movement

None. All 21 recorded scenarios and the Malawi startup use whole-year horizons, so their outputs are unchanged. Only previously omitted partial-period reporting is added.

---

## [0.13.0] — 2026-10-21 — Correct annual grant cash-flow chart

### Fixed

- **The annual chart no longer turns falling grant spending into income.** The engine stores separate yearly grant flows, but the chart treated them as cumulative and differenced adjacent years. In the Malawi reference run, actual grant spending of about $278k, $356k, $292k, $0, and $0 was plotted as -$278k, -$78k, **+$64k**, **+$292k**, and $0. The positive bars were fictitious grant inflows, including $292k in a year with no grant spending. ([ADR-0042](docs/adr/0042-chart-annual-grants-as-flows.md), F-51)
- **Grant spending is now negated exactly once.** Correct chart values are about -$278k, -$356k, -$292k, $0, and $0, reconciling directly to the annual results table.
- **The render-path test now captures Chart.js configuration.** It compares the public `Grants` dataset to the engine's annual series and requires every grant value to be an outflow. The card heading now accurately says `Annual Cash Flow Breakdown` rather than `Annual Cost Breakdown`.

### Golden movement

None. The grant ledger, cashflows, KPIs, viability, 21 recorded scenarios, and Malawi startup are unchanged; only the chart's interpretation of an existing annual series changed.

---

## [0.12.0] — 2026-10-21 — Zero capacity means zero capacity

### Fixed

- **An explicit zero enterprise-capacity input is no longer replaced by the default.** `Micro-enterprises / Unit` is a non-negative whole-number assumption, but the engine used `value || 20`; JavaScript therefore treated 0 as absent and silently restored 20. In the Malawi reference scenario, entering 0 previously produced the same 285 startup enterprises, 345 ending enterprises, 118,509 toilets, and viable verdict as entering 20. ([ADR-0041](docs/adr/0041-honor-zero-enterprise-capacity.md), F-50)
- **The validated model now honors the supplied value directly.** A zero-capacity stress now has no enterprise cohort, no production, about 87.8% of senior principal repaid, and a non-viable verdict. Missing or malformed values still fail at the input boundary rather than receiving a hidden fallback.
- **A regression pins the adverse scenario.** It requires zero startup and active enterprises, zero toilets, and a non-viable result when the user explicitly enters zero.

### Golden movement

None expected. None of the 21 recorded scenarios or the Malawi startup uses zero enterprises per unit. The default remains 20 and its headline results are unchanged.

---

## [0.11.0] — 2026-10-21 — Accurate monthly implementation table

### Fixed

- **Monthly values now sit under the correct headings.** Data rows had 25 cells but the table had 24 headers. The unlabeled extra cell shifted the ME loan value, ME repayments, operating costs, investor payments, net cash flow, and ending cash one column to the right. Count and value now have explicit `New MEs` and `New ME Loans` headings. ([ADR-0040](docs/adr/0040-report-exact-me-launches.md), F-49)
- **New-enterprise counts now come from the simulation.** The table divided ME loan value by setup cost even though each loan also includes working capital. At the current Malawi defaults that displayed 3.8 times the enterprises actually launched in expansion months. The engine now exposes the exact monthly launch series, and the UI uses it without reconstructing model logic.
- **A render-path regression checks the table itself.** Every startup/monthly row must have the same number of cells as the header, and every monthly ME loan value must reconcile to the exact launch count and canonical capital requirement.

### Golden movement

None expected. This corrects a user-facing audit table and adds a reporting series; cashflows, KPIs, viability, all 21 recorded scenarios, and the post-fetch Malawi startup remain unchanged.

---

## [0.10.0] — 2026-10-21 — One model-tested advice path

### Fixed

- **The visible advice button no longer bypasses the safe advisor.** It previously called a legacy rule set that recommended extending the investor term even though F-32 demonstrated that this can worsen repayment, and recommended grant pacing as a scale lever despite F-30. The button now recalculates the current scenario and renders only changes that `ModelModule.suggestSolvencyFix()` has actually simulated. ([ADR-0039](docs/adr/0039-one-model-tested-advice-path.md), F-48)
- **The misleading “AI Advisor” label is gone.** The control is now `Review model-tested advice`: the tool is explicit that recommendations come from deterministic scenario reruns, not artificial intelligence.
- **The unsafe duplicate advisor was deleted.** Advice is shown on-page beside the viability result rather than in a modal assembled from live inputs and older stored results.

### Golden movement

None. The simulation, KPIs, all 21 recorded scenarios, and the post-fetch Malawi startup are unchanged; only the public advice route and wording changed.

---

## [0.9.0] — 2026-10-21 — Trustworthy scenario exports

### Fixed

- **Exports now describe the run that produced their results.** Every successful calculation retains an input snapshot. CSV and clipboard reports use it instead of rereading a form that may have been edited during the recalculation debounce. A pending edit can no longer relabel an older result. ([ADR-0038](docs/adr/0038-export-the-calculated-scenario.md), F-47)
- **The copied balance sheet now reports the tracked senior liability.** It previously reconstructed liability as original loan minus principal repaid and omitted capitalised interest. In the audit stress run it reported $2.741m instead of $4.068m, a $1.328m understatement.
- **Copied leverage now matches the canonical KPI and dashboard.** The stress report previously showed 0.8x from an unrelated formula; it now reports the model's 2.9x definition. Export code no longer maintains parallel formulas for either measure.

### Golden movement

None. The model, KPI definitions, all 21 recorded scenarios, and the post-fetch Malawi startup are unchanged; only exported provenance and reporting are corrected.

---

## [0.8.0] — 2026-10-21 — Fail-fast input validation

### Fixed

- **Invalid inputs can no longer enter the monthly simulation.** The pure model now rejects blank, malformed, non-finite, and mathematically invalid values before allocating arrays or running month 1. A 150% annual write-down previously generated dozens of `NaN` values while viability still reported true; zero household size created an infinite backlog beside plausible headline finances; negative duration crashed with `Invalid array length`. These cases now produce no result. ([ADR-0037](docs/adr/0037-fail-fast-input-validation.md), F-46)
- **The browser reports all detected fields together.** Blank form controls no longer silently restore hidden fallback assumptions. A failed rerun clears the prior result so exports and advice cannot be mistaken for the changed scenario.
- **Validation stays evidence-neutral.** The rules enforce only arithmetic and parameter definitions—such as positive denominators and terms, non-negative costs, bounded shares/hazards, and whole discrete periods. The model does not invent policy caps for rates, prices, capital, or programme scale.
- **Two stale form details were corrected.** The duplicate `step` attribute on cost of capital was removed, and the service-life help now correctly says carbon, health, and time benefits all stop at expiry.

### Golden movement

None. All 21 recorded scenarios and the post-fetch Malawi startup are valid and produce unchanged results.

---

## [0.7.0] — 2026-10-21 — Complete investor debt settlement

### Fixed

- **Capitalised investor interest can now be repaid.** Previously it increased the senior liability and an arrears counter that could never fall. The waterfall now pays old capitalised interest, current interest, then original principal; paying old interest reduces both arrears and the liability. ([ADR-0036](docs/adr/0036-complete-investor-debt-waterfall.md), F-44)
- **Wind-up now settles available loan cash before freezing.** Remaining original principal accelerates, positive loan-ledger cash goes to the senior investor, and any unpaid balance stays visible. Grant cash remains ring-fenced. A no-demand regression now transfers $172,237 at wind-up instead of reporting it as idle fund cash. Net assets are unchanged because cash and liability fall together. ([ADR-0036](docs/adr/0036-complete-investor-debt-waterfall.md), F-45)
- **The senior balance is now self-reconciling.** INV-20 checks principal and capitalised-interest flows; INV-21 rejects stranded terminal loan cash. Six focused regressions exercise non-finite propagation, payment ordering, new arrears, terminal acceleration, reconciliation, and wind-up settlement.

### Golden movement

The Malawi baseline and all headline results are unchanged. Four stressed scenarios move as predicted by the new ordering or gain more honest arrears reporting:

- At 8% cost of capital, $297 of old interest is cured but the same cash constraint rolls a similar amount of current interest; cumulative capitalisation rises 4.5% while ending cash, liability, net assets, principal repaid, and interest paid are unchanged.
- The demand-constrained case redirects $537 from original principal to older interest. Total principal falls 0.01%, investor interest rises 0.24%, and cost per latrine rises 0.01%; ending cash, liability, and net assets are unchanged.
- High-default and capital-constrained wind-ups now classify all unpaid accelerated original principal as principal arrears. Their cash, liability, net assets, reach, and viability do not change.

### User-facing record

The model links directly to `changelog.html`. The page uses simple release bullets and lists remaining limitations without requiring GitHub access.

---

## [0.6.0] — 2026-10-21 — Evidence-based Malawi defaults and safe country loading

A post-S5 review found six new defects in the assumptions, country-data path, and two core edge cases. F-38–F-43 are fixed; two investor-settlement defects found during the review (F-44/F-45) are registered and deliberately left for a separate debt-waterfall ADR.

### Fixed

- **Country observations no longer become programme policy.** The loader now changes only rural population without basic sanitation, population growth, and GNI per capita (GDP fallback). Dated CPI, commercial lending, poverty, Gini, and sanitation remain visible context. It no longer derives loan pricing, grant pacing, write-downs, contingency, costs, operating budgets, or delivery capacity from unrelated indicators. ([ADR-0034](docs/adr/0034-observations-only-country-data.md), F-38–F-40)
- **Country switching cannot silently reuse another country's data.** World Bank requests use latest-non-empty observations (`mrnev=1`), retain years and labels, ignore stale async responses, and clear essential fields plus pause automatic calculation when data are missing. The mixed-level `countriesnow.space` dependency was removed. ([ADR-0034](docs/adr/0034-observations-only-country-data.md), F-40)
- **Explicit 0% household and enterprise write-downs now remain zero.** Falsy fallbacks previously changed them to 5% and 10%, so the “zero defaults” scenario was not zero. A full-model regression now checks the actual write-off series. ([ADR-0035](docs/adr/0035-zero-writedowns-and-demand-order.md), F-42)
- **Demand now grows before current production is subtracted, as R-7.1 specifies.** The monthly backlog is exported as an audit series and INV-19 pins the recurrence. ([ADR-0035](docs/adr/0035-zero-writedowns-and-demand-order.md), F-43)
- **The startup test now behaves like a browser with multiple event listeners.** Its prior one-handler stub masked the real poverty-to-grant overwrite. It now pins exact post-fetch observations, exact preservation of programme assumptions, the 44-country selector, and the missing-data stop. (F-38)

### Changed

- **Malawi defaults are evidence-aligned.** The reference scenario now uses 9,244,139 rural people without basic sanitation, 2.56% population growth, $600 GNI per capita, 4.4 people per rural household, 28 districts, $3,000 enterprise capital, 12-month household and enterprise terms, 15 minutes saved per person per day, and a 50% time-value factor. The $100 toilet cost is retained with a UNICEF Malawi price basis. ([ADR-0034](docs/adr/0034-observations-only-country-data.md), F-41)
- **Unsupported health and carbon claims are off by default.** DALYs per person, DALY value, and CO2e per toilet default to zero until programme evidence is supplied. Financing, operating, write-down, capacity, and subsidy values are explicitly labelled illustrative assumptions rather than Malawi facts. (F-41)
- **Cost escalation is named honestly.** Local CPI is not applied to USD-labelled cashflows without an FX path; the input is now “Annual Cost Escalation in Model Currency.”
- **The release history and known limitations are now visible in the app.** The dashboard links to `changelog.html`, which summarizes the current numerical movement, earlier stages, the long-horizon warning, and open findings F-44/F-45.

### Golden movement

The combined movement matches the prewritten ADRs. Baseline reach rises **97,744 → 118,509 toilets (+21.2%)**, chiefly because the sourced 12-month household term releases working capital faster. Net assets fall **$914,174 → $472,563 (-48.3%)** and SROI falls **4.46 → 4.09**; DALYs fall **7,082 → 0** because the unsupported default is disabled. The fund remains viable and repays senior debt in full. In the corrected zero-write-down scenario, write-offs are exactly zero, reach is **140,766**, and net assets are **$1,273,743**.

### Known open findings

- **F-44:** capitalised interest grows the liability but is never scheduled for catch-up repayment.
- **F-45:** wind-up can freeze available loan cash before settling an outstanding investor liability.

Both require a coordinated debt-waterfall decision; they were not hidden inside this assumptions change.

---

## [0.5.0] — 2026-08-25 — Stage S5: app.js split into src/

`app.js` (4,028 lines) split into 14 files under `src/` — `src/model/` (pure, no DOM), `src/ui/`, `src/data/`, `src/app.js` (controller). Zero behaviour change: `golden.json` byte-identical. See [ADR-0033](docs/adr/0033-s5-structural-split.md) for the full reasoning and three deliberate deviations from the original plan in `docs/ARCHITECTURE.md`/`docs/ROADMAP.md` (classic scripts instead of ES modules, for test-harness compatibility; two files — the month loop and the DOMContentLoaded handler — stay over 500 lines because each is a single function; `tools/load-model.js` was kept, not deleted).

### Added

- `tests/purity.test.js` — proves `src/model/*.js` loads and runs a full calculation with **zero** DOM stub (not even the minimal one other tests use), enforcing `docs/ARCHITECTURE.md`'s S5 rule 1.
- `tools/app-source.js` — the single source of truth for the app's file list and load order, read by `tools/load-model.js`, `tools/verify-findings.js`, and every test that used to read `app.js` directly. `index.html`'s `<script>` tags must be kept in sync with it by hand.

### Changed

- `eslint.config.js` now targets `src/**/*.js` (was `app.js`), with the app's own top-level bindings (`ModelModule`, `UI`, `ApiModule`, `LDC_COUNTRIES`, `stakeholdersData`, `chartInstances`, `runCalculation`) declared as cross-file globals — exactly what the config's original comment anticipated. The split surfaced 3 new `no-unused-vars` findings, all suppressed with an explanation (2 are declarations only used from another file, invisible to per-file analysis; 1, `stakeholdersData`, was already dead code).
- `index.html` now loads 14 `<script>` tags instead of one.

---

## [0.4.0] — 2026-08-25 — Findings register closed: 37 of 37 resolved

The last item in the findings register (F-27) is fixed, which surfaced one new, unrelated finding (F-37) — fixed in the same change. Nothing remains open in `docs/ANALYSIS.md`. Also fixed the CI matrix, which broke on the previous push.

### Fixed

- **Both solvers (`solveBreakEven`, `solveMaxGrant`) assumed a monotonicity the model does not guarantee.** Binary search converges on a wrong answer, silently, wherever `netAssets` isn't monotone in the swept parameter — measured across several regimes (nearby capital-tight scenarios, high default, grant-heavy/loan-light, and pervasively in the grant-support sweep even at the shipped baseline). Replaced with a grid-then-bisect approach: scan a 13-point grid for the true extremum across the whole range (not the first sign change found scanning one direction — correct regardless of monotonicity or how many feasible pockets exist), then bisect only the one adjacent grid cell. Both solvers now return `{ ok, value, reason }` instead of a bare number, so "no feasible answer exists" is distinguishable from "the answer is zero" — the old `solveMaxGrant` returned `0` for both. Validated to within ~0.1 percentage point against fine-resolution reference sweeps across 10 scenarios. Cost: up to ~47 simulations per recalculation with the solver panel enabled (was 22) — panel is opt-in and off by default, and the existing 500ms input debounce is unchanged. `tests/solver.test.js` added. ([ADR-0032](docs/adr/0032-grid-then-bisect-solvers.md))

- **"Max Sustainable Grant" displayed 100x too small** (found while fixing the above — unpacking the solver's new typed result touched this exact line). It skipped the `*100` conversion the CSV export path already applied: a real 99.9% answer showed on screen as "1.0%". Fixed in the same change. (F-37, [ADR-0032](docs/adr/0032-grid-then-bisect-solvers.md))

- **CI failed on the Node 20.x matrix leg.** `node --test "tests/*.test.js"`'s quoted glob only expands consistently on Node 22.x+; Node 20.x errored with "Could not find". Dropped the explicit glob — `node --test` with no arguments already discovers every `*.test.js` file by default, which is the same 7 files. No behaviour change.

### Added

- `tests/solver.test.js` — pins the typed solver result and the failure-is-not-zero distinction, including two scenarios with genuine non-monotonicity validated against fine-resolution reference sweeps.

---

**Summary:** `npm test` 68 → 75. Findings register 35/36 → 37/37 resolved (one new finding discovered and fixed along the way, same as last session). `golden.json` unchanged — no golden scenario exercises the solvers (`enableBreakEvenSolver: false` by default).

---

## [0.3.0] — 2026-08-21 — Audit closed out: 35 of 36 findings resolved, no open questions

Follow-up to the 2026-08-20 audit. Every remaining finding worth fixing now is fixed; every modelling question the audit raised is decided. One finding remains, deliberately (see below) — nothing is blocked on a decision.

**If you have output from before this date, re-run it.** Several fixes here move real numbers, some substantially — see *Fixed*, below.

### Fixed

- **CSV export was completely broken.** `UI.downloadCSV()` was defined twice; JavaScript ran the second, which threw on every click (it referenced KPI fields removed by an earlier refactor). The first, richer definition — a detailed monthly data table — is now the one that runs, with its own two bugs fixed. `tests/export.test.js` added; nothing tested this before. No model output changed. ([ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md))

- **The solvency reserve now accounts for debt coming due, not just operating costs.** It held back three months of ops cost but ignored investor principal due the next quarter, and used the ops figure *after* a hibernation cut — so the buffer shrank exactly when the fund was most fragile. Fixed: three months of full ops cost, plus the next three months of scheduled investor principal. **Baseline reach fell ~9%** as a direct, predicted result (fewer toilets, but no scenario's viability changed and minimum cash improved throughout). ([ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md))

- **Micro-enterprises are now financed for what they actually cost.** Three places in the model each computed "what does one enterprise cost to establish," and disagreed by 7.3x — the fund's own affordability check used the realistic figure (setup cost + working capital), but the loan it actually booked used setup cost alone. One function, `ModelModule.meCapitalRequirement()`, now used everywhere. **This is the largest single reach reduction in the project's history** (baseline toilets -19.5%, micro-enterprises -68.3%) and it flips one standard scenario (`with cost of capital`) from viable to insolvent — evidence the model was previously overstating viability wherever cost of capital bites. ([ADR-0031](docs/adr/0031-unify-me-capital-requirement.md))

- **`computeKPIs` no longer mutates itself on every render.** It returned a shape the renderer then destructured and overwrote in place — not idempotent, and callers only worked because a render had already run first. It now returns one flat, documented object directly. No model output changed. ([ADR-0028](docs/adr/0028-flatten-computekpis.md))

- **The realised-loss test for write-downs was missing.** Added (`tests/writedown.test.js`), which surfaced a documentation error in the process: the spec claimed realised loss on a written-down loan is "always less than the headline rate," which is only true below about 18 months — corrected with a measured table. No code changed.

### Changed

- **Grant Support % relabelled "Grant-Funded Pacing (% of Production)"**, with a live note showing when the grant fund runs out at the current pace. It was never a volume control — an 18x sweep of the old field moved total grant-funded output under 4% — but the label implied otherwise. UI-only; no model output changed. ([ADR-0029](docs/adr/0029-grant-support-relabel-and-runway.md))
- **The 30% value-of-time factor is now an explicit, documented convention** rather than an indefinitely open question — the model owner confirmed it's acceptable as a working default. The existing "confirm before publishing" caveat is unchanged. ([ADR-0030](docs/adr/0030-accept-30-percent-time-value-factor.md))
- **Toilet service life now gates health and time-saved benefits, not just carbon credit.** A retired toilet no longer averts disease or saves time in the model. No effect at the shipped 5-year default duration. ([ADR-0025](docs/adr/0025-service-life-gates-all-impact.md))
- Four smaller modelling questions resolved by keeping current behaviour, each recorded rather than left implicit: grant support stays a flat share of production, not means-tested ([ADR-0021](docs/adr/0021-grant-support-stays-flat-rate.md)); the grant and loan ledgers stay strictly separate ([ADR-0022](docs/adr/0022-ledgers-stay-separate.md)); one household gets one toilet, no repeat demand ([ADR-0023](docs/adr/0023-no-repeat-or-upgrade-demand.md)); the collections floor stops abruptly at wind-up rather than tapering ([ADR-0024](docs/adr/0024-collections-floor-stays-abrupt.md)).

### Added

- **ESLint** (3 rules: `no-dupe-keys`, `no-undef`, `no-unused-vars`) and **CI** (GitHub Actions, Node 20 & 22, runs on every push/PR). The project's first devDependency — scoped so nothing it depends on ships to the browser. ([ADR-0020](docs/adr/0020-eslint-is-a-devdependency.md))
- **`meExpansionBudgetShare`** and **`meMaxMonthlyGrowthRate`** inputs, replacing two hardcoded growth constants. Defaults unchanged, no behaviour change. ([ADR-0019](docs/adr/0019-expose-me-growth-constants.md))
- Three new test suites/checks: CSV export (`tests/export.test.js`), realised-loss pinning (`tests/writedown.test.js`), and a handful of new ledger invariants (INV-15 through INV-18) covering service-life gating, the debt-service reserve, grant-fund pacing, and ME capital consistency.

### Fixed (documentation)

The project's own status pages had drifted from the code and from each other — stale finding checkmarks, a stale baseline table, descriptions of already-fixed defects presented as current. All of `README.md`, `STATUS.md`, `docs/ANALYSIS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/MODEL_SPEC.md`, `docs/PARAMETERS.md` and `docs/TESTING.md` reconciled against the actual code and test output.

---

**Summary:** `npm test` 53 → 68. Findings register 18/34 → 35/36 resolved (two new findings were discovered and fixed along the way). Every modelling question raised by the original audit is now decided. `golden.json` re-recorded twice, each time preceded by a measured prediction in the relevant ADR — see `docs/adr/0027` and `docs/adr/0031` for the two behaviour-changing fixes' full reasoning and measurements.

---

## [0.2.0] — 2026-08-20 — Initial audit and correction

The model was audited end to end against its own behaviour, a regression suite was built from nothing, and 18 of the 34 findings raised were fixed the same day. **Numbers produced before this date should be re-run**, and rate inputs re-entered rather than copied (see *Changed*, below).

### Fixed

- **The fund never charged itself the cost of its own senior debt.** `fundCostOfCapital` was read by the model but had no control in the form, so it silently defaulted to zero — every result the tool had ever produced omitted investor interest. Control added, defaults to 2% concessional. ([ADR-0004](docs/adr/0004-cost-of-capital-input.md))
- **A failing fund was reported as verified.** The tool printed "Model Integrity Verified" for its own demonstration scenario — a fund insolvent from year four, in default on 18.7% of its senior loan. Integrity (is the arithmetic sound) and viability (does the fund work) are now separate verdicts, both shown on screen. ([ADR-0008](docs/adr/0008-integrity-versus-viability.md))
- **Carbon revenue was understated by roughly 250,000×** — a stacked unit error (kilograms instead of tonnes, a percentage divided twice, credited once instead of annually). ([ADR-0005](docs/adr/0005-carbon-units-and-accrual.md))
- **The simulation billed operating costs against funds that had already collapsed**, for the rest of whatever horizon was requested. Funds now wind up when there's nothing left to do. ([ADR-0006](docs/adr/0006-wind-up-terminal-state.md))
- **The app rewrote the user's inputs while calculating** — Grant Support % silently cut up to five times per click, interest rates overwritten a second after page load. Nothing writes back to an input now; suggestions are offered, not applied. ([ADR-0009](docs/adr/0009-advisory-not-automatic.md))
- **Grace periods forgave investor interest** rather than deferring it, and arrears vanished instead of capitalising into the liability. ([ADR-0007](docs/adr/0007-investor-arrears-and-grace.md))
- **Two incompatible "hours saved" formulas** disagreed by 4.39x; the KPI layer used the wrong one.
- **Population growth was collected and never used**, so the model showed a fund closing a gap that was actually widening.
- **Micro-enterprises were immortal** — a 50% write-down rate left production capacity completely untouched. Business closure is now a separate parameter from loan write-down. ([ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md))
- **The startup scenario was insolvent** — the country-data fetch overwrote the concessional cost of capital with the market commercial lending rate. The fetch now never overwrites a negotiated term. ([ADR-0018](docs/adr/0018-fetch-does-not-set-negotiated-terms.md))
- A 0% interest rate corrupted the ledger with `NaN`, invisibly, because `NaN` comparisons are always false and it passed every check.
- Dev server served arbitrary paths and lied about 404s; hardened.
- Several smaller defects: a dead advisor branch, duplicate object keys, dead wizard code, a doubled currency symbol in exports.

### Changed

- **Rates are entered as percentages** — type `40`, not `0.40`. The form used to teach both conventions at once; any rate above 100% was silently divided by 100. **Rate inputs from before this date must be re-entered, not copied.** ([ADR-0012](docs/adr/0012-percentage-entry-convention.md))
- **SROI redefined as social value only** — DALYs included (previously computed, shown, then silently excluded), ending cash removed (a fund that hoarded capital and built nothing used to score well), hourly value derived from local income rather than an uncited constant. **Not comparable to earlier SROI figures.** ([ADR-0011](docs/adr/0011-sroi-is-social-value-only.md), [ADR-0015](docs/adr/0015-value-of-saved-time.md))
- **The demonstration scenario redesigned to actually work** — repays its investor in full, stays solvent. Chosen by a grid search over five levers, stress-tested against six shocks. ([ADR-0013](docs/adr/0013-viable-default-scenario.md))
- **Solvency advice is model-tested**, not rule-of-thumb — each suggestion is scored by re-running the simulation.
- Chart.js pinned to an exact version with an integrity hash, vendored locally for offline use.
- Country selector now lists all countries in a real `<select>`, not a single-entry datalist.

### Added

- Carbon crediting life, ME annual closure rate, value of saved time, hours saved per person per day, fund cost of capital — all previously hardcoded or missing controls.
- The regression suite itself: input wiring, ledger invariants, characterisation scenarios, an application smoke test, and a startup test — 53 tests, zero dependencies, from nothing.
- The documentation set this changelog is part of: model specification, audit register, roadmap, parameter dictionary, testing guide, architecture note, decision records, and a working contract for AI agents.

---

## [0.1.0] — before 2026-08-20 — Pre-audit baseline

No changelog was kept. The git history contains 15 commits, 8 of them single-error hotfixes found by users in a browser rather than by a test — the pattern the regression suite (added in 0.2.0) exists to end.
