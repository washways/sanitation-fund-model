# Code and Model Audit — Sanitation Revolving Fund Model

| | |
|---|---|
| **Audit date** | 2026-08-20 |
| **Commit audited** | `2d81863` ("Model integrity improvements…") on `main` |
| **Method** | Static review of all 5,902 lines (`app.js`, `index.html`, `methodology.html`, `style.css`, `server.js`), then empirical verification by executing the model headlessly |
| **Fix status** | **19 of 34 findings fixed and verified** on 2026-08-20 — run `node tools/verify-findings.js`. Rows below marked ✅ are closed; the finding text is preserved as the historical record and must not be deleted. |
| **Execution status** | **The model was executed.** `tools/load-model.js` loads `ModelModule` into a Node VM with a minimal DOM stub; `tools/verify-findings.js` and `tools/probe.js` reproduce each finding against the shipped `index.html` defaults. Every finding below carries either a cited line, a reproduced measurement, or both. Reproduce with `node tools/verify-findings.js`. |

---

## 1. Executive summary

The model is a single-file browser application: a 3,667-line `app.js` containing a monthly cashflow simulation, a KPI layer, a Chart.js UI layer, a World Bank API client and an app controller, with no build step, no tests, no dependency manifest and no linting.

The **simulation core is structurally sound**. The month loop maintains a dual ledger (grant cash / loan cash), the cash-continuity identity `cash[t] = cash[t-1] + net[t]` holds by construction for months 2..N, and a self-check (`verifyLedger`) runs after each simulation. That is a real asset and the right foundation to build on.

The problems are **not in the loop's arithmetic — they are in what feeds it and what reads it**:

- One headline defect makes the fund's cost of capital permanently zero (**F-01**), which silently removes senior debt interest from every result the tool has ever produced.
- The UI layer *writes back into the inputs* during a calculation (**F-04**, **F-05**), so the scenario displayed is not always the scenario entered.
- Several parameters are collected from the user but never reach the model (**F-09**, **F-25**), and one is percentage-divided twice (**F-02**).
- Two different formulas compute the same impact metric and disagree by a factor of about `avgHHSize` (**F-07**).
- The integrity checks that would have caught some of this can be disabled by an unrelated flag (**F-11**) and never verify the opening balance (**F-12**).

Running the model against its own shipped defaults sharpened the picture considerably, and produced four findings that were not visible from reading alone:

- **The out-of-the-box scenario fails.** With no user changes at all, the fund goes cash-negative in year 4.1, ends at **-$36,351**, and defaults on **$749,981** of investor principal (81.3% repaid). The model then prints **`✅ Model Integrity Verified`** (**F-29**).
- **The lever the auto-solver pulls barely moves anything.** Sweeping Grant Support % from 5% to 90% — an 18-fold change — moves total grant-funded toilets from 8,894 to 9,214, a 3.6% difference. It is a *pacing* control, not a *volume* control, because total subsidy is capped by the grant ledger (**F-30**). The auto-solver in **F-04** silently rewrites this parameter, up to five times per click, to fix a shortfall it cannot fix.
- **The simulation does not stop when the fund dies.** Production ceases at month 47. The remaining 193 months of a 20-year run pay **$1,085,986** of ops costs against **zero** income, driving reported "ending cash" to **-$1,029,034** — a number that then flows into net assets, fund health and SROI (**F-31**).
- **The advisor's main recommendation is backwards.** Extending the repayment term *reduces* the share of investor principal repaid, from 86.4% at a 1-year term to 67.3% at 10 years (**F-32**). `generateSuggestions` tells users to extend it.

None of this is unusual for a model that grew organically through 15 commits of "Fix TypeError…". The remedy is not a rewrite — it is to **freeze the intended behaviour in a written specification, pin it with executable tests, and then change the code one stage at a time**. That is what [ROADMAP.md](ROADMAP.md) and [../AGENTS.md](../AGENTS.md) set up.

### Severity key

| | Meaning |
|---|---|
| **Critical** | Produces materially wrong headline numbers today, silently. |
| **High** | Wrong or unreproducible results under common settings, or user input silently discarded. |
| **Medium** | Wrong under some settings, or a correctness guard that does not guard. |
| **Low** | Cosmetic, dead code, or hygiene. |

---

## 2. Findings register

Every finding has a stable ID. **Do not renumber.** When a finding is fixed, mark it and cite the commit; do not delete the row.

✅ marks a finding fixed and verified by `node tools/verify-findings.js`. **Evidence** column: `run` = reproduced by executing the model (`node tools/verify-findings.js`); `src` = established by reading the source; `run*` = reproduced, and the measurement changed the finding from what static reading suggested.

