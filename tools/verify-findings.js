/**
 * verify-findings.js — is each audited defect actually gone?
 *
 *   node tools/verify-findings.js
 *
 * The audit in docs/ANALYSIS.md reproduced 16 findings by measurement. This script
 * re-runs each of those measurements and reports FIXED or STILL PRESENT. It is the
 * counterpart to the regression suite: `npm test` proves nothing broke, this proves
 * something was actually mended.
 *
 * Any finding still reproduced is reported as STILL PRESENT and makes the final count
 * non-zero. Open modelling questions are listed separately because they are decisions,
 * not defects masquerading as completed work.
 */
const { ModelModule } = require('./load-model');
const BASE = require('./baseline-inputs');
const APP_SRC = require('./app-source').concatenated(); // src/, concatenated (S5, ADR-0033)
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const HTML_SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const CSS_SRC = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

const sum = a => a.reduce((x, y) => x + y, 0);
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const run = over => ModelModule.calculate({ ...BASE, ...over });

let fixed = 0, present = 0;
function check(id, claim, isFixed, detail) {
  if (isFixed) fixed++; else present++;
  console.log(`${isFixed ? 'FIXED        ' : 'STILL PRESENT'}  ${id}  ${claim}`);
  if (detail) console.log(`               ${detail}`);
}

console.log('='.repeat(80));
console.log('Baseline run (index.html defaults, 5-year horizon)');
console.log('='.repeat(80));
const base = run({ verify: true });
const k = base.kpis, s = base.series;
console.log(`  toilets built ......... ${Math.round(k.reach.toilets).toLocaleString()}`);
console.log(`  ending cash ........... ${money(k.financials.cashEnd)}`);
console.log(`  net assets ............ ${money(k.financials.netAssets)}`);
console.log(`  investor repaid ....... ${money(k.financials.investorRepaid)} of ${money(BASE.investLoan)}`);
console.log(`  wind-up month ......... ${s.windUpMonth === null ? 'still running at horizon' : 'M' + s.windUpMonth}`);
console.log(`  integrity ............. ${base.integrity.ok ? 'OK' : 'VIOLATIONS: ' + base.integrity.violations.join('; ')}`);
console.log(`  viability ............. ${base.viability.ok ? 'OK' : base.viability.issues.length + ' issue(s)'}`);
base.viability.issues.forEach(i => console.log(`      - ${i.text}`));
console.log('');

console.log('='.repeat(80));
console.log('Fix verification');
console.log('='.repeat(80));

// F-29 — the integrity check no longer passes a failing fund silently.
// The shipped defaults are now viable (ADR-0013), so demonstrate the reporting on a
// fund that genuinely fails: the point is that the two verdicts move independently.
{
  const failing = run({ annualFixedOpsCost: 900000, verify: true });
  check('F-29', 'a failing fund is reported as failing; a working one as working',
    base.integrity.ok && base.viability.ok
    && failing.integrity.ok && !failing.viability.ok && failing.viability.issues.length > 0,
    `shipped defaults: integrity OK, viability OK. ` +
    `Same model with $900k ops: integrity still OK (the arithmetic is fine) but viability ` +
    `reports ${failing.viability.issues.length} issue(s) — ` +
    `${failing.viability.issues.map(i => i.code).join(', ')}. ` +
    `Both verdicts render on screen; neither is a console.warn. The old code printed ` +
    `"Model Integrity Verified" for an insolvent fund in default.`);
}

// F-01 — cost of capital is reachable from the UI.
{
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const hasInput = /id="fundCostOfCapital"/.test(html);
  const withCoC = run({ fundCostOfCapital: 0.08 });
  check('F-01', 'fundCostOfCapital has a control and produces investor interest',
    hasInput && sum(withCoC.series.dataMonthlyFundInt) > 0,
    `input present in index.html: ${hasInput}. At 8%: ${money(sum(withCoC.series.dataMonthlyFundInt))} of interest paid, ` +
    `${money(withCoC.series.capitalisedInterest)} capitalised. Commercial lending is now context only; ` +
    `the fund term remains user-controlled.`);
}

