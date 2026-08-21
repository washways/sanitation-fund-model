# Changelog

Every change that alters what the model produces, what a user sees, or how the project is worked on. Newest first.

**Format:** one entry per release or working session. Within an entry, changes are grouped as *Fixed* (a defect), *Changed* (a deliberate behaviour change), *Added*, or *Removed*. Entries link to the decision record (`docs/adr/`) and the finding (`docs/ANALYSIS.md`) where one exists.

**Rules for updating this file:**

1. Add the entry **in the same commit** as the change it describes.
2. If `tests/golden.json` moved, say so and say by how much. A reader needs to know whether their old numbers still stand.
3. Write for someone who was not there. "Fixed carbon" tells nobody anything; "carbon revenue was understated by roughly 250,000x because tonnes were treated as kilograms" does.

---

## 2026-08-21 (3) — Model owner reviewed the open items; all recommendations implemented

The model owner reviewed the eight open questions from the previous session and said: follow the recommendations. All eight are now resolved — six by decision alone (no code change), two by code change with a measured, ADR-first prediction.

### Fixed

- **F-36 — CSV export was completely broken.** `UI.downloadCSV()` was defined twice; JavaScript silently ran the second, which threw a `TypeError` referencing KPI fields that don't exist since the F-14-era flattening — the Export button crashed on every click. The shadowed first definition (a richer, more detailed monthly table) would also have thrown, from an unrelated bug (`s` used before its declaration). Kept the first, fixed both its bugs plus a shared `inputs.grantFund` typo (should be `investGrant`), deleted the second — its prose-report content duplicated the separate, already-working `copyAnalysisReport()`. [ADR-0026](docs/adr/0026-restore-the-detailed-csv-export.md). `tests/export.test.js` added; nothing tested this function before today. **No model output changed** — this was a UI bug fix.
- **F-10 — the debt-service lookahead the README has always claimed did not exist. Now it does.** The solvency gate held back 3 months of ops cost but ignored investor principal due in the next quarter, and used the *hibernation-reduced* ops figure, so the buffer shrank exactly when the fund was most fragile. Fixed: `requiredReserves = 3 * fullFixedOps + sum(next 3 months of scheduled investor principal)`. `opsReserveCap` (the *different* input that sizes the month-0 starting network) was relabelled "Starting Capacity Throttle (%)" rather than folded into the new reserve — the two are genuinely different jobs. [ADR-0027](docs/adr/0027-debt-service-lookahead-reserve.md). **This is the largest behaviour change since the original audit**: baseline reach fell 133,469 → 121,358 toilets (-9%), 476 golden values moved across 21 scenarios — but no scenario's viability verdict changed, and minimum cash improved or held in every scenario checked (confirmed by re-running the old formula against all 21 scenarios before recording, not by assumption).

### Changed (modelling decisions, recorded as ADRs)

- **Q13 — toilet service life now gates DALYs and time-saved credit, matching carbon.** A retired toilet no longer averts disease or saves time in the model, the same way it already stopped earning carbon credit. [ADR-0025](docs/adr/0025-service-life-gates-all-impact.md). No effect at the shipped 5-year default duration; on the two golden scenarios that actually run past their service life, DALYs/hours/SROI fall ~38-51%.
- **Q3 — Grant Support % stays a flat share of production.** Means-testing against household income was considered and rejected for now: the model has one national income figure per run, not a household-level distribution, so gating on it wouldn't actually mean-test anything. [ADR-0021](docs/adr/0021-grant-support-stays-flat-rate.md).
- **Q6 — the grant and loan ledgers stay strictly separate.** No cross-lending of idle grant capital. [ADR-0022](docs/adr/0022-ledgers-stay-separate.md).
- **Q7 — one household, one toilet, once.** No repeat or upgrade demand modelled. [ADR-0023](docs/adr/0023-no-repeat-or-upgrade-demand.md).
- **Q9 — the collections floor stops abruptly at wind-up, not a taper.** A taper rate would have been an invented number. [ADR-0024](docs/adr/0024-collections-floor-stays-abrupt.md).

None of the five decisions above changed any code or moved any golden value — each closes an open question by keeping current behaviour, with the reasoning now on record instead of implicit.

### Left open

- **Q2** — the 30% factor for valuing saved household time. The *method* is settled; confirming the specific factor needs the model owner's own published cost-benefit guidance, which no agent can supply. This is now the only open modelling question.

