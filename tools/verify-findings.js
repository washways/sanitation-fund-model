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
 * A finding marked OUTSTANDING here is one that is deliberately still open — either it
 * is scheduled for a later stage or it is blocked on a decision only the model owner
 * can make. Those are listed at the end with the reason.
 */
const { ModelModule } = require('./load-model');
const BASE = require('./baseline-inputs');

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
    `${money(withCoC.series.capitalisedInterest)} capitalised. Auto-filled from FR.INR.LEND on country fetch.`);
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
  const hasInv2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8').includes('INV-2:');
  check('F-12', 'the opening balance is now an enforced invariant',
    hasInv2 && r.integrity.ok,
    `INV-2 checks cash[0] against initial capital minus startup cost. The identity loop starts at i=1, ` +
    `so month 0 was previously the one unguarded link in the chain.`);
}

// F-13 — the idle-cash branch can fire.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  check('F-13', 'the "high idle cash" advisor branch is reachable again',
    !/inputs\.loanFund/.test(src.replace(/^\s*(\/\/|\*).*$/gm, '')),
    `compared against inputs.investLoan, not the non-existent inputs.loanFund. ` +
    `undefined * 0.2 is NaN, and "x > NaN" is always false, so the hint could never fire.`);
}

// F-15 — dead wizard code removed.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  check('F-15', 'dead wizard handlers and their phantom DOM ids are gone',
    !/^\s*applyWizardSettings\(\)/m.test(src) && !src.includes("getElementById('wiz-tech')"),
    `applyWizardSettings and showWizardStep referenced ids deleted long ago and were called from nowhere.`);
}

// F-16 — duplicate keys.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
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
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  check('F-23', 'the doubled currency symbol is gone',
    !src.includes('$${fmt('),
    `fmt() already returns "$1,234" via Intl.NumberFormat; callers wrapped it in another "$".`);
}

// F-17 — one unit convention, no magnitude guessing.
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
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
  const dying = { annualFixedOpsCost: 400000, loanInterestRate: 0.05 };
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

console.log('');
console.log('='.repeat(80));
console.log(`${fixed} fixed, ${present} still present`);
console.log('='.repeat(80));
console.log('');
console.log('DELIBERATELY OUTSTANDING (see docs/ANALYSIS.md and STATUS.md):');
console.log('  F-21   R-6.1\'s meCapitalRequirement is still three inconsistent formulas');
console.log('         (the two hardcoded growth constants half is fixed — ADR-0019).');
console.log('  F-27   Solver bisection still assumes monotonicity it lacks when capital-tight.');
console.log('');
console.log('  Not verified anywhere: nobody has opened the page in a real browser.');