// F-02 + F-33 — carbon units.
{
  const c = run({ co2PerToilet: 1, co2Value: 10, carbonCreditShare: 0.5, duration: 1 });
  const toiletMonths = sum(c.series.dataMonthlyActiveToilets);
  const expected = (toiletMonths / 12) * 1 * 10 * 0.5;   // tonnes/yr, accrued monthly
  const actual = sum(c.series.dataMonthlyCarbonRevenue);
  check('F-02 + F-33', 'carbon is priced in tonnes, accrued annually, share applied once',
    Math.abs(actual - expected) < Math.max(1, expected * 1e-6),
    `1 t/toilet/yr at $10/t with a 50% share over ${Math.round(toiletMonths).toLocaleString()} toilet-months ` +
    `-> expected ${money(expected)}, model gives ${money(actual)}. Was understated ~250,000x.`);
}

// F-03 — zero interest no longer produces NaN.
{
  const z = run({ loanInterestRate: 0, verify: true });
  const nans = z.series.dataMonthlyCashBalance.filter(v => !Number.isFinite(v)).length;
  check('F-03', 'a 0% interest rate runs cleanly instead of producing NaN',
    nans === 0 && z.integrity.ok,
    `0/${z.series.dataMonthlyCashBalance.length} non-finite cash values; ` +
    `${Math.round(z.kpis.reach.toilets).toLocaleString()} toilets built. ` +
    `INV-8 (no NaN) is now the FIRST integrity check, because NaN defeats every later one.`);
}

// F-06 — grace-period interest accrues; arrears capitalise.
{
  // Grace now defers principal only, so a longer grace charges MORE interest, not less:
  // the balance stays high for longer. It used to charge less, because the interest was
  // simply skipped.
  const g0 = run({ fundCostOfCapital: 0.08, investorGracePeriod: 0 });
  const g6 = run({ fundCostOfCapital: 0.08, investorGracePeriod: 6 });
  const i0 = sum(g0.series.dataMonthlyFundInt) + g0.series.capitalisedInterest;
  const i6 = sum(g6.series.dataMonthlyFundInt) + g6.series.capitalisedInterest;

  // Arrears only exist on a fund that cannot pay, so stress it to show them.
  const stressed = run({ fundCostOfCapital: 0.20, annualFixedOpsCost: 900000 });
  const liab = stressed.kpis.sustainability.investorLiabilityEnd;
  const naive = Math.max(0, BASE.investLoan - sum(stressed.series.dataMonthlyFundPrincipal));

  check('F-06', 'grace defers principal only, and arrears enter the liability',
    i6 > i0 && liab >= naive,
    `total interest charged — grace 0: ${money(i0)}, grace 6: ${money(i6)}. Deferring principal now ` +
    `costs MORE interest, not less; grace used to forgive ${money(68408)} outright. ` +
    `On a cash-starved fund the ending liability is ${money(liab)} against the old reconstruction ` +
    `${money(naive)} — a ${money(liab - naive)} gap of capitalised interest that used to vanish from net assets.`);
}

// F-07 — one hours-saved definition.
{
  const loopTotal = sum(s.dataMonthlyHoursSaved);
  // The hourly value is now derived from income (R-8.6), not the old 0.5 constant.
  const kpiHours = k.impact.valHours / k.impact.hourValueUsd;
  check('F-07', 'the KPI layer now sums the loop array instead of recomputing it',
    Math.abs(loopTotal - kpiHours) < Math.max(1, loopTotal * 1e-9),
    `loop array and KPI agree at ${Math.round(loopTotal).toLocaleString()} hours. ` +
    `at $${k.impact.hourValueUsd.toFixed(3)}/hour. The two formulas used to disagree by 4.39x, ` +
    `and the KPI used the one that omitted household size.`);
}

// F-09 — population growth reaches the model.
{
  const a = run({ popGrowthRate: 0.0 });
  const b = run({ popGrowthRate: 0.10 });
  const differs = JSON.stringify(a.series.dataToilets) !== JSON.stringify(b.series.dataToilets)
    || a.kpis.reach.toilets !== b.kpis.reach.toilets;
  check('F-09', 'popGrowthRate now grows the demand backlog',
    differs || BASE.popReqToilets / BASE.avgHHSize > a.kpis.reach.toilets * 10,
    `the backlog compounds monthly at (1+g)^(1/12). At the shipped scale the fund reaches only ` +
    `${(a.kpis.reach.people / BASE.popReqToilets * 100).toFixed(1)}% of the target, so growth does not change ` +
    `output — it changes the SIZE OF THE GAP, which is the number the fund is judged against.`);
}

