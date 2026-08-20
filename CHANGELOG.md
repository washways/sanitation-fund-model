# Changelog

Every change that alters what the model produces, what a user sees, or how the project is worked on. Newest first.

**Format:** one entry per release or working session. Within an entry, changes are grouped as *Fixed* (a defect), *Changed* (a deliberate behaviour change), *Added*, or *Removed*. Entries link to the decision record (`docs/adr/`) and the finding (`docs/ANALYSIS.md`) where one exists.

**Rules for updating this file:**

1. Add the entry **in the same commit** as the change it describes.
2. If `tests/golden.json` moved, say so and say by how much. A reader needs to know whether their old numbers still stand.
3. Write for someone who was not there. "Fixed carbon" tells nobody anything; "carbon revenue was understated by roughly 250,000x because tonnes were treated as kilograms" does.

---

## 2026-08-20 — Audit and correction

The model was audited end to end, a regression suite was built, and 18 of 33 findings were fixed. **Numbers produced before this date should be re-run**, and rate inputs re-entered rather than copied.

### Fixed

- **The fund never charged itself the cost of its own senior debt.** `fundCostOfCapital` was read by the model but had no control in the form, so it silently defaulted to zero. Every result the tool had ever produced omitted investor interest. ([F-01](docs/ANALYSIS.md), [ADR-0004](docs/adr/0004-cost-of-capital-input.md))
- **A failing fund was reported as verified.** The tool printed `✅ Model Integrity Verified` for its own demonstration scenario — a fund insolvent from year four and in default on 18.7% of its senior loan. Insolvency and default were written to the browser console, where nobody sees them, and the line that would have failed the run was commented out as "optional strictness". Integrity and viability are now separate verdicts, both shown on screen. ([F-29](docs/ANALYSIS.md), [ADR-0008](docs/adr/0008-integrity-versus-viability.md))
- **Carbon revenue was understated by roughly 250,000×.** The input labelled "Tonnes/Yr" was divided by 1,000 as though it were kilograms, the fund's share was divided by 100 a second time having already been converted, and the credit was granted once at construction rather than each year of operation. ([F-02](docs/ANALYSIS.md), [F-33](docs/ANALYSIS.md), [ADR-0005](docs/adr/0005-carbon-units-and-accrual.md))
- **The simulation billed operating costs against funds that had already collapsed.** A fund that died in year four kept paying a collections team for the remaining sixteen years of a twenty-year run. Reported ending cash measured how long the simulation ran, not how the fund performed: −$36,351 over five years and −$1,029,034 over twenty, for the same fund. Funds now wind up. ([F-31](docs/ANALYSIS.md), [ADR-0006](docs/adr/0006-wind-up-terminal-state.md))
- **The app rewrote the user's inputs while calculating.** Recalculating silently cut Grant Support % up to five times per click, and the interest rates you typed were overwritten a second after page load. Nothing writes back to an input now. ([F-04](docs/ANALYSIS.md), [F-05](docs/ANALYSIS.md), [ADR-0009](docs/adr/0009-advisory-not-automatic.md))
- **A 0% interest rate corrupted the entire ledger with `NaN`** — and passed every consistency check on the way, because `NaN` comparisons are always false. ([F-03](docs/ANALYSIS.md))
- **Grace periods forgave investor interest rather than deferring it**, and arrears vanished instead of capitalising into the liability. In a stressed scenario this overstated net assets by more than the original loan. ([F-06](docs/ANALYSIS.md), [ADR-0007](docs/adr/0007-investor-arrears-and-grace.md))
- **Two incompatible "hours saved" formulas** disagreed by a factor of 4.39, and the KPI layer used the one that omitted household size. ([F-07](docs/ANALYSIS.md), [ADR-0010](docs/adr/0010-wire-up-collected-inputs.md))
- **Population growth was collected, auto-filled, and never used**, so the model showed a fund closing a gap that is in reality widening. ([F-09](docs/ANALYSIS.md))
- **Micro-enterprises were immortal.** A 50% annual write-down rate left production capacity completely untouched. ([F-20](docs/ANALYSIS.md), [ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md))
- **The startup scenario was insolvent**, because the country fetch overwrote the concessional cost of capital with Malawi's 37.1% commercial lending rate — modelling a blended-finance vehicle borrowing commercially. ([F-34](docs/ANALYSIS.md), [ADR-0018](docs/adr/0018-fetch-does-not-set-negotiated-terms.md))
- Dev server contained requests to its own directory, bound loopback, and returned real 404s instead of `200 OK`. ([F-18](docs/ANALYSIS.md))
- Dead advisor branch made reachable — the same typo was writing `$undefined` into two CSV exports. ([F-13](docs/ANALYSIS.md))
- Duplicate object keys, dead wizard handlers, and a doubled currency symbol (`$$1,234`). ([F-15](docs/ANALYSIS.md), [F-16](docs/ANALYSIS.md), [F-23](docs/ANALYSIS.md))