`npm test`: 60 → 65 (`tests/export.test.js` added; two new invariants, INV-15 and INV-16). `golden.json` re-recorded once, after ADR-0027 (ADR-0025's move was recorded in the same session as its ADR). `npm run lint`: clean.

---

## 2026-08-21 (2) — Three findings closed, one found

### Fixed

- **F-26.** Added `tests/writedown.test.js` (`T-DEF-1`), pinning realised loss as a share of disbursed principal for household and micro-enterprise write-downs at several loan terms. Writing it surfaced a second, smaller defect:
- **F-35.** `MODEL_SPEC.md` §R-3.4 claimed realised loss is "always less than the headline [write-down] rate." Measured: true below ~18 months (a 5% headline realises 1.50% at 6 months), false above ~24 months (a 5% headline realises 8.02% at 36 months — *more* than the headline, because cumulative multi-year exposure overtakes the amortisation effect). No code changed; the spec's prose was corrected to state the actual relationship, with a table.

### Added

- **`meExpansionBudgetShare`** and **`meMaxMonthlyGrowthRate`** (both default 10%) — F-21, half fixed. Replace two hardcoded `0.1` constants governing how fast the fund recruits new micro-enterprises. Defaults unchanged, so no golden scenario moved (confirmed by `golden:diff`). [ADR-0019](docs/adr/0019-expose-me-growth-constants.md). The other half of F-21 — three ME-capital-requirement formulas that disagree with each other (R-6.1) — is unchanged and still open; unifying them **would** move ME lending and needs its own ADR.
- **ESLint** (`eslint.config.js`, three rules only: `no-dupe-keys`, `no-undef`, `no-unused-vars` — F-19) and **CI** (`.github/workflows/ci.yml`, GitHub Actions, Node 20 and 22, running tests + lint + golden diff on every push and PR). [ADR-0020](docs/adr/0020-eslint-is-a-devdependency.md) documents this as the project's first devDependency, narrowly scoped to tooling that never ships to the browser.

### Found, not fixed — **F-36, Critical**

**The CSV export button is completely broken.** ESLint's very first run over `app.js` caught a duplicate `downloadCSV()` definition in the `UI` object (JavaScript silently keeps the second). Tracing both:

- The copy that runs throws a `TypeError` — it references `kpis.impact.sroi`, `kpis.impact.toilets` and `kpis.impact.peopleReached`, none of which exist in the KPI shape `UI.updateKPIs` produces since the F-14-era flattening.
- The copy that's shadowed would **also** throw if un-shadowed — `s` is used before its `const s = ...` declaration (a temporal-dead-zone `ReferenceError`).
- Both reference `inputs.grantFund`, which does not exist (`getInputs()` produces `investGrant`) — this one doesn't throw, it would silently print `GrantFund,$undefined`, the same class of defect as the already-fixed F-13.

Not fixed here: the two copies produce genuinely different report formats (one a detailed monthly data table, one a prose summary followed by a different, shorter table), and choosing between them — or merging them — is a product decision, not a mechanical cleanup. See [docs/ANALYSIS.md#f-36](docs/ANALYSIS.md#f-36--csv-export-is-completely-broken-both-copies).

**No golden scenario moved.** `npm test`: 53 → 60. `npm run lint`: introduced, 0 errors (16 pre-existing violations recorded and suppressed at file level, per `docs/ROADMAP.md`'s own instruction not to fix findings while adding a linter).

---

## 2026-08-21 — Documentation reconciliation

**No model behaviour changed.** `npm test` (53/53), `golden:diff` (clean) and `verify-findings.js` (18/0) confirmed green throughout.

Several fixes landed on 2026-08-20 never got their bookkeeping updated, so the project's own status pages disagreed with the code and with each other:

- `docs/ANALYSIS.md`'s findings register was missing its ✅ for F-08, F-17, F-24 and F-28, all genuinely fixed on 2026-08-20. Register is now 27 of 34 resolved.
- `tools/verify-findings.js`'s "deliberately outstanding" footer still listed F-08, F-20, F-24 and F-25 as open.
- `STATUS.md`'s "Baseline today" table predated [ADR-0014](docs/adr/0014-me-attrition-is-separate-from-write-down.md) (ME closure rate) landing, so it quoted toilet/cash/net-asset figures the model no longer produces on the shipped defaults. Re-measured and corrected (133,469 toilets, not 139,148).
- `docs/ROADMAP.md`'s stage-map table and `docs/ARCHITECTURE.md`'s "current shape" diagrams still described defects (F-01, F-04, F-05, F-11, F-17, F-18, F-22, F-29) as live, and `app.js`'s line count and module boundaries as they were at audit time (3,667 lines) rather than today's (4,028).
- `README.md`'s status section, test-suite description (four suites, not five) and finding count were stale in the same way.

All corrected. See `STATUS.md`'s log for the full list.

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