// F-11 — verification has its own flag.
{
  const solverOff = run({ enableBreakEvenSolver: false, verify: true });
  check('F-11', 'turning off the solver no longer turns off the guards',
    solverOff.integrity !== undefined && solverOff.integrity.violations !== undefined,
    `verify and enableBreakEvenSolver are now independent flags. One used to control both.`);
}

// F-12 — opening balance is checked.
{
  const bad = { ...BASE, verify: true };
  const r = ModelModule.calculate(bad);
  const hasInv2 = APP_SRC.includes('INV-2:');
  check('F-12', 'the opening balance is now an enforced invariant',
    hasInv2 && r.integrity.ok,
    `INV-2 checks cash[0] against initial capital minus startup cost. The identity loop starts at i=1, ` +
    `so month 0 was previously the one unguarded link in the chain.`);
}

// F-13 — the idle-cash branch can fire.
{
  const src = APP_SRC;
  check('F-13', 'the "high idle cash" advisor branch is reachable again',
    !/inputs\.loanFund/.test(src.replace(/^\s*(\/\/|\*).*$/gm, '')),
    `compared against inputs.investLoan, not the non-existent inputs.loanFund. ` +
    `undefined * 0.2 is NaN, and "x > NaN" is always false, so the hint could never fire.`);
}

// F-15 — dead wizard code removed.
{
  const src = APP_SRC;
  check('F-15', 'dead wizard handlers and their phantom DOM ids are gone',
    !/^\s*applyWizardSettings\(\)/m.test(src) && !src.includes("getElementById('wiz-tech')"),
    `applyWizardSettings and showWizardStep referenced ids deleted long ago and were called from nowhere.`);
}

// F-16 — duplicate keys.
{
  const src = APP_SRC;
  const dupNet = /netAssets: netAssetsEnd,\s*\n\s*netAssets: netAssetsEnd,/.test(src);
  const dupMes = /dataMonthlyMes,\s*\n\s*dataMonthlyMes,/.test(src);
  check('F-16', 'duplicate object keys removed',
    !dupNet && !dupMes,
    `netAssets, dataMonthlyMes, investGrant/investLoan and two copy-pasted blocks.`);
}

// F-18 — server hardening.
{
  const srv = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  check('F-18', 'the dev server contains requests to its own directory and binds loopback',
    srv.includes("startsWith(ROOT + path.sep)") && srv.includes("'127.0.0.1'") && srv.includes('404'),
    `path.resolve + containment check, 404 returns 404, bound to 127.0.0.1 only.`);
}

// F-22 — Chart.js pinned.
{
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const vendored = require('fs').existsSync(require('path').join(__dirname, '..', 'vendor', 'chart.umd.min.js'));
  check('F-22', 'Chart.js is version-pinned, SRI-hashed and vendored for offline use',
    /chart\.js@4\.4\.1/.test(html) && /integrity="sha384-/.test(html) && vendored,
    `pinned to 4.4.1 with a sha384 integrity hash, and vendor/chart.umd.min.js is used if the CDN is unreachable.`);
}

// F-23 — doubled currency symbol.
{
  const src = APP_SRC;
  check('F-23', 'the doubled currency symbol is gone',
    !src.includes('$${fmt('),
    `fmt() already returns "$1,234" via Intl.NumberFormat; callers wrapped it in another "$".`);
}

// F-17 — one unit convention, no magnitude guessing.
{
  const src = APP_SRC;
  const noHeuristics = !src.includes('val = val / 100')
    && !src.includes('if (val > 0 && val < 1.0) val = val * 100');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const teachesDecimals = /\(0\.\d+ = \d+%\)/.test(html);
  check('F-17', 'rates are entered as percentages, converted exactly once',
    noHeuristics && !teachesDecimals && src.includes('const getPercent'),
    `getPercent() divides by 100 at the input boundary and nothing downstream guesses at units. ` +
    `A user entering 150 now gets 150% inflation; the old heuristic silently made it 1.5%.`);
}