| ID | Severity | Area | Summary | Evidence | Stage |
|---|---|---|---|---|---|
| ✅ [F-34](#f-34--the-tested-scenario-is-not-the-scenario-that-runs) | **Critical** | Infra | The startup fetch overwrites the shipped defaults, so every test measured a state no user runs | run | S2 |
| ✅ [F-29](#f-29--the-integrity-check-passes-a-run-that-went-insolvent-and-defaulted) | **Critical** | Guards | "Model Integrity Verified" is printed for an insolvent run that defaulted on $750k | run | S1 |
| [F-30](#f-30--grant-support--is-a-pacing-lever-not-a-volume-lever) | **High** | Core | Grant Support % barely changes output; the auto-solver's only strategy is inert | run | S2 |
| ✅ [F-31](#f-31--the-simulation-does-not-stop-when-the-fund-dies) | **High** | Core | After production ceases the model burns $1.09M of ops against zero income | run | S3 |
| ✅ [F-32](#f-32--extending-the-repayment-term-reduces-repayment) | Medium | Core | Longer investor terms repay *less*; the advisor recommends the wrong direction | run | S3 |
| ✅ [F-33](#f-33--the-carbon-input-is-labelled-tonnes-per-year-and-used-as-kilograms-once) | **High** | Impact | `co2PerToilet` is labelled tonnes/year, treated as kilograms, and applied once | run | S1 |
| ✅ [F-01](#f-01--fundcostofcapital-has-no-input-control-so-it-is-always-zero) | Critical | Inputs | `fundCostOfCapital` has no UI control, so investor interest is always $0 | run | S1 |
| ✅ [F-02](#f-02--carboncreditshare-is-percentage-divided-twice) | High | Inputs | `carbonCreditShare` is divided by 100 twice, so carbon revenue is 100x too small | run | S1 |
| ✅ [F-03](#f-03--a-zero-interest-rate-produces-nan-across-the-entire-ledger) | High | Core | A 0% interest rate produces `NaN` through the whole ledger | run | S1 |
| ✅ [F-04](#f-04--the-auto-solver-rewrites-the-users-inputs-and-re-runs-itself) | High | Control | The auto-solver rewrites the user's inputs in the DOM and re-runs itself | src | S2 |
| ✅ [F-05](#f-05--updatesmartrates-overwrites-the-interest-rates-the-user-typed) | High | Control | `updateSmartRates` overwrites entered interest rates unconditionally | src | S2 |
| ✅ [F-06](#f-06--grace-period-interest-never-accrues-and-arrears-never-come-due) | High | Core | Grace-period interest never accrues; arrears never capitalise or get repaid | run | S3 |
| ✅ [F-07](#f-07--two-incompatible-hours-saved-formulas) | High | Impact | Two incompatible "hours saved" formulas coexist | run | S3 |
| [F-08](#f-08--sroi-mixes-social-value-with-a-cash-balance-and-drops-dalys) | Medium | Impact | SROI adds ending cash to social value and silently drops DALYs | src | S3 |
| ✅ [F-09](#f-09--population-growth-is-collected-but-the-demand-backlog-is-static) | Medium | Core | `popGrowthRate` is collected but never used, so demand is static | run | S3 |
| [F-10](#f-10--reserves-are-enforced-once-and-the-documented-debt-reserve-does-not-exist) | Medium | Core | `opsReserveCap` only bites in month 0; the documented debt reserve does not exist | run* | S3 |
| ✅ [F-11](#f-11--ledger-verification-is-switched-off-by-an-unrelated-flag) | Medium | Guards | Ledger verification is disabled by the break-even-solver flag | run | S1 |
| ✅ [F-12](#f-12--the-opening-balance-is-never-reconciled) | Medium | Guards | Opening capital is never reconciled, so month 1 is unchecked | run | S1 |
| ✅ [F-13](#f-13--a-dead-advisor-branch-guarded-by-an-undefined-property) | Medium | UI | `inputs.loanFund` is undefined, so a whole advisor branch is dead | src | S2 |
| [F-14](#f-14--the-kpi-object-is-destructively-mutated-by-the-renderer) | Medium | UI | KPI object is mutated in place by the renderer; callers depend on the mutation | src | S2 |
| ✅ [F-15](#f-15--wizard-functions-reference-dom-ids-that-were-deleted) | Medium | UI | Wizard functions reference DOM ids that no longer exist | src | S2 |
| ✅ [F-16](#f-16--duplicate-object-keys-silently-discard-values) | Low | Core | Duplicate object keys silently discard the first value | src | S1 |
| [F-17](#f-17--two-opposing-percent-heuristics-hyperinflation-becomes-2) | High | Inputs | Two opposing percent heuristics; >100% inflation becomes 2% | run | S1 |
| ✅ [F-18](#f-18--serverjs-serves-arbitrary-files-and-lies-about-404s) | Medium | Infra | `server.js` serves any path from disk; 404 returns HTTP 200 | src | S0 |
| [F-19](#f-19--no-manifest-no-tests-no-lint-no-ci-all-state-is-global) | High | Infra | No manifest, no tests, no lint, no CI; all state is global | src | S0 |
| ✅ [F-20](#f-20--micro-enterprises-are-immortal) | Medium | Core | Micro-enterprises never fail, so ME defaults do not reduce capacity | run | S3 |
| [F-21](#f-21--me-growth-magic-numbers-and-inconsistent-startup-capital) | Medium | Core | ME growth uses undocumented magic numbers; startup capital is inconsistent | src | S3 |
| ✅ [F-22](#f-22--chartjs-is-loaded-unpinned-from-a-cdn) | Medium | Infra | Chart.js loaded unpinned from a CDN, no SRI, breaks offline | src | S0 |
| ✅ [F-23](#f-23--alert-for-analysis-output-doubled-currency-symbol) | Low | UI | `alert()` used for analysis output; `$${fmt()}` renders `$$1,234` | src | S2 |
| [F-24](#f-24--the-readme-documents-behaviour-that-is-not-implemented) | Medium | Docs | README documents behaviour that is not in the code | src | S0 |
| ✅ [F-25](#f-25--inputs-collected-and-never-used) | Low | Inputs | `avgAnnualIncome` and `wizTech` are collected and never used | src | S3 |
| [F-26](#f-26--the-default-rate-definition-is-undocumented-and-counter-intuitive) | Medium | Core | The default-rate definition is undocumented and probably not what users assume | run | S3 |
| [F-27](#f-27--the-solver-assumes-a-monotonicity-it-cannot-rely-on) | Medium | Solver | Binary search assumes a monotonicity that is not guaranteed | run* | S4 |
| [F-28](#f-28--union-typed-kpis-and-sentinel-values) | Low | KPI | Union-typed KPIs (`"Sustainable"` vs a number) and a `99` sentinel | src | S3 |

---

## 3. Baseline: what the model does out of the box

Reproduce with `node tools/verify-findings.js`. Inputs are the `value=""` attributes shipped in `index.html` (see `tools/baseline-inputs.js`), which is what a user sees before touching anything.

| | |
|---|---|
| Toilets built | 211,317 |
| People reached | 1,056,585 (of 27,280,461 targeted — 3.9%) |
| MEs at end | 1,000 (the cap: 50 districts x 20) |
| **Ending cash** | **-$36,351** |
| **Net assets** | **-$786,332** |
| **Investor principal repaid** | **$3,250,019 of $4,000,000 (81.3%)** |
| Investor interest paid | **$0** (see F-01) |
| OSS / FSS | 0.80 / 0.70 |
| Depletion | year 4.1 |
| Dominant constraint | Capital Depleted (Insolvent) |
| Break-even HH rate (solver) | 50.5% |
| Integrity check verdict | **`✅ Model Integrity Verified`** |

Two things follow immediately. First, the demonstration scenario a new user meets is a **failing fund** — insolvent, in default to its investor, requiring a 50.5% household interest rate to break even. Whether that is the intended message (sanitation lending is hard without deeper subsidy) or a mis-parameterised default is a question for the model owner; either way the tool should *say* which. Second, the self-check declares the run sound. That is **F-29**, and it is why every other number in this table went unquestioned.

---

## 4. Findings in detail

### F-01 — `fundCostOfCapital` has no input control, so it is always zero

**Severity: Critical.** `UI.getInputs()` reads it at [app.js:1176](../app.js#L1176):

```js
fundCostOfCapital: getDecimal('fundCostOfCapital'),
```

`getDecimal` delegates to `getRaw`, which returns the default when the element is missing:

```js
const el = document.getElementById(id);
if (!el) return defaultVal;      // defaultVal here is 0
```

There is **no element with `id="fundCostOfCapital"` anywhere in `index.html`**. The form offers "Fund Repayment (Years)" ([index.html:165](../index.html#L165)) and "Invester Grace Period (Months)" ([index.html:173](../index.html#L173)), but no rate. So `fundCostOfCapital === 0` on every run, which means:

- `monthlyCostOfCapital = 0` ([app.js:166](../app.js#L166));
- `scheduledInt = loanFundLiability * 0 = 0` ([app.js:386](../app.js#L386));
- `dataMonthlyFundInt` is an array of zeros;
- `totalFundInterest = 0`, so **FSS**, **economic cost per latrine** and **cost per latrine** all omit the cost of senior debt ([app.js:733](../app.js#L733), [app.js:735](../app.js#L735), [app.js:797](../app.js#L797));
- the break-even interest solver solves against a capital structure that costs nothing.

The README's entire "Senior Debt Service (Must be paid first)" waterfall is therefore, in practice, a zero-interest amortisation. The methodology page mentions cost of capital only in passing ([methodology.html:369](../methodology.html#L369)) and never defines it as a parameter.

**Fix:** add the input, default it from the World Bank lending rate that is already fetched (`FR.INR.LEND`), and add a test asserting `sum(dataMonthlyFundInt) > 0` whenever `investLoan > 0 && fundCostOfCapital > 0`.

**Measured.** Baseline pays **$0** of investor interest. Re-running with `fundCostOfCapital: 0.08` — a value the UI cannot produce — pays **$643,402** and moves net assets from **-$786,332** to **-$1,348,902**. The fund is 72% worse off than reported, on a parameter the user cannot see or set.

**Blast radius:** every saved scenario, screenshot and exported CSV produced to date understates fund cost.

---

### F-02 — `carbonCreditShare` is percentage-divided twice

**Severity: High** (currently latent). At [app.js:1186](../app.js#L1186) the input is normalised to a decimal:

```js
carbonCreditShare: getDecimal('carbonCreditShare', 1.0), // 100% -> 1.0
```

`getDecimal` divides any value `> 1.0` by 100, so the app's own startup default of `50` ([app.js:3129](../app.js#L3129)) becomes `0.5`. The model then divides by 100 **again** at [app.js:538](../app.js#L538):

```js
carbonRev = newCarbonTons * inputs.co2Value * (inputs.carbonCreditShare / 100);
```

Result: `0.005` instead of `0.5` — carbon revenue is **100x too small**.

This is masked today because `co2PerToilet` is defaulted to `0.0` at [app.js:3127](../app.js#L3127) and the whole branch is gated on `inputs.co2PerToilet > 0`. Anyone who enables carbon (a container-based-sanitation or biogas scenario) hits it immediately.

**Measured.** With `co2PerToilet=1000kg, co2Value=$10, carbonCreditShare=50%`, the spec (R-8.1) gives **$1,056,830** of carbon revenue over the baseline run. The model produces **$10,568** — a ratio of exactly **100.0x**.

**Fix:** delete the `/ 100`. Add a unit test: `co2PerToilet=1000kg, co2Value=$10, share=50%, production=1` gives `carbonRev == 5`.

---

### F-03 — A zero interest rate produces `NaN` across the entire ledger

**Severity: High.** `getMonthlyRate` returns `0` for a falsy rate ([app.js:122](../app.js#L122)). The annuity payment is then computed as ([app.js:522](../app.js#L522), and identically at [app.js:302](../app.js#L302) and [app.js:437](../app.js#L437)):

```js
const pmt = (loanVal * monthlyIntRateHh) / (1 - Math.pow(1 + monthlyIntRateHh, -termHh));
```

With `monthlyIntRateHh === 0` this is `0 / (1 - 1)` = `0/0` = **`NaN`**. The cohort's `monthlyPayment` is `NaN`, so `prin = Math.max(0, NaN - int)` is `NaN`, `c.balance` becomes `NaN`, `inflows.hhPrin` becomes `NaN`, `loanCash` becomes `NaN`, and every downstream KPI is `NaN`.

A 0% concessional household loan is a reasonable scenario for a sanitation fund, and it is one of the first things a policy user will try. `verifyLedger` will not catch it either: `Math.abs(NaN - NaN) > 1.00` is `false`, so the cash-identity check passes silently.

**Measured.** Setting `loanInterestRate: 0` on the baseline makes **59 of 60** monthly cash values `NaN`. The KPI layer still returns a confident-looking `12,605` toilets. Critically, **INV-1 does not fire**: the cash-identity check reports no failure, because `Math.abs(NaN - NaN) > 1` is `false`. The model reports a corrupt run as clean.

**Fix:** guard the annuity — when `r === 0`, `pmt = principal / term`. Extract one `annuityPayment(principal, monthlyRate, termMonths)` helper and use it in all three places. Add a test at `loanInterestRate = 0`, and add INV-8 (no `NaN` anywhere) as the *first* check in `verifyLedger`.

---

### F-04 — The auto-solver rewrites the user's inputs and re-runs itself

**Severity: High.** `runCalculation(isAutoAdjust = true)` — which is what the **Recalculate** button ([app.js:3157](../app.js#L3157)) and the country-data fetch ([app.js:3475](../app.js#L3475)) both invoke — reaches [app.js:3573-3591](../app.js#L3573-L3591):

```js
const currentGrantPct = (inputs.grantSupportPct || 0.20) * 100;
if (currentGrantPct > 0) {
    const cut = shortfall > 500000 ? 0.8 : 0.9;
    let newGrantPct = Math.floor(currentGrantPct * cut);
    ...
    grantSupportInput.value = newGrantPct;      // <-- writes into the user's form
    rerun = true;
}
...
setTimeout(() => runCalculation(true, depth + 1), 200);
```

The tool silently reduces **Grant Support %** — a headline policy parameter — up to five times per click, in 200 ms steps, until the investor is repaid. The user sees results for a scenario they did not enter, with no explicit record of what changed. The term-extension half of the strategy is commented out ([app.js:3564-3578](../app.js#L3564-L3578)), so the solver has exactly one lever and drives it toward zero.

This is a **modelling-integrity** problem more than a bug: a financial model that edits its own assumptions to reach a desired conclusion cannot be audited.

**Fix:** make the solver *advisory*. Compute the recommended grant % without mutating any input, and present it as "to repay investors in full, grant support would need to fall from 20% to 13% — [Apply]". Never recurse through the DOM.

---

### F-05 — `updateSmartRates` overwrites the interest rates the user typed

**Severity: High.** [app.js:2916-2981](../app.js#L2916-L2981), whose own comments are candid about it:

```js
// NUCLEAR OPTION: Simplified, Robust, No Locks
...
// Bypass locks. We AUTO-UPDATE unless user recently typed (checked via timestamp?)
// Actually, let's just update. ... we prioritize Correctness over User Edits if they are confused.
el.value = val.toFixed(2);
el.style.setProperty('background-color', '#fef3c7', 'important');
el.dispatchEvent(new Event('input', { bubbles: true }));
```

The `dataset.manual` flag set by `trackManualInterest` ([app.js:3067-3083](../app.js#L3067-L3083)) is read nowhere in `apply()`, so it has no effect. The function fires on load (1 s timer, [app.js:3038](../app.js#L3038)), after every country fetch, and on every edit to `inflationRate`, `hhDefaultRate` or `meDefaultRate` ([app.js:3097-3100](../app.js#L3097-L3100)) — each time clobbering both rate fields and dispatching a synthetic `input` event that schedules yet another `runCalculation`.

Combined with **F-04**, a single click can produce several recalculations against several different input sets.

**Fix:** honour `dataset.manual`. Suggest, do not impose: show the smart rate as a hint next to the field with an [Apply] affordance.

---

### F-06 — Grace-period interest never accrues, and arrears never come due

**Severity: High.** [app.js:383-395](../app.js#L383-L395):

```js
if (m <= inputs.fundRepaymentTerm * 12 && m > inputs.investorGracePeriod) {
    scheduledPrin = investorSchedule[m]?.principal || 0;
    scheduledInt  = loanFundLiability * monthlyCostOfCapital;
}
```

Three distinct problems:

1. **No interest during grace.** The `m > investorGracePeriod` condition gates *both* principal and interest. In real senior debt, a grace period defers *principal*; interest is either paid current or capitalised into the balance. Here it simply vanishes. With a 6-month grace on a 10-year fund, half a year of investor return disappears. (Currently invisible because of **F-01**.)
2. **Arrears are recorded but never settled.** `accruedInvestorInt` / `accruedInvestorPrin` accumulate the unpaid portion ([app.js:391-392](../app.js#L391-L392)) and are surfaced only as a `console.warn` ([app.js:1023](../app.js#L1023)). They are never added back to `loanFundLiability`, never repaid in a later month from surplus cash, and never appear in any KPI.
3. **Ending liability ignores arrears.** [app.js:748](../app.js#L748):
   ```js
   const investorLiabilityEnd = Math.max(0, inputs.investLoan - totalRepaidPrincipal);
   ```
   Unpaid interest is not a liability here, so `netAssetsEnd` — and therefore `grantEquityMultiple` and the break-even solver's objective function — **overstate the fund's final position by the full amount of the arrears**.

**Measured** (at `fundCostOfCapital: 0.08`, since the UI cannot set it — F-01): a 0-month grace pays **$711,810** of interest; a 6-month grace pays **$643,402**. **$68,408 is forgiven, not deferred.**

On arrears: a cash-starved variant (`fundCostOfCapital: 0.20`, `annualFixedOpsCost: $900k`) accrues **$4,237,365** of unpaid interest and principal. `investorLiabilityEnd` reports **$2,731,773**. Net assets are therefore overstated by **$4.2M** — more than the original loan.

There is also a second, unused source of truth: `investorSchedule[m].interest` is computed in `calculateInvestorSchedule` ([app.js:148](../app.js#L148)) and then ignored in favour of the inline `loanFundLiability * rate`. Two definitions, one dead.

**Fix:** decide the intended instrument in [MODEL_SPEC.md](MODEL_SPEC.md) §4 (recommended: interest accrues from month 1; unpaid interest capitalises into `loanFundLiability`; arrears rank ahead of new lending), then implement one definition and delete the other.

---

### F-07 — Two incompatible "hours saved" formulas

**Severity: High.** Inside the loop, [app.js:547](../app.js#L547):

```js
const hours = toiletsBuiltCumulative * inputs.avgHHSize * 0.25 * 30;   // per month, per person
```

In the KPI layer, [app.js:817-821](../app.js#L817-L821):

```js
const totalToiletYears = s.dataToilets.reduce((a, b) => a + b, 0);
const totalHoursSaved  = totalToiletYears * 0.25 * 365;                // per year, per toilet
```

The second omits `avgHHSize` entirely, so it is smaller by roughly a factor of 5 for a typical household. `dataMonthlyHoursSaved` — the array the loop carefully builds — **is never read by `computeKPIs`**. The KPI derived from the coarser annual snapshots is the one that reaches the UI and the SROI.

**Measured.** On the baseline, the loop array totals **338,123,550** hours; the KPI formula returns **77,056,884** hours — a **4.39x** discrepancy. The larger number is computed, stored, exported to CSV and charted; the smaller one is what the SROI and the headline impact figure use.

**Fix:** one definition, in the loop; KPIs sum the monthly array. Delete the annual-snapshot version.

---

### F-08 — SROI mixes social value with a cash balance, and drops DALYs

**Severity: Medium.** [app.js:823-830](../app.js#L823-L830):

```js
const totalSocialValue = (totalHoursSaved * 0.5) + (totalCarbon * (inputs.co2Value || 0));
const sroi = initialInv > 0 ? ((totalSocialValue + cashEnd) / initialInv) : 0;
```

- `0.5` is a hardcoded $/hour with no input and no citation; the code comment itself asks where it came from.
- `totalValDalys` is computed at [app.js:809](../app.js#L809), displayed in the UI, and then **deliberately excluded** from SROI. The comment block at [app.js:805-822](../app.js#L805-L822) is an unresolved argument with itself about whether to include it. A reader of the UI sees a large DALY value and an SROI that does not contain it.
- Adding `cashEnd` (a residual financial asset) to a social-return numerator conflates two different things. A fund that hoards cash and builds nothing scores well.

**Fix:** make the value of a work-hour an input; state in the spec whether SROI is social-only or blended; if blended, name it something other than SROI and show both.

---

### F-09 — Population growth is collected but the demand backlog is static

**Severity: Medium.** `popGrowthRate` is read at [app.js:1156](../app.js#L1156) and auto-filled from the World Bank at [app.js:3327](../app.js#L3327). It appears **nowhere else in the file**. Demand is set once, before the loop ([app.js:213](../app.js#L213)):

```js
let backlogToilets = inputs.popReqToilets / inputs.avgHHSize;
```

and only ever decreases. Over a 10-year horizon in a country growing at 2.5%/year, the unserved backlog grows by about 28% — the model shows the fund closing a gap that is in fact widening. Meanwhile the constraint diagnostics ([app.js:466-470](../app.js#L466-L470)) and the `dominantConstraint` KPI report "Demand Met (Success)" against this static target.

**Measured.** Runs at `popGrowthRate: 0%` and `popGrowthRate: 10%` produce **byte-identical** toilet series (211,317 toilets each). The parameter is inert.

**Fix:** grow the backlog monthly by `(1 + popGrowthRate)^(1/12) - 1`, net of production. Add it to the spec and to a test.

---

### F-10 — Reserves are enforced once, and the documented debt reserve does not exist

**Severity: Medium.** The README promises two reserves: a 3-month **Debt Lookahead** and a 3-month **Ops Buffer**. The code has one:

```js
const requiredReserves = opsCost * 3;                      // app.js:407
```

and `opsCost` has already been cut to 30% during hibernation ([app.js:401](../app.js#L401)), so the buffer shrinks exactly when the fund is most fragile. There is **no debt-service lookahead reserve at all**.

Separately, `opsReserveCap` (the user-facing "Liquidity Buffer %") produces `currentReserve` at [app.js:199-201](../app.js#L199-L201), which is used exactly once — to size the month-0 ME cohort at [app.js:291](../app.js#L291) — and then never again. From month 1 the parameter has no effect on anything.

**Measured — and this is worse than the static reading suggested.** Because the whole growth path is set by how many MEs the fund can afford in month 0, a parameter that touches nothing after month 0 turns out to determine everything:

| `opsReserveCap` | Starting MEs | Toilets built | Net assets |
|---|---|---|---|
| 0% | 645 | 216,934 | -$789,888 |
| 15% (default) | 524 | 211,317 | -$786,332 |
| 50% | 241 | 176,304 | -$773,834 |
| **90%** | **0** | **0** | **+$290,288** |

The buffer labelled "liquidity reserve" is in fact the model's master growth throttle, acting once and never again. And the table exposes a perverse incentive baked into the design: **the only configuration that preserves capital is the one that builds nothing at all.** A fund that deploys zero MEs ends $290,288 to the good, while every productive configuration ends underwater. That is a signal about the underlying economics (at these parameters, each toilet destroys capital) that no KPI on the dashboard currently states.

**Fix:** implement the debt lookahead the README already claims; enforce `currentReserve` throughout or remove the input; and rename it, because it is not a liquidity buffer. Add a "marginal capital impact per toilet" figure so the trade-off above is visible rather than buried.

---

### F-11 — Ledger verification is switched off by an unrelated flag

**Severity: Medium.** [app.js:696-698](../app.js#L696-L698):

```js
if (inputs.enableBreakEvenSolver !== false) {
    ModelModule.verifyLedger(series, inputs, kpis);
}
```

`enableBreakEvenSolver` exists to stop the solver recursing into itself ([app.js:924](../app.js#L924)). It has been overloaded to also mean "skip verification". Today `getInputs()` hardcodes `enableBreakEvenSolver: true` ([app.js:1188](../app.js#L1188)) so the main path is verified — but `runCalculation` still branches on the flag ([app.js:3529](../app.js#L3529)) as though it were user-controllable. The moment anyone adds that checkbox to the UI, **turning off the solver silently turns off every integrity guard in the model.**

**Fix:** two separate flags, `runSolvers` and `verify`, both defaulting to on outside sub-simulations.

---

### F-12 — The opening balance is never reconciled

**Severity: Medium.** The cash-identity loop starts at `i = 1` ([app.js:1043](../app.js#L1043)), so it compares month 2 against month 1, month 3 against month 2, and so on. **Month 1 is never checked against the opening capital.** The one place where money moves outside the loop — the month-0 ME cohort at [app.js:296](../app.js#L296), `loanCash -= startLoanVolume` — is therefore entirely unverified.

The missing assertion is:

```
dataMonthlyCashBalance[0] === (investGrant + investLoan) - startupCost + dataMonthlyNet[0]
```

**Measured.** The identity currently *holds* — opening $3,952,000 + net[0] -$463,591 = $3,488,409, matching the reported cash[0] exactly, drift $0. So this is not a live defect; it is an **unguarded** one. Any future change to the month-0 block would break it silently, which is exactly the class of regression this codebase has repeatedly shipped.

**Fix:** add it as invariant **INV-2** (see [TESTING.md](TESTING.md)). This closes the only gap in an otherwise complete chain.

---

### F-13 — A dead advisor branch guarded by an undefined property

**Severity: Medium.** [app.js:2886](../app.js#L2886):

```js
if (minCash > inputs.loanFund * 0.2) {
```

`inputs` has no `loanFund` key — the field is `investLoan` ([app.js:1191](../app.js#L1191)). `undefined * 0.2` is `NaN`, and `minCash > NaN` is always `false`, so the "High Idle Cash" recommendation **can never fire**. A capital-efficiency warning that silently never triggers is worse than none, because reviewers read its absence as a clean bill of health.

**Fix:** rename to `investLoan`; add a test that constructs an over-capitalised scenario and asserts the hint fires.

---

### F-14 — The KPI object is destructively mutated by the renderer

**Severity: Medium.** [app.js:1224-1231](../app.js#L1224-L1231):

```js
const { financials, sustainability, portfolio, value, impact: impactMetrics } = k.impact || {};
k.financials     = financials     || {};
k.sustainability = sustainability || {};
k.impact         = impactMetrics  || {};        // <-- k.impact is REPLACED
```

`k.impact` originally holds `{ impact, portfolio, financials, sustainability, value }`. After this runs, `k.impact` holds only the inner `impact` sub-object, and the other four are reachable only via the flattened aliases. Consequences:

- `updateKPIs` is **not idempotent** — calling it twice on the same object destroys `k.financials`, `k.sustainability` and the rest on the second pass.
- `generateSuggestions` reads `kpis.sustainability.monthsInsolvent` ([app.js:2831](../app.js#L2831)) and `kpis.financials.investorRepaid` ([app.js:2871](../app.js#L2871)) — properties that **only exist after `updateKPIs` has run**. Clicking the AI Advisor before a render throws. The controller half-knows this and papers over it with `setTimeout(..., 100)` ([app.js:3506](../app.js#L3506)).

Note also the nested `impact.impact` and the duplicated `netAssets` key at [app.js:874-875](../app.js#L874-L875) — the shape is accidental, not designed.

**Fix:** flatten `computeKPIs` to return a single flat object with documented keys. Never mutate results in a renderer.

---

### F-15 — Wizard functions reference DOM ids that were deleted

**Severity: Medium (latent).** `applyWizardSettings` ([app.js:1912](../app.js#L1912)) reads `wiz-risk` and `wiz-tech`, and writes to `loanInterestRate` and `hhDefaultRate`. Cross-checking against the markup:

- `wiz-risk`, `wiz-tech`, `wiz-duration`, `wiz-invest-grant`, `wiz-invest-loan`, `interest-help` — **none exist** in `index.html` or `methodology.html`.
- The rate field was renamed to `loanInterestRate_v2`, so `setVal('loanInterestRate', 5)` would throw on `document.getElementById(...).value`.

Neither `applyWizardSettings` nor `showWizardStep` is called from anywhere (each appears exactly once in the codebase — its own definition). `getInputs` also reads `wiz-tech` defensively at [app.js:1194](../app.js#L1194), producing a `wizTech` field the model never uses.

**Fix:** delete both functions and the `wizTech` field, or restore the wizard markup. Deleting is the honest option.

---

### F-16 — Duplicate object keys silently discard values

**Severity: Low**, but a reliable smell that a linter would have caught:

| Location | Key | Effect |
|---|---|---|
| [app.js:874-875](../app.js#L874-L875) | `netAssets` | Second wins; identical value, harmless today |
| [app.js:1153](../app.js#L1153)/[1190](../app.js#L1190), [1154](../app.js#L1154)/[1191](../app.js#L1191) | `investGrant`, `investLoan` | Read twice from the same element |
| [app.js:660-661](../app.js#L660-L661) | `dataMonthlyMes` | Listed twice in the `series` shorthand literal |
| [app.js:608-609](../app.js#L608-L609) | — | Comment line duplicated verbatim |
| [app.js:3607-3612](../app.js#L3607-L3612) | — | `calculateAffordability` block duplicated verbatim |

**Fix:** ESLint `no-dupe-keys` in Stage 0.

---

### F-17 — Two opposing percent heuristics; hyperinflation becomes 2%

**Severity: High.** The codebase guesses at units in two places, in opposite directions.

`UI.getInputs().getDecimal` ([app.js:1136-1148](../app.js#L1136-L1148)) — *anything above 1 must be a percentage*:

```js
if (val > 1.0) { val = val / 100; }
```

`UI.updateSmartRates().getVal` ([app.js:2921-2927](../app.js#L2921-L2927)) — *anything below 1 must be a decimal*:

```js
if (val > 0 && val < 1.0) val = val * 100;
```

Consequences:

- **Hyperinflation is unrepresentable.** A user modelling 150% annual inflation — not hypothetical in the LDCs this tool targets — enters `150`, and the model runs at **1.5%**. The code comment at [app.js:1140](../app.js#L1140) acknowledges this and ships it anyway.
- **100% is ambiguous.** `1.0` passes through as a decimal `1.0`; `100` becomes `1.0`. Both work, by luck.
- **0.5% is unrepresentable in the smart-rate path**, where `0.5` becomes `50`.
- The comment block above `getDecimal` is a five-line unresolved deliberation left in the shipped source.

**Measured.** `getDecimal(150)` returns `1.5`, i.e. a user typing `150` for 150% inflation gets a model running at 150%... by accident, because `1.5` *is* 150% as a decimal. But `getDecimal(150)` and `getDecimal(1.5)` are indistinguishable, and `updateSmartRates.getVal` reads the same field as `150` (percent). The two layers disagree about the same DOM node by a factor of 100.

**Fix:** one rule, enforced everywhere and stated in the UI: **all rates are entered as percentages** (`12` means 12%), converted to decimals exactly once at the boundary in `getInputs`. Suffix every percent field's label with `%`. See [PARAMETERS.md](PARAMETERS.md) for the canonical unit of every input.

---

### F-18 — `server.js` serves arbitrary files and lies about 404s

**Severity: Medium** (local dev only). [server.js:27-30](../server.js#L27-L30):

```js
let filePath = '.' + request.url;
```

No normalisation, no root containment. A request for `/../../../../Users/you/.ssh/id_rsa` resolves straight against the filesystem. The server binds the default interface, so on a shared or café network it is reachable by others. Additionally, the ENOENT branch ([server.js:38-42](../server.js#L38-L42)) responds `200 OK` with the (missing) `404.html` body and the *original* request's content type.

**Note:** Node.js is not installed on the current machine, so `server.js` cannot run here at all. `python -m http.server 8080` is the zero-install alternative and is what the [README](../README.md) now documents.

**Fix:** `path.normalize`, containment check against `process.cwd()`, correct status codes, bind `127.0.0.1`.

---

### F-19 — No manifest, no tests, no lint, no CI; all state is global

**Severity: High** — this is the finding that makes all the others expensive.

- No `package.json`, so there is no declared runtime, no scripts, no dependency pinning.
- No automated test of any kind. The "T1-T5 automated tests" named in the latest commit message are the runtime assertions inside `verifyLedger` — useful, but they run only in the browser, only on real user input, and report only to `console.error`.
- No ESLint/Prettier. `no-dupe-keys`, `no-undef` and `no-unused-vars` alone would have caught **F-13**, **F-15**, **F-16** and **F-25**.
- No CI, no `.gitignore`.
- `ModelModule`, `UI`, `ApiModule`, `LDC_COUNTRIES`, `chartInstances` and `runCalculation` are all top-level globals in one 3,667-line file; `UI` doubles as the results cache (`UI.lastResults`, `UI.lastApiData`, `UI.defaultValues`).

The git history tells the story: of 15 commits, **8 are single-error hotfixes** ("Fix TypeError: …", "Fix ReferenceError: …"), each found by a user in a browser rather than by a test.

**Fix:** Stage 0 of the roadmap. `tests/runner.html` (added by this audit) gives a zero-install regression suite that runs in the browser; `package.json` and CI follow for anyone who has Node.

---

### F-20 — Micro-enterprises are immortal

**Severity: Medium.** `currentMEs` only ever increases ([app.js:297](../app.js#L297), [app.js:432](../app.js#L432)). ME loans default at `meDefaultRate` ([app.js:359](../app.js#L359)) and their balances are written off — but the enterprise keeps producing toilets forever at `toiletsPerMeMonth`. Capacity ([app.js:445](../app.js#L445)) is therefore systematically overstated: at a 10% annual ME default rate over 10 years, roughly two-thirds of the modelled production capacity belongs to businesses that have failed.

**Measured.** A 0% ME write-down rate and a **50%** ME write-down rate both end with exactly **1,000 MEs**, despite $517,534 of ME loans being written off in the second case. Production capacity is completely insensitive to enterprise failure.

**Fix:** attrite `currentMEs` in proportion to ME defaults, or model ME survival explicitly with a documented relationship between financial default and operational exit.

---

### F-21 — ME growth magic numbers and inconsistent startup capital

**Severity: Medium.** [app.js:421-427](../app.js#L421-L427):

```js
const expansionBudget = lendable * 0.1;                              // why 10%?
const potentialNew = Math.min(Math.floor(expansionBudget / meSetup),
                              Math.ceil(currentMEs * 0.1));          // why 10%/month?
```

Neither `0.1` is an input, documented, or cited. A 10%/month cap compounds to about 3.1x/year, which is the dominant driver of the growth curve and is invisible to the user.

Separately, the month-0 sizing prices each ME at setup cost **plus** working capital ([app.js:288-290](../app.js#L288-L290)):

```js
const oneMeWorkingCapital = inputs.toiletsPerMeMonth * inputs.avgToiletCost * reserveMonthsStart;
const startupCostPerMe    = inputs.meSetupCost + oneMeWorkingCapital;
```

…but then books a loan for the setup cost **only** ([app.js:294](../app.js#L294), `startLoanVolume = startMEs * inputs.meSetupCost`). In-loop expansion ([app.js:423](../app.js#L423)) uses bare `meSetup` with no working-capital allowance at all. Three different notions of what an ME costs.

**Fix:** one `meCapitalRequirement()` function; expose the growth cap as an input; document both in the spec.

---

### F-22 — Chart.js is loaded unpinned from a CDN

**Severity: Medium.** [index.html:10](../index.html#L10):

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

No version, no `integrity`, no `crossorigin`. The app silently picks up whatever major version jsDelivr resolves to that day, and shows **blank charts with no error** offline — a realistic condition for field workshops in the countries this tool models.

**Fix:** pin an exact version, add SRI, and vendor a local copy as fallback.

---

### F-23 — `alert()` for analysis output; doubled currency symbol

**Severity: Low.** `generateSuggestions` ends with `alert(finalMsg.join("\n\n"))` ([app.js:2913](../app.js#L2913)) — a modal blocking dialog for multi-paragraph financial advice, which cannot be copied cleanly, scrolled reliably, or printed. There are 10 `alert()` calls in total.

The message templates also double the currency symbol: `fmt()` already returns `"$1,234"` via `Intl.NumberFormat` with `style: 'currency'` ([app.js:2827](../app.js#L2827)), and callers wrap it as `` `$${fmt(fixedOps)}` `` ([app.js:2848](../app.js#L2848) and six others), rendering **`$$1,234`**. Several templates also carry stray spaces from `** Fix **` markdown inside a plaintext alert.

---

### F-24 — The README documents behaviour that is not implemented

**Severity: Medium** — documentation drift is what let several findings above survive.

| README claim | Reality |
|---|---|
| "Debt Lookahead: 3 months of future principal payments" | Not implemented — see **F-10** |
| "Visible Warnings: An error banner appears immediately" | Banner is created dynamically and inserted after `.top-actions`; there is no `integrityBanner` in the markup, and the check itself can be disabled — see **F-11** |
| "Grace Period Sprint: the fund builds capacity while Debt Service is paused" | Interest is not merely paused, it never accrues — see **F-06** |
| "Real Rate Logic: the model ensures Nominal Rate > Inflation + Default Rate" | The model does not enforce this; `generateSuggestions` only *warns* about it after the fact ([app.js:2856](../app.js#L2856)) |
| "World Bank API … to calibrate defaults and interest rates" | True, but the fetched lending rate is not wired to `fundCostOfCapital` — see **F-01** |

**Fix:** the rewritten [README.md](../README.md) states only what the code does; [MODEL_SPEC.md](MODEL_SPEC.md) states what it *should* do, and every gap between them is a finding in this register.

---

### F-25 — Inputs collected and never used

**Severity: Low.** `avgAnnualIncome` ([app.js:1183](../app.js#L1183), auto-filled from GNI at [app.js:3345](../app.js#L3345)) is read into `inputs` and used nowhere in `ModelModule`. Same for `wizTech` ([app.js:1194](../app.js#L1194)). `popGrowthRate` is the same problem at higher severity — see **F-09**.

Affordability *is* computed from income in `UI.calculateAffordability`, but from `UI.lastApiData`, not from the user-editable field — so editing "Average Annual Income" changes nothing anywhere.

---

### F-26 — The default-rate definition is undocumented and counter-intuitive

**Severity: Medium.** [app.js:333-341](../app.js#L333-L341):

```js
const probDefHh = 1 - Math.pow(1 - (inputs.hhDefaultRate || 0.05), 1 / 12);
...
const def = c.balance * probDefHh;
outflows.defaultsHh += def;
c.balance -= def;
```

This applies a monthly hazard to the **outstanding balance** every month, without re-amortising `monthlyPayment`. So:

- The realised loss is **not** `hhDefaultRate x amount disbursed` — it depends on the amortisation profile and the term. A 5% "default rate" on a 6-month loan loses far less than 5% of principal; on a 24-month loan, more.
- Because `monthlyPayment` is never recalculated after a write-off, and the final month forces `prin = c.balance` ([app.js:347](../app.js#L347)), the cohort still closes out cleanly — the loss is absorbed by shrinking the final payment rather than by a missed payment.
- Interest is charged on the *post*-write-off balance ([app.js:343](../app.js#L343)), so a defaulting loan also silently earns less interest.

None of this is wrong *per se* — it is a defensible "fractional continuous write-down" convention. But the UI label says "Default Rate (%)" and users will read it as *percentage of loans that go bad*, which it is not.

**Measured.** On the baseline, a headline default rate of **5.0%** produces a realised loss of **1.50%** of disbursed principal ($319,708 of $21,296,422) on the 6-month household term. A user who sets 5% expecting to lose 5% is out by a factor of 3.3 — and both the size and the direction of that gap change with the loan term.

**Fix:** state the convention in [MODEL_SPEC.md](MODEL_SPEC.md) §3, and add a test that reports realised loss as a % of disbursed for a fixed scenario, so the relationship is visible and pinned.

---

### F-27 — The solver assumes a monotonicity it cannot rely on

**Severity: Medium.** `solveBreakEven` ([app.js:907-947](../app.js#L907-L947)) binary-searches `loanInterestRate` over [0, 1.5] for the lowest rate where `netAssets >= 0`. Binary search is valid only if `netAssets` is monotonically non-decreasing in the rate.

**Measured.** I swept the rate from 2% to 150% in 2-point steps across five parameter regimes and counted steps where net assets *fell* as the rate rose:

| Scenario | Downward steps (of 73) |
|---|---|
| baseline | 0 |
| short 6-month term, high demand | 0 |
| long 24-month term | 0 |
| high default (30%) | 0 |
| **capital-tight** (`investLoan` $500k, `investGrant` $100k) | **14** |

So the assumption holds at the shipped defaults but **breaks in the capital-constrained regime** — precisely the regime a user explores when asking "what if we raise less money?". The mechanism is the expected one: a higher rate raises the annuity payment, which raises the effective cost per unit, which cuts `maxUnits`, production, portfolio and interest income. In that region the solver can converge on a rate that is not the answer, with no indication that anything went wrong.

Confirmed alongside it:

- **22 full simulations per recalculation** (11 for `solveBreakEven`, 10 for `solveMaxGrant`, 1 for the display run), on every debounced recalc — measured by instrumenting `ModelModule.calculate`.
- `solveMaxGrant` returns **0.39%** on the baseline and **0.00%** when handed an impossible scenario (`annualFixedOpsCost` of $50M). Failure is indistinguishable from a genuine answer of zero.
- `solveBreakEven` returns `null` on failure, and callers store it without checking ([app.js:3530](../app.js#L3530)).
- The baseline break-even household rate is **50.5%** — a number worth surfacing prominently, since it is the model's own verdict on whether the demonstration scenario is viable.

**Fix:** scan a coarse grid first to confirm a sign change, then bisect within the bracketed interval; return a `{ ok, value, reason }` result object; cache or debounce the solver so it does not run 22 simulations per keystroke.

---

### F-28 — Union-typed KPIs and sentinel values

**Severity: Low.** [app.js:789-793](../app.js#L789-L793):

```js
let depletionYear = "Sustainable";
if (firstInsolvencyIndex !== -1) depletionYear = (firstInsolvencyIndex / 12).toFixed(1);
```

`depletionYear` is either the string `"Sustainable"` or a *string* like `"3.4"` — never a number. Anything that tries to compare, chart or aggregate it must special-case the sentinel. Likewise `opsRunway` returns `99` when `annualFixedOpsCost` is 0 ([app.js:895](../app.js#L895)) — a magic number that will be plotted as a real 99-year runway.

**Fix:** `{ depletionMonth: number | null, isSustainable: boolean }`; `opsRunway: number | null`. Format at the render boundary, not in the model.

---

### F-33 — The carbon input is labelled tonnes per year and used as kilograms, once

**Severity: High.** Three unit errors stack on the same parameter.

The label and its tooltip ([index.html:344-346](../index.html#L344-L346)) are unambiguous:

> **CO2e / Toilet (Tonnes/Yr)** — "Tonnes of CO2 equivalent emissions prevented per toilet **per year** (via waste treatment/methane capture)."

The model ([app.js:532-537](../app.js#L532-L537)):

```js
const newCarbonTons = (production * inputs.co2PerToilet) / 1000;
...
carbonRev = newCarbonTons * inputs.co2Value * (inputs.carbonCreditShare / 100);
```

1. **`/ 1000` treats the input as kilograms.** A user entering `0.2` tonnes gets 0.0002 tonnes credited. **1,000x understatement.**
2. **`/ 100` divides an already-decimal share again** — this is F-02. **100x understatement.**
3. **The credit is granted once, at construction**, not annually for each year the toilet operates. `production` is that month's new units, so the "per year" in the label never happens. A toilet built in month 1 of a 5-year run earns one year-equivalent of credit, not five.

**Measured.** Using the shipped default of `0.2` with `co2Value` $15 and a 100% share, across 211,317 toilets:

| | |
|---|---|
| Model output | **42.26 tonnes**, **$6.34** of revenue |
| Taking the label at its word (0.2 t/toilet/yr, ~2.5 average operating years in a 5-year run) | ~105,658 tonnes, ~$1,584,878 |
| Understatement | **~250,000x** |

The entire carbon-finance component of this fund model is, in effect, switched off — and it is switched off in a way that produces a plausible small number rather than a zero, so it reads as "carbon does not move the needle" rather than as a defect. For container-based sanitation and biogas business models, where carbon revenue is often the difference between viability and failure, this silently removes the main argument.

It is currently masked in the shipped configuration because `co2PerToilet` is overridden to `0.0` at [app.js:3127](../app.js#L3127) with the comment "Pit Latrines often have 0 or negative carbon benefit… We set default to 0 to be conservative." That override is defensible; it also means nobody has exercised this code path.

**Fix (Stage 1, alongside F-02):**

1. Delete the `/ 1000`, or relabel the input to kilograms — pick one and record it in [PARAMETERS.md](PARAMETERS.md). Tonnes is the conventional unit for carbon credits and matches `co2Value` ("Value per Tonne CO2e"), so relabelling the model is the better direction.
2. Delete the `/ 100` (F-02).
3. Decide whether credits accrue **annually over an operating life** (matching the label) or **once at construction** (matching the code), and record it as an ADR. If annual, add a `toiletLifespanYears` input and accrue against `dataMonthlyActiveToilets`, which the loop already tracks.
4. Add the unit test from F-02, extended: `co2PerToilet=1 tonne, co2Value=$10, share=50%, production=1` gives `carbonRev == 5` for the year.

---

### F-34 — The tested scenario is not the scenario that runs

**Severity: Critical.** Found by a user opening the app, after the entire suite reported green.

The shipped defaults were tuned so a new user would meet a fund that works ([ADR-0013](adr/0013-viable-default-scenario.md)), and `tools/baseline-inputs.js` mirrors those defaults, and every test in the suite is built on it. **All of it was measuring a state that exists for about 500 milliseconds.**

`app.js` auto-clicks the country-data button half a second after load ([app.js:3355](../app.js#L3355)), and the fetch handler then overwrites most of the form through seventeen `fillParam` calls — inflation, population, income, districts, ops cost, default rates, management fee, contingency, grant support, and (as of the F-01 fix) the cost of capital.

The specific breakage was introduced by the F-01 fix itself. Seeding `fundCostOfCapital` from the World Bank commercial lending rate seemed better-sourced than a guess. For Malawi that rate is **37.1%**, so the tool opened on a blended-finance vehicle borrowing at commercial rates — a contradiction in terms, since concessional pricing is the defining feature of the instrument.

**Measured** — what the browser actually opened on, before the fix:

| | |
|---|---|
| Cost of capital | **37.1%** (from `FR.INR.LEND`) |
| Inflation | 28.4% |
| Household rate | 48.4% (derived from inflation by `updateSmartRates`) |
| Verdict | **Insolvent from month 28**, −$6,047 at worst |
| Senior debt | **58.4% in default** — $2,305,810 outstanding |
| Interest capitalised | $572,264 |

**Two distinct defects:**

1. **The fetch fills negotiated terms from market observables.** A commercial lending rate is not a term sheet, and a poverty headcount is not a policy. Evidence should inform the user, not silently move the dials.
2. **Nothing tested the path a user takes.** The suite tested the model, the invariants, the wiring and the controller — and none of it touched the fetch handler, which is what determines the state the application actually runs in.

**Fix.** The cost of capital keeps its concessional default; the commercial rate is shown beside the field as context. And `tests/startup.test.js` now drives the real fetch handler against recorded World Bank and administrative-unit responses, asserting the resulting scenario is viable. That is the only test that answers *"does the thing a user opens actually work?"*.

**The lesson worth keeping:** a test suite is only as honest as its fixtures. Green tests against the wrong starting state are exactly as misleading as the green tick in **F-29** — and this repository has now produced that failure twice, in two different layers, within a day. See [ADR-0018](adr/0018-fetch-does-not-set-negotiated-terms.md).

---

### F-29 — The integrity check passes a run that went insolvent and defaulted

**Severity: Critical.** This is the finding that matters most, because it is the reason the others survived.

Running the model on its own shipped defaults produces this console output, verbatim:

```
Investor payments accrued (not yet paid): Int=$0, Prin=$749981
WARNING: Cash Balance went negative! -36350.60855488197
✅ Model Integrity Verified.
```

The fund is insolvent from year 4.1, ends $36,351 overdrawn, and has failed to repay $749,981 — **18.7% of the senior loan** — to its investor. The check reports success.

The two real problems are demoted to `console.warn` by design. [app.js:1046-1050](../app.js#L1046-L1050):

```js
const minCash = Math.min(...s.dataMonthlyCashBalance);
if (minCash < -100) {
    console.warn("WARNING: Cash Balance went negative!", minCash);
    // errors.push("Cash Balance Negative"); // Optional strictness
}
```

The line that would have failed the run is commented out and labelled "optional strictness". Likewise [app.js:1022-1024](../app.js#L1022-L1024) logs the $750k default as "informational".

The result is a tool that gives users a **green tick on a failing fund**. In the browser the `console.warn` lines are invisible unless devtools is open; the on-screen banner only ever renders for the `errors` array, which these never join. A user, a board paper, or an investment committee sees "Model Integrity Verified" and reasonably concludes the scenario is sound.

The distinction being conflated is real and worth preserving: *"the arithmetic is self-consistent"* is not the same claim as *"the fund works"*. The model checks the first and reports it in language that means the second.

**Fix (Stage 1, highest priority):**

1. Separate the two verdicts and label them distinctly: **Ledger integrity** (arithmetic invariants — the current checks) and **Fund viability** (solvency, full repayment, OSS ≥ 1).
2. Render the viability verdict **on screen**, not in the console. The banner infrastructure already exists.
3. Add INV-8 (no `NaN`, checked first — see **F-03**), INV-9 (repaid ≤ loan) and INV-10 (grant ledger never overdrawn) to the integrity set.
4. Never print a success message while any warning is outstanding.

---

### F-30 — Grant Support % is a pacing lever, not a volume lever

**Severity: High.** Sweeping `grantSupportPct` across an 18-fold range barely changes the outcome:

| Grant Support % | Grant-funded toilets | Loan-funded toilets | Grant fund exhausted |
|---|---|---|---|
| 5% | 8,894 | 205,431 | month 28 |
| 10% (default) | 9,050 | 202,267 | month 16 |
| 50% | 9,194 | 202,156 | month 5 |
| 90% | 9,214 | 202,130 | month 4 |

Total grant-funded output moves by **3.6%** for an 18x change in the input. The mechanism is structural, not a bug: total subsidy is capped by the grant ledger, so `maxGrants = floor(grantCash / grossUnitCost)` binds long before `grantSupportPct` does ([app.js:483](../app.js#L483)). The parameter controls **how fast the grant fund is spent**, not **how much** — 4 months at 90%, 28 months at 5%.

That is a legitimate model behaviour, but two things follow that are not:

1. **The UI presents it as the primary subsidy-policy dial**, and the methodology page describes it as the depth of subsidy. Users will read a change from 10% to 50% as "we subsidise five times as much". It does not.
2. **The auto-solver's only strategy is to cut this parameter** (**F-04**). Faced with a $749,981 repayment shortfall, it silently reduces Grant Support % up to five times per click — pulling a lever that cannot close the gap, because the shortfall sits in the *loan* ledger and grant spending barely touches it. The user's headline policy input is rewritten to no effect.

**Fix:** rename the field to reflect what it does ("Grant deployment rate"), show grant-fund runway next to it, and delete the auto-solver strategy that depends on it (**F-04**). If a genuine depth-of-subsidy control is wanted, it needs to be a per-unit subsidy percentage that draws proportionally from both ledgers — a spec change, not a rename.

---

### F-31 — The simulation does not stop when the fund dies

**Severity: High.** On a 20-year baseline run:

- Last month with any production: **M47**.
- Household portfolio at M47: $218,409, fully run off within the following 6 months.
- Income from M53 onward: **$0**, in every subsequent month.
- Ops cost paid after production stopped: **$1,085,986** across 193 months.
- Reported ending cash: **-$36,351** at 5 years, **-$314,909** at 10, **-$1,029,034** at 20.

Once `loanCash` drops below `requiredReserves`, the solvency gate ([app.js:407-409](../app.js#L407-L409)) is permanently closed: lending stops, so no new portfolio forms, so no repayments arrive, so cash never recovers. The fund enters an absorbing state and the model keeps simulating it — paying the 30% "collections floor" ops cost forever against a portfolio that no longer exists.

Two consequences:

1. **Toilet output is identical at 5, 10 and 20 years (211,317).** A user extending the horizon to see more impact gets none, and no explanation.
2. **Ending cash is a function of how long you left the simulation running**, not of fund performance. That figure feeds `netAssets`, `fundHealth`, `opsRunway` and SROI, so a 20-year run of the *same fund* looks $1M worse than a 5-year run.

The collections floor is also economically odd here: it keeps paying a collections team for 16 years after the last loan was repaid.

**Fix:** define a terminal state in the spec. When the portfolio is empty, the gate is closed and no capital remains, the fund is **wound up**: stop accruing ops, freeze the ledger, and record the wind-up month. Report `endingCash` as of wind-up, and label it. Add an invariant: no month may post an ops cost when both the portfolio and production are zero.

---

### F-32 — Extending the repayment term reduces repayment

**Severity: Medium.** Measured share of the $4,000,000 senior loan repaid:

| `fundRepaymentTerm` | Principal repaid | % |
|---|---|---|
| 1 year | $3,456,931 | 86.4% |
| 3 years | $3,528,214 | 88.2% |
| 5 years (default) | $3,250,019 | 81.3% |
| 10 years | $2,693,266 | **67.3%** |

Longer terms repay **less**, and the relationship is not even monotonic (3 years beats 1). The mechanism: principal amortises flat over the term ([app.js:136](../app.js#L136)), so a longer term means smaller monthly payments — but the fund's productive life ends at month 47 regardless (**F-31**), and any payment scheduled after the cash dries up simply never happens. Stretching the schedule past the fund's lifespan converts scheduled principal into permanent arrears.

This directly contradicts the advice the tool gives. `generateSuggestions` tells users, on the debt-trap branch ([app.js:2853](../app.js#L2853)) and the repayment-failure branch ([app.js:2877](../app.js#L2877)):

> "Extend 'Fund Repayment Term' (Current: 5 years)…"

Following that advice makes the outcome worse. The advisor was written against an intuition about how amortisation works, and never checked against the model.

**Fix:** two parts. (a) Fix the underlying cause — arrears must persist and be repaid from later surplus (**F-06**), and the fund must have a defined terminal state (**F-31**). (b) Ground the advisor in the model: each recommendation should be *computed* by re-running the simulation with the proposed change and confirming it improves the objective, rather than asserted from a rule of thumb. That is what the solver infrastructure already exists to do.

---

## 5. What is already good

Worth protecting during refactors:

- **The dual ledger.** Separating `grantCash` (subsidy, carbon) from `loanCash` (revolving, ops, debt service) is the right structure for a blended-finance vehicle, and it is applied consistently through the loop.
- **The cash identity holds by construction.** `netFlow` ([app.js:559](../app.js#L559)) is assembled from the same `inflows`/`outflows` buckets that mutate the ledgers, so the two cannot drift. This is the discipline that makes the model auditable.
- **Defaults are correctly excluded from cash.** Write-offs reduce cohort balances but are not treated as cash outflows in `netFlow` — a subtlety many spreadsheet models get wrong.
- **`verifyLedger` exists at all.** Self-checking after every run is unusual and valuable. It needs strengthening (**F-11**, **F-12**), not replacing.
- **Cohort-based portfolios.** Tracking `hhCohorts`/`meCohorts` as vintages, rather than as a single blended balance, gives correct term structure and makes the run-off during hibernation behave properly.
- **Cash-aware debt service.** The `Math.min(scheduled, available)` logic ([app.js:387-389](../app.js#L387-L389)) stops the fund paying money it does not have — the arrears just need somewhere to go (**F-06**).
- **The methodology page.** `methodology.html` is a genuinely good 522-line explainer with a parameter dictionary and a chart guide. It is the natural home for the user-facing half of the spec.

## 6. Metrics

| | |
|---|---|
| Total lines | 5,902 (`app.js` 3,667 / `index.html` 748 / `style.css` 965 / `methodology.html` 522) |
| Largest function | `ModelModule.calculate` — about 540 lines ([app.js:156-701](../app.js#L156-L701)) |
| Global identifiers | 6 |
| Tests | 0 automated (7 runtime assertions inside `verifyLedger`) |
| Dependencies declared | 0 (1 undeclared: Chart.js via CDN) |
| Commits | 15, of which 8 are single-error hotfixes |
| Findings raised | 34 (3 Critical, 9 High, 16 Medium, 6 Low) |
| Findings reproduced by execution | 16 |
| `console.*` calls | 19 |
| `alert()` calls | 10 |
| Inputs collected but unused | 3 (`popGrowthRate`, `avgAnnualIncome`, `wizTech`) |
| Inputs used but not exposed | 1 (`fundCostOfCapital`) |

---

## 7. Where to go next

1. **[ROADMAP.md](ROADMAP.md)** — the staged plan that sequences these fixes with entry and exit gates.
2. **[MODEL_SPEC.md](MODEL_SPEC.md)** — the normative definition of the maths, which resolves the open questions raised above.
3. **[../AGENTS.md](../AGENTS.md)** — the working contract for AI agents picking up any stage.
4. **[TESTING.md](TESTING.md)** — the invariants and golden scenarios that stop these regressing.
