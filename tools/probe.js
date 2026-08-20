/**
 * probe.js — scratch diagnostics used while writing docs/ANALYSIS.md.
 * Not part of the regression suite. Run: node tools/probe.js
 */
const { ModelModule } = require('./load-model');
const BASE = require('./baseline-inputs');
const sum = a => a.reduce((x, y) => x + y, 0);
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const run = o => ModelModule.calculate({ ...BASE, ...o });

console.log('--- verifyLedger on the shipped defaults -------------------------------');
ModelModule.calculate({ ...BASE, enableBreakEvenSolver: true });

console.log('\n--- INV-10: does grantCash ever go negative? ---------------------------');
for (const g of [0.05, 0.25, 0.50, 0.90]) {
  const r = run({ grantSupportPct: g });
  const grantOut = sum(r.series.dataMonthlyGrantDisbursed);
  console.log(`  grantSupport ${(g * 100).toFixed(0).padStart(3)}%: grants disbursed ${money(grantOut).padStart(12)}` +
    `  toilets ${r.kpis.reach.toilets.toLocaleString().padStart(9)}  netAssets ${money(r.kpis.impact.financials.netAssets)}`);
}

console.log('\n--- INV-9: can repaid principal exceed the loan? -----------------------');
for (const t of [1, 3, 5, 10]) {
  const r = run({ fundRepaymentTerm: t, duration: Math.max(t, 5) });
  const repaid = sum(r.series.dataMonthlyFundPrincipal);
  console.log(`  term ${String(t).padStart(2)}y: repaid ${money(repaid).padStart(12)} of ${money(BASE.investLoan)}` +
    `  (${(repaid / BASE.investLoan * 100).toFixed(1)}%)`);
}

console.log('\n--- Solver behaviour ---------------------------------------------------');
let sims = 0;
const realCalc = ModelModule.calculate.bind(ModelModule);
ModelModule.calculate = function (i) { sims++; return realCalc(i); };
sims = 0; const be = ModelModule.solveBreakEven({ ...BASE });
const beSims = sims;
sims = 0; const mg = ModelModule.solveMaxGrant({ ...BASE });
const mgSims = sims;
ModelModule.calculate = realCalc;
console.log(`  solveBreakEven -> ${be === null ? 'null (FAILED)' : (be * 100).toFixed(2) + '%'}  [${beSims} simulations]`);
console.log(`  solveMaxGrant  -> ${(mg * 100).toFixed(2)}%  [${mgSims} simulations]`);
console.log(`  total per recalculation: ${beSims + mgSims + 1} full simulations`);

console.log('\n--- solveMaxGrant failure is indistinguishable from a real 0% ----------');
const hopeless = ModelModule.solveMaxGrant({ ...BASE, annualFixedOpsCost: 50000000 });
console.log(`  with impossible ops cost, solveMaxGrant returns ${(hopeless * 100).toFixed(2)}% (no error signal)`);

console.log('\n--- Monotonicity of netAssets in the interest rate ---------------------');
for (const scen of [
  ['baseline', {}],
  ['short 6m term, high demand', { termHh: 6, popReqToilets: 50e6 }],
  ['long 24m term', { termHh: 24 }],
  ['capital-tight', { investLoan: 500000, investGrant: 100000 }],
  ['high default', { hhDefaultRate: 0.30 }],
]) {
  const pts = [];
  for (let r = 0.02; r <= 1.5; r += 0.02) pts.push([r, run({ ...scen[1], loanInterestRate: r }).kpis.impact.financials.netAssets]);
  let inv = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] < pts[i - 1][1] - 1) inv++;
  console.log(`  ${scen[0].padEnd(28)} ${inv} downward steps of ${pts.length - 1}`);
}

console.log('\n--- opsReserveCap sensitivity (one-shot month-0 gate) ------------------');
for (const c of [0, 5, 10, 15, 20, 30, 50, 90]) {
  const r = run({ opsReserveCap: c });
  console.log(`  cap ${String(c).padStart(2)}%: startMEs ${String(r.series.startMEs).padStart(4)}` +
    `  toilets ${r.kpis.reach.toilets.toLocaleString().padStart(9)}  netAssets ${money(r.kpis.impact.financials.netAssets)}`);
}

console.log('\n--- Duration sensitivity ----------------------------------------------');
for (const d of [3, 5, 10, 20]) {
  const r = run({ duration: d });
  console.log(`  ${String(d).padStart(2)}y: toilets ${r.kpis.reach.toilets.toLocaleString().padStart(9)}` +
    `  cashEnd ${money(r.kpis.impact.financials.cashEnd).padStart(13)}` +
    `  repaid ${(r.kpis.impact.financials.investorRepaidPct * 100).toFixed(0)}%` +
    `  depletion ${r.kpis.impact.sustainability.depletionYear}`);
}