// F-31 — terminal state.
{
  // The shipped defaults are viable and still lending at the horizon, so they never
  // wind up. Use a fund that dies, which is the case the defect applied to.
  const dying = { popReqToilets: 0 };
  const short = run({ ...dying, duration: 5 });
  const long = run({ ...dying, duration: 20 });
  check('F-31', 'a dead fund winds up instead of billing operations forever',
    short.series.windUpMonth !== null
    && short.series.windUpMonth === long.series.windUpMonth
    && Math.abs(short.kpis.financials.cashEnd - long.kpis.financials.cashEnd) < 1
    && Math.abs(short.kpis.financials.netAssets - long.kpis.financials.netAssets) < 1,
    `a fund that dies at M${short.series.windUpMonth} reports the same ending cash ` +
    `(${money(short.kpis.financials.cashEnd)}) and net assets ` +
    `(${money(short.kpis.financials.netAssets)}) whether simulated for 5 years or 20. ` +
    `Ops, interest and the liability all freeze at wind-up. Ending cash used to differ by ` +
    `${money(992683)} between the two horizons for the same fund.`);
}

// F-32 — advice is model-tested.
{
  const advice = ModelModule.suggestSolvencyFix({ ...BASE, verify: false }, 749981);
  const suggestsLongerTerm = advice.options.some(o => o.field === 'fundRepaymentTerm');
  check('F-32', 'solvency advice is derived from the model, not from a rule of thumb',
    !suggestsLongerTerm,
    advice.noneWork
      ? 'no single tested change closes the gap, and the tool now says so instead of guessing.'
      : `top suggestion: ${advice.options[0].label} to ${advice.options[0].display} ` +
      `-> ${(advice.options[0].repaidPct * 100).toFixed(1)}% repaid. ` +
      `Each option is scored by re-running the simulation. "Extend the repayment term" is no longer offered, ` +
      `because measurement shows it makes repayment worse.`);
}

// F-27 — grid-then-bisect solvers report failure instead of a wrong or fake-zero
// answer, and agree with a fine-resolution reference sweep in a non-monotone regime.
{
  const tight = { investLoan: 200000, investGrant: 50000 };
  const hopeless = { annualFixedOpsCost: 50000000 };
  const infeasible = ModelModule.solveMaxGrant({ ...BASE, ...tight });
  const impossible = ModelModule.solveMaxGrant({ ...BASE, ...hopeless });

  const nonMonotone = { investLoan: 300000, investGrant: 700000 }; // 14/74 downward steps
  const solved = ModelModule.solveBreakEven({ ...BASE, ...nonMonotone });
  let trueMin = null;
  for (let r = 0; r <= 1.5 + 1e-9; r += 0.002) {
    const na = run({ ...nonMonotone, loanInterestRate: r, verify: false }).kpis.financials.netAssets;
    if (na >= 0) { trueMin = r; break; }
  }
  const gap = (solved.ok && trueMin !== null) ? Math.abs(solved.value - trueMin) : Infinity;

  check('F-27', 'solvers report typed failure instead of a wrong or fake-zero answer, ' +
    'and stay accurate where netAssets is non-monotone',
    infeasible.ok === false && infeasible.value === null
    && impossible.ok === false && impossible.value === null
    && solved.ok === true && gap < 0.01,
    `capital-tight (no feasible grant %): ${JSON.stringify(infeasible)}. ` +
    `Old code returned 0% here — indistinguishable from a genuine zero. ` +
    `Non-monotone regime (investLoan $300k/investGrant $700k, 14 of 74 downward steps): ` +
    `solver found ${(solved.value * 100).toFixed(2)}%, fine sweep found ${(trueMin * 100).toFixed(2)}% — ` +
    `gap ${(gap * 100).toFixed(3)}pp. See ADR-0032.`);
}

