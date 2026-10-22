# Decision records

One ADR per behaviour change or modelling decision — see [0001](0001-record-architecture-decisions.md) for why, and [0000](0000-template.md) for the template. Numbered sequentially, in the order they were written; never edited after acceptance — a reversal gets a new ADR that supersedes the old one, so the record of *why* stays intact.

For the short version of what each one decided, [CHANGELOG.md](../../CHANGELOG.md) is easier to skim. Come here for the reasoning and the alternatives considered behind a specific decision.

| ADR | Decision |
|---|---|
| [0002](0002-keep-the-app-buildless.md) | Keep the app buildless and dependency-free |
| [0003](0003-nominal-cashflows-no-discounting.md) | Nominal cashflows, no NPV/IRR discounting |
| [0004](0004-cost-of-capital-input.md) | Add a fund cost-of-capital input |
| [0005](0005-carbon-units-and-accrual.md) | Fix carbon units and accrual timing |
| [0006](0006-wind-up-terminal-state.md) | Fund winds up instead of running forever |
| [0007](0007-investor-arrears-and-grace.md) | Grace defers principal only; arrears capitalise |
| [0008](0008-integrity-versus-viability.md) | Two verdicts — arithmetic integrity vs. fund viability |
| [0009](0009-advisory-not-automatic.md) | The auto-solver suggests, never writes back |
| [0010](0010-wire-up-collected-inputs.md) | One hours-saved formula; population growth reaches demand |
| [0011](0011-sroi-is-social-value-only.md) | SROI is social value only, cash excluded |
| [0012](0012-percentage-entry-convention.md) | Every rate is entered as a percentage |
| [0013](0013-viable-default-scenario.md) | A viable, grid-searched default scenario |
| [0014](0014-me-attrition-is-separate-from-write-down.md) | ME closure is separate from loan write-down |
| [0015](0015-value-of-saved-time.md) | Value of saved time derived from local income |
| [0016](0016-toilet-service-life.md) | Toilets have a finite carbon-crediting service life |
| [0017](0017-contingency-is-a-cost-mark-up.md) | Contingency is a cost mark-up, not a reserve |
| [0018](0018-fetch-does-not-set-negotiated-terms.md) | The country fetch never overwrites negotiated terms |
| [0019](0019-expose-me-growth-constants.md) | Expose the two hardcoded ME-growth constants |
| [0020](0020-eslint-is-a-devdependency.md) | ESLint as a devDependency (exception to 0002) |
| [0021](0021-grant-support-stays-flat-rate.md) | Grant support stays a flat rate, not means-tested |
| [0022](0022-ledgers-stay-separate.md) | Grant and loan ledgers stay strictly separate |
| [0023](0023-no-repeat-or-upgrade-demand.md) | No repeat or upgrade demand modelled |
| [0024](0024-collections-floor-stays-abrupt.md) | Collections floor stops abruptly, no taper |
| [0025](0025-service-life-gates-all-impact.md) | Service life gates DALYs and time-saved, not just carbon |
| [0026](0026-restore-the-detailed-csv-export.md) | Restore the detailed CSV export; delete the broken duplicate |
| [0027](0027-debt-service-lookahead-reserve.md) | Solvency reserve includes scheduled investor principal |
| [0028](0028-flatten-computekpis.md) | Flatten `computeKPIs`; delete the render-time mutation |
| [0029](0029-grant-support-relabel-and-runway.md) | Relabel grant support; show its actual runway |
| [0030](0030-accept-30-percent-time-value-factor.md) | Accept 30% as the value-of-time factor for now |
| [0031](0031-unify-me-capital-requirement.md) | One micro-enterprise capital requirement, used everywhere |
| [0032](0032-grid-then-bisect-solvers.md) | Grid-then-bisect solvers with a typed result |
| [0033](0033-s5-structural-split.md) | S5 structural split — app.js becomes src/ |
| [0034](0034-observations-only-country-data.md) | Import observations, preserve programme assumptions |
| [0035](0035-zero-writedowns-and-demand-order.md) | Honor zero write-downs and the specified demand recurrence |
| [0036](0036-complete-investor-debt-waterfall.md) | Pay interest arrears and settle available loan cash at wind-up |
| [0037](0037-fail-fast-input-validation.md) | Reject invalid inputs before simulation instead of producing plausible corruption |
| [0038](0038-export-the-calculated-scenario.md) | Export the calculated input snapshot and canonical KPIs |
| [0039](0039-one-model-tested-advice-path.md) | Route the visible advisor through model-tested scenarios only |
| [0040](0040-report-exact-me-launches.md) | Report exact monthly enterprise launches and align the audit table |
| [0041](0041-honor-zero-enterprise-capacity.md) | Honor explicit zero enterprise capacity after validation |
| [0042](0042-chart-annual-grants-as-flows.md) | Chart annual grant spending as flows, not cumulative balances |
| [0043](0043-report-final-partial-year.md) | Retain the final partial year in reporting |
| [0044](0044-report-actual-production-constraints.md) | Rank constraints from actual foregone production and expose secondary causes |
| [0045](0045-require-evidence-bounded-sensitivity.md) | Require sourced or user-supplied bounds for one-at-a-time sensitivity |
| [0046](0046-mark-country-derived-inputs-consistently.md) | Mark every country-derived model input consistently and truthfully |
| [0047](0047-start-with-a-pilot-enterprise-network.md) | Start with an explicit pilot share of the enterprise network |
| [0048](0048-fit-programme-summary-to-viewport.md) | Fit the programme summary to the available viewport |
| [0049](0049-derive-health-and-report-impact-honestly.md) | Derive health impact conservatively and report jobs/carbon honestly |
| [0050](0050-show-api-benchmarks-without-inventing-programme-terms.md) | Show API benchmarks without inventing programme terms |
| [0051](0051-contain-the-monthly-audit-table-vertically.md) | Contain the monthly audit table vertically |
| [0052](0052-put-the-model-flow-and-calibration-path-on-site.md) | Put the model flow and calibration path on site |
| [0053](0053-use-canonical-sustainability-scorecard-metrics.md) | Use canonical sustainability scorecard metrics |
| [0054](0054-distinguish-population-need-from-borrower-demand.md) | Distinguish population need from borrower demand |
| [0055](0055-decouple-the-monthly-audit-card-from-chart-sizing.md) | Decouple the monthly audit card from chart sizing |
| [0056](0056-label-the-gross-social-value-multiple-honestly.md) | Label the gross social value multiple honestly |
