/**
 * golden.scenarios.js — the scenario set and the summary shape recorded for each.
 *
 * Shared by golden.test.js (compares) and golden.record.js (writes).
 *
 * Adding a scenario: add it here, run `node tests/golden.record.js`, commit both
 * files together. Choose scenarios that exercise a distinct *path* through the
 * model, not just a different number — a scenario that produces the same code
 * path as an existing one adds runtime and catches nothing.
 */

const SCENARIOS = {
  // The scenario a new user actually sees.
  'baseline (index.html defaults)': {},

  // Capital structure — each ledger alone, and the debt-free case.
  'grant capital only': { investLoan: 0, fundRepaymentTerm: 0 },
  'loan capital only': { investGrant: 0 },
  'with cost of capital (8%)': { fundCostOfCapital: 0.08 },
  'no investor grace period': { investorGracePeriod: 0 },

  // Macro conditions.
  'zero inflation': { inflationRate: 0 },
  'high inflation (45%)': { inflationRate: 0.45 },

  // Credit conditions.
  'zero defaults': { hhDefaultRate: 0, meDefaultRate: 0 },
  'high defaults (40%)': { hhDefaultRate: 0.40, meDefaultRate: 0.40 },
  'long household term (24m)': { termHh: 24 },

  // Subsidy policy — pacing, not volume (F-30).
  'no grant support': { grantSupportPct: 0 },
  'full grant support': { grantSupportPct: 1.0 },

  // Binding constraint regimes.
  'capital constrained': { investLoan: 500000, investGrant: 100000 },
  'demand constrained': { popReqToilets: 5000 },
  'capacity constrained': { districts: 2, mePerDistrict: 2 },

  // Horizon — currently changes the answer (F-31, INV-14).
  'short horizon (1y)': { duration: 1 },
  'long horizon (20y)': { duration: 20 },

  // Carbon revenue path (F-02, F-33) and its crediting-life cap (R-8.5).
  'carbon enabled': { co2PerToilet: 250, co2Value: 20, carbonCreditShare: 0.5 },
  'carbon, short crediting life': { co2PerToilet: 250, co2Value: 20, carbonCreditShare: 0.5, toiletLifespanYears: 2 },

  // Micro-enterprise attrition (R-6.3).
  'no ME attrition': { meExitRate: 0 },
  'high ME attrition': { meExitRate: 0.40 },
};

const sum = a => (Array.isArray(a) ? a.reduce((x, y) => x + y, 0) : 0);
const r2 = n => (Number.isFinite(n) ? Math.round(n * 100) / 100 : n);

/**
 * The recorded fingerprint of a run.
 *
 * Deliberately a summary, not the full series: full arrays produce a diff no
 * human reads, and a summary that moves tells you *which* part of the model
 * moved. Keep every field cheap to interpret.
 */
function summarise({ series: s, kpis: k }) {
  const last = s.dataMonthlyCashBalance.length - 1;
  const f = k.impact.financials, su = k.impact.sustainability;

  return {
    // Shape
    months: s.dataMonthlyCashBalance.length,
    startMEs: s.startMEs,
    startupCost: r2(s.startupCost),

    // Reach
    toilets: k.reach.toilets,
    loanToilets: k.reach.loanToilets,
    grantToilets: k.reach.grantToilets,
    mesEnd: k.reach.mes,
    creditingToiletsEnd: Math.round(s.dataMonthlyCreditingToilets[last]),
    dominantConstraint: k.reach.dominantConstraint,

    // Flows over the whole run
    totalLoansHh: r2(sum(s.dataMonthlyNewLoansHhVal)),
    totalLoansMe: r2(sum(s.dataMonthlyNewLoansMeVal)),
    totalGrants: r2(sum(s.dataMonthlyGrantDisbursed)),
    totalInterestHh: r2(sum(s.dataMonthlyRevenueHh)),
    totalInterestMe: r2(sum(s.dataMonthlyRevenueMe)),
    totalPrincipalHh: r2(sum(s.dataMonthlyRepaymentHh)),
    totalWriteOffsHh: r2(sum(s.dataMonthlyDefaultsHh)),
    totalWriteOffsMe: r2(sum(s.dataMonthlyDefaultsMe)),
    totalOpsFixed: r2(sum(s.dataMonthlyOps)),
    totalOpsVariable: r2(sum(s.dataMonthlyFees)),
    totalCarbonRevenue: r2(sum(s.dataMonthlyCarbonRevenue)),
    totalInvestorPrincipal: r2(sum(s.dataMonthlyFundPrincipal)),
    totalInvestorInterest: r2(sum(s.dataMonthlyFundInt)),

    // End state
    cashEnd: r2(f.cashEnd),
    minCash: r2(Math.min(...s.dataMonthlyCashBalance)),
    portfolioHhEnd: r2(s.dataMonthlyPortfolioHh[last]),
    portfolioMeEnd: r2(s.dataMonthlyPortfolioMe[last]),
    netAssets: r2(f.netAssets),
    investorRepaidPct: r2(f.investorRepaidPct),
    arrearsPrincipal: r2(s.accruedInvestorPrin),
    capitalisedInterest: r2(s.capitalisedInterest),
    investorLiabilityEnd: r2(s.investorLiabilityEnd),
    windUpMonth: s.windUpMonth,

    // Ratios
    oss: r2(su.oss),
    fss: r2(su.fss),
    monthsInsolvent: su.monthsInsolvent,
    depletionYear: su.depletionYear,
    costPerLatrine: r2(su.costPerLatrine),

    // Impact
    dalys: r2(k.impact.impact.dalys),
    carbonTonnes: r2(k.impact.impact.carbon),
    sroi: r2(k.impact.value.sroi),
    hourValueUsd: r2(k.impact.impact.hourValueUsd),
    capitalPreservation: r2(k.impact.value.capitalPreservation),
  };
}

module.exports = { SCENARIOS, summarise };