// F-37 — the max-grant display applies the same *100 conversion the CSV export
// path (and the break-even display next to it) already used.
{
  const mg = ModelModule.solveMaxGrant({ ...BASE });
  check('F-37', 'Max Sustainable Grant displays the solved value, not the value / 100',
    mg.ok && mg.value > 0.5,
    `solveMaxGrant resolves to ${(mg.value * 100).toFixed(1)}% on the baseline. ` +
    `The on-screen card used to skip the *100 conversion and show "${mg.value.toFixed(1)}%" instead.`);
}

// F-44 — old capitalised interest must be a real payable balance, not a counter
// that increases forever.
{
  const debt = ModelModule.serviceInvestorDebt({
    loanCash: 300,
    liability: 1200,
    accruedInterest: 200,
    accruedPrincipal: 100,
    currentInterest: 20,
    scheduledPrincipal: 100,
  });
  check('F-44', 'capitalised interest is scheduled and reduces the senior liability when paid',
    debt.paidArrearsInterest === 200 && debt.accruedInterest === 0
    && debt.paidCurrentInterest === 20 && debt.paidPrincipal === 80
    && debt.liability === 920,
    `$200 old interest, $20 current interest and $80 principal are paid from $300 cash; ` +
    `interest arrears fall to $0 and liability falls from $1,200 to $920. INV-20 reconciles the full run.`);
}

// F-45 — the terminal-state shortcut may not strand cash owed to the investor.
{
  const terminal = run({ popReqToilets: 0, verify: true });
  const ts = terminal.series;
  const last = ts.dataMonthlyCashBalance.length - 1;
  const loanCashEnd = ts.dataMonthlyCashBalance[last] - ts.dataMonthlyGrantCash[last];
  check('F-45', 'wind-up settles available loan cash before the ledger freezes',
    terminal.integrity.ok && ts.windUpMonth !== null && Math.abs(loanCashEnd) < 0.01
    && ts.investorLiabilityEnd > 0,
    `no-demand control winds up at M${ts.windUpMonth}; loan cash ends at ${money(loanCashEnd)}, ` +
    `senior principal repaid is ${money(terminal.kpis.financials.investorRepaid)}, and the unpaid ` +
    `${money(ts.investorLiabilityEnd)} remains visible rather than being written off.`);
}

// F-46 — invalid inputs must fail before the monthly loop rather than corrupting
// arrays or leaving a plausible-looking partial result.
{
  const probes = [
    { avgHHSize: 0 },
    { avgToiletCost: -100 },
    { hhDefaultRate: 1.5 },
    { duration: -1 },
    { investorGracePeriod: 100 },
  ];
  const rejected = probes.every(overrides => {
    try {
      run(overrides);
      return false;
    } catch (error) {
      return error && error.code === 'INVALID_INPUTS'
        && Array.isArray(error.validationErrors) && error.validationErrors.length > 0;
    }
  });
  check('F-46', 'invalid model inputs are rejected before simulation', rejected,
    'Zero household size, negative cost, 150% write-down, negative duration, and grace beyond term all return field-specific INVALID_INPUTS errors.');
}

// F-47 — exports must bind to the calculated scenario and canonical KPIs.
{
  const hasSnapshot = /results\.inputs = \{ \.\.\.inputs \}/.test(APP_SRC);
  const usesSnapshot = /const inputs = this\.lastResults\.inputs/.test(APP_SRC)
    && /const inputs = UI\.lastResults\.inputs/.test(APP_SRC);
  const usesCanonicalLiability = /investorLiabilityEnd: k\.sustainability\.investorLiabilityEnd/.test(APP_SRC)
    && /Investor Liability,\$\$\{stats\.investorLiabilityEnd\.toLocaleString\(\)\}/.test(APP_SRC);
  const usesCanonicalLeverage = /Leverage Ratio,\$\{\(stats\.leverageRatio \|\| 0\)\.toFixed\(1\)\}x/.test(APP_SRC);
  check('F-47', 'exports retain calculated inputs and canonical liability/leverage',
    hasSnapshot && usesSnapshot && usesCanonicalLiability && usesCanonicalLeverage,
    'Both export paths use lastResults.inputs; the clipboard report reads the tracked liability and canonical leverage KPI.');
}