### Changed

- **Rates are entered as percentages.** Type `40`, not `0.40`. The form previously taught both conventions at once under two heuristics that contradicted each other, so 100% was ambiguous and any rate above 100% was silently divided by 100 — 150% inflation became 1.5%. **Rate inputs from an older version must be re-entered.** ([F-17](docs/ANALYSIS.md), [ADR-0012](docs/adr/0012-percentage-entry-convention.md))
- **SROI redefined** as social value only: DALY value included (it was computed, displayed, and then silently excluded), ending cash removed (a fund that hoarded capital and built nothing scored well), and the hourly value derived from local income rather than an uncited `$0.50` constant. Financial return is now reported separately as capital preservation. **SROI is not comparable to earlier figures.** ([F-08](docs/ANALYSIS.md), [ADR-0011](docs/adr/0011-sroi-is-social-value-only.md), [ADR-0015](docs/adr/0015-value-of-saved-time.md))
- **The demonstration scenario now works.** It repays its investor in full and stays solvent, reaching about 3.5% of the target population. Chosen by grid search over five levers and stress-tested against six shocks, not hand-picked. ([ADR-0013](docs/adr/0013-viable-default-scenario.md))
- **Solvency advice is model-tested.** Each suggestion is scored by re-running the simulation. "Extend the repayment term" is no longer offered, because measurement shows it makes repayment *worse* in this model. ([F-32](docs/ANALYSIS.md))
- Contingency relabelled "Cost Contingency (% mark-up)" — the implementation was right, the name implied a drawable reserve. ([ADR-0017](docs/adr/0017-contingency-is-a-cost-mark-up.md))
- Chart.js pinned to 4.4.1 with an integrity hash and vendored locally, so charts render offline. ([F-22](docs/ANALYSIS.md))

### Added

- **Carbon crediting life** (`toiletLifespanYears`, default 5 years). Credits stop when a toilet reaches end of service. ([ADR-0016](docs/adr/0016-toilet-service-life.md))
- **ME annual closure rate** — business failure, modelled separately from loan write-down because they are different events. ([ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md))
- **Value of saved time** as a share of the wage, and **hours saved per person per day**, both previously hardcoded.
- **Fund cost of capital** control, defaulting to 2% concessional.
- **Regression suite** — 53 tests, zero dependencies: input wiring, 14 ledger invariants across 16 scenarios, 22 golden scenarios, an end-to-end application smoke test, and a startup test that drives the real country-fetch handler against recorded World Bank data.
- **Documentation set** — model specification, audit with 34 findings, staged roadmap, parameter dictionary, testing guide, architecture note, 18 decision records, and a working contract for AI agents.
- `methodology.html` rewritten from scratch.

### Changed (interface)

- **The country selector lists all 44 countries.** It was an `<input list="countryList">` pre-filled with "Malawi"; browsers filter a datalist against whatever is already in the field, so the dropdown showed a single entry and the tool read as a Malawi-only model. It is now a plain `<select>` showing each country with its ISO code, and changing it prompts you to click Load.

### Removed

- Dead wizard handlers referencing DOM ids deleted long ago.
- The auto-adjusting solvency solver that rewrote the user's assumptions.

---

## Before 2026-08-20

No changelog was kept. The git history contains 15 commits, of which 8 are single-error hotfixes ("Fix TypeError…", "Fix ReferenceError…") — each a defect found by a user in a browser rather than by a test. That pattern is what the regression suite exists to end.