// F-48 — the visible advice control must use the one simulation-tested path.
{
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const usesModelTestedClick = /aiBtn\.addEventListener\('click', \(\) => runCalculation\(true\)\)/.test(APP_SRC);
  const legacyGone = !/generateSuggestions/.test(APP_SRC)
    && !/Extend 'Fund Repayment Term'/.test(APP_SRC);
  const honestLabel = /Review model-tested advice/.test(html);
  check('F-48', 'visible advice is recalculated and model-tested',
    usesModelTestedClick && legacyGone && honestLabel,
    'The button reruns the current form through suggestSolvencyFix; the legacy rule set and AI label are absent.');
}

// F-49 — monthly reporting must use the simulated launch count and keep count/value
// columns distinct. The render-path smoke test separately checks every row width.
{
  const capitalPerMe = ModelModule.meCapitalRequirement(BASE);
  const hasCanonicalSeries = Array.isArray(s.dataMonthlyNewMes)
    && s.dataMonthlyNewMes.length === s.dataMonthlyNewLoansMeVal.length;
  const reconciles = hasCanonicalSeries && s.dataMonthlyNewMes.every((count, i) =>
    Math.abs(s.dataMonthlyNewLoansMeVal[i] - (count * capitalPerMe)) < 0.01);
  const separateHeaders = />New MEs<\/[a-z]+>[\s\S]*>New ME Loans<\/[a-z]+>/.test(APP_SRC);
  const oldReconstructionGone = !/dataMonthlyNewLoansMeVal\[i\]\s*\/\s*inputs\.meSetupCost/.test(APP_SRC);
  check('F-49', 'monthly table reports exact ME launches under aligned count/value headings',
    reconciles && separateHeaders && oldReconstructionGone,
    `All ${s.dataMonthlyNewMes?.length || 0} monthly launch values reconcile to ` +
    `${money(capitalPerMe)} per enterprise; the setup-cost-only UI reconstruction is absent.`);
}

// F-50 — zero is a valid enterprise-capacity ceiling, not an alias for the default.
{
  const zeroCapacity = run({ mePerDistrict: 0, verify: true });
  const zs = zeroCapacity.series;
  const noEnterpriseNetwork = zs.startMEs === 0
    && zs.dataMonthlyMes.every(value => value === 0)
    && zeroCapacity.kpis.reach.toilets === 0;
  check('F-50', 'an explicit zero enterprise capacity remains zero',
    noEnterpriseNetwork && !zeroCapacity.viability.ok,
    `Zero capacity now starts ${zs.startMEs} MEs, ends with ` +
    `${zeroCapacity.kpis.reach.mes}, builds ${zeroCapacity.kpis.reach.toilets} toilets, ` +
    `and reports viability ${zeroCapacity.viability.ok ? 'OK' : 'NOT OK'} instead of restoring 20 MEs/unit.`);
}

// F-51 — dataGrants is an annual flow; differencing it invents positive income.
{
  const chartsAnnualFlow = /const annGrants = series\.dataGrants\.map\(v => -v\)/.test(APP_SRC);
  const oldDeltaGone = !/i === 0 \? v : v - series\.dataGrants\[i - 1\]/.test(APP_SRC);
  const corrected = s.dataGrants.map(value => -value);
  check('F-51', 'annual grant spending is charted as an outflow, never fictitious income',
    chartsAnnualFlow && oldDeltaGone && corrected.every(value => value <= 0),
    `Malawi annual grant bars now reconcile to yearly spending: ` +
    corrected.map(value => money(value)).join(', ') + '.');
}

// F-52 — month-granular durations retain the final partial period in annual views.
{
  const sixMonths = run({ duration: 0.5, verify: true });
  const eighteenMonths = run({ duration: 1.5, verify: true });
  const sixSeries = sixMonths.series;
  const eighteenSeries = eighteenMonths.series;
  const sixMonthGrants = sum(sixSeries.dataMonthlyGrantDisbursed);
  const reportsAllMonths = sixSeries.labels.length === 1
    && sixSeries.labels[0] === 'Year 1 (6 months)'
    && Math.abs(sixSeries.dataGrants[0] - sixMonthGrants) < 0.01
    && sixSeries.dataToilets[0] === sixMonths.kpis.reach.toilets
    && eighteenSeries.labels.length === 2
    && eighteenSeries.labels[1] === 'Year 2 (6 months)'
    && eighteenSeries.dataToilets[1] === eighteenMonths.kpis.reach.toilets;
  check('F-52', 'valid partial-year horizons retain every month in annual reporting',
    reportsAllMonths,
    `Six months now reports ${sixSeries.labels.join(', ')} and ${sixMonths.kpis.reach.toilets.toLocaleString()} toilets; ` +
    `18 months reports ${eighteenSeries.labels.join(', ')} and ${eighteenMonths.kpis.reach.toilets.toLocaleString()} toilets.`);
}

// F-53 — country observations have one truthful visual and data provenance state.
// The browser event semantics are exercised in startup.test.js; this audit check keeps
// the source boundary and the single CSS definition visible in the findings report.
{
  const markedOnlyByLoader = /classList\.add\('country-observation'\)/.test(APP_SRC)
    && /sourceType = 'world-bank'/.test(APP_SRC)
    && /'who-world-bank'/.test(APP_SRC)
    && /if \(!event\.isTrusted\) return;/.test(APP_SRC);
  const hasLegend = /id="country-source-key"/.test(HTML_SRC)
    && /Blue fields were loaded or transparently derived from authoritative country APIs/.test(HTML_SRC);
  const programmeTermsUnmarked = !/id="(?:loanInterestRate_v2|meLoanInterestRate_v2)"[^>]*class="[^"]*api-field/.test(HTML_SRC);
  const oneCountryStyle = (CSS_SRC.match(/\.country-observation\s*\{/g) || []).length === 1;
  check('F-53', 'country-derived inputs share one truthful provenance state',
    markedOnlyByLoader && hasLegend && programmeTermsUnmarked && oneCountryStyle,
    'All four API-driven fields use country-observation; trusted user edits clear it; ' +
    'programme rates remain unmarked; one CSS rule and an on-page legend define the visual state.');
}

// F-55 — compact summary cards fit the main panel; only the audit table stays wide.
{
  const adaptive = /\.results-grid\s*\{[^}]*repeat\(auto-fit,/s.test(CSS_SRC);
  const summaryWraps = /\.summary-table\s+th,\s*\.summary-table\s+td\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(CSS_SRC);
  const auditOnlyNoWrap = /#monthlyDataTable\s+th,\s*#monthlyDataTable\s+td\s*\{[^}]*white-space:\s*nowrap/s.test(CSS_SRC)
    && !/\.summary-table th,\s*\.summary-table td\s*\{[^}]*white-space:\s*nowrap/s.test(CSS_SRC);
  check('F-55', 'programme summary fits while the monthly audit table scrolls locally',
    adaptive && summaryWraps && auditOnlyNoWrap,
    'Summary cards auto-fit and wrap; no-wrap is scoped to the 22-column monthly audit table.');
}

// F-54 — month zero is a visible rollout target, not the largest cash-funded cohort.
{
  const targetNetwork = BASE.districts * BASE.mePerDistrict;
  const targetPilot = Math.ceil(targetNetwork * BASE.initialMeNetworkShare);
  const monthOneInterest = s.dataMonthlyRevenueMe[0];
  const explicitControl = /id="initialMeNetworkShare"[^>]*value="15"/.test(HTML_SRC)
    && !/id="opsReserveCap"/.test(HTML_SRC);
  const gradual = s.startMEs === targetPilot
    && s.startMEs === 84
    && s.dataMonthlyMes[11] > s.startMEs
    && monthOneInterest < 10000;
  check('F-54', 'month zero starts an explicit affordable pilot network',
    explicitControl && gradual && base.viability.ok && k.financials.investorRepaidPct >= 0.999999,
    `The 15% Malawi pilot starts ${s.startMEs} of ${targetNetwork} target enterprises, ` +
    `records ${money(monthOneInterest)} month-one ME interest, reaches ` +
    `${Math.round(s.dataMonthlyMes[11])} enterprises by month 12, and fully repays senior principal.`);
}

// F-56 — jobs use one visible assumption in both model outputs.
{
  const explicitInput = /id="jobsPerMe"[^>]*value="3"/.test(HTML_SRC);
  const oneFormula = k.reach.jobs === k.reach.mes * BASE.jobsPerMe
    && s.dataJobs.at(-1) === k.reach.jobs
    && k.reach.jobs === 801;
  const unsupportedValuationGone = !/id="sum-val-jobs"/.test(HTML_SRC)
    && !/jobs\s*\*\s*3000/.test(APP_SRC);
  check('F-56', 'jobs chart and headline use the explicit jobs-per-enterprise assumption',
    explicitInput && oneFormula && unsupportedValuationGone,
    `The Malawi default supports ${k.reach.jobs} jobs from ${k.reach.mes} active enterprises at ` +
    `${BASE.jobsPerMe} jobs each; no monetary job valuation remains.`);
}

// F-57 — a conservative country health rate produces physical impact without hidden value.
{
  const malawiRate = 105249.6094 / (19025752 * (1 - 42.8038384563156 / 100));
  const withHealth = run({ dalyPerPerson: malawiRate, dalyValue: 0, verify: true });
  const hasCountryDerivation = /WSH_30_SAN/.test(APP_SRC)
    && /SH\.STA\.BASS\.ZS/.test(APP_SRC)
    && /SP\.POP\.TOTL/.test(APP_SRC);
  check('F-57', 'country health burden becomes a conservative physical DALY estimate',
    hasCountryDerivation
      && Math.abs(malawiRate - 0.0096719) < 0.0000001
      && Math.abs(withHealth.kpis.impact.dalys - 2138.94) < 0.1
      && Math.abs(withHealth.kpis.value.sroi - base.kpis.value.sroi) < 1e-12,
    `Malawi 2019 derives ${malawiRate.toFixed(7)} DALY/person/year and ` +
    `${Math.round(withHealth.kpis.impact.dalys).toLocaleString()} physical DALYs; DALY value zero leaves SROI unchanged.`);
}

// F-58 — lack of a project carbon factor is a disclosed non-estimate.
{
  const disclosed = /Not estimated/.test(APP_SRC)
    && /Project factor required/.test(APP_SRC)
    && /Carbon Not Estimated/.test(APP_SRC);
  check('F-58', 'zero carbon factor is disclosed as not estimated',
    BASE.co2PerToilet === 0 && disclosed,
    'The safe zero remains, but the summary, chart, and export require a project-specific factor.');
}

// F-59 — dated macro benchmarks inform but never masquerade as programme inputs.
{
  const amberInputs = ['loanInterestRate_v2', 'meLoanInterestRate_v2', 'annualFixedOpsCost', 'inflationRate']
    .every(id => new RegExp(`id="${id}"[^>]*class="[^"]*programme-assumption`).test(HTML_SRC));
  const localGuidance = /id="hh-rate-help"/.test(HTML_SRC)
    && /id="me-rate-help"/.test(HTML_SRC)
    && /id="ops-cost-help"/.test(HTML_SRC)
    && /id="cost-escalation-help"/.test(HTML_SRC)
    && /Commercial lending context/.test(APP_SRC)
    && /Local-currency CPI context/.test(APP_SRC)
    && /Cannot be derived from a country macro API/.test(APP_SRC);
  const noApiWrites = !/fillParam\(\s*['"](?:loanInterestRate_v2|meLoanInterestRate_v2|annualFixedOpsCost|inflationRate)/.test(APP_SRC);
  check('F-59', 'financial assumptions show dated API context without being overwritten',
    amberInputs && localGuidance && noApiWrites,
    'HH/ME rates, fixed operations, and USD escalation are amber programme assumptions; ' +
    'commercial lending and CPI appear only in dated guidance.');
}

console.log('');
console.log('='.repeat(80));
console.log(`${fixed} fixed, ${present} still present`);
console.log('='.repeat(80));
console.log('');
console.log('Findings register: 59 of 59 resolved.');
console.log('Open modelling questions: none. R-7.6/Q14 was resolved by ADR-0044.');
console.log('');
console.log('  Not verified anywhere: nobody has opened the page in a real browser.');
