/**
 * baseline-inputs.js — the shipped defaults, as ModelModule receives them.
 *
 * These are the `value=""` attributes in index.html, normalised the way
 * UI.getInputs() normalises them: every rate is entered as a PERCENTAGE in the form
 * and divided by 100 exactly once at the input boundary (R-2.3), so the values here
 * are decimals.
 *
 * Country loading changes observations only (ADR-0034); negotiated terms, programme
 * assumptions, and policy choices below are never overwritten by API data. The 2%
 * cost of capital is an illustrative concessional term, not the commercial benchmark.
 *
 * Keep this file in sync with index.html. tests/ compares the two.
 */
module.exports = {
  country: 'Malawi',

  // Capital
  investGrant: 1000000,
  investLoan: 4000000,
  duration: 5,
  fundRepaymentTerm: 5,
  investorGracePeriod: 6,
  fundCostOfCapital: 0.02,

  // Market
  popReqToilets: 9244139,
  popGrowthRate: 0.0256,
  avgHHSize: 4.4,
  avgToiletCost: 100,
  inflationRate: 0.0332,

  // Delivery network
  districts: 28,
  mePerDistrict: 20,
  jobsPerMe: 3,
  toiletsPerMeMonth: 7,
  meSetupCost: 3000,

  // Lending
  grantSupportPct: 0.10,
  loanInterestRate: 0.40,
  meLoanInterestRate: 0.10,
  hhDefaultRate: 0.05,
  meDefaultRate: 0.05,
  meExitRate: 0.10,        // annual business closure — distinct from write-down (R-6.3)
  meExpansionBudgetShare: 0.10,  // in-loop ME expansion pacing (R-6.2, ADR-0019)
  meMaxMonthlyGrowthRate: 0.10,  // ceiling on ME-network growth per month (R-6.2, ADR-0019)
  termHh: 12,
  termMe: 12,

  // Costs
  annualFixedOpsCost: 60000,
  mgmtFeeRatio: 0.01,
  meCostRate: 0.02,
  contingencyRate: 0.05,
  initialMeNetworkShare: 0.15, // explicit month-0 pilot share of the target ME network (ADR-0047)

  // Impact
  dalyPerPerson: 0,
  dalyImpactRealisation: 0.21, // basic non-sewered sanitation RR 0.79 (Wolf et al. 2022; ADR-0049)
  dalyValue: 0,
  avgAnnualIncome: 600,
  co2PerToilet: 0.0,
  co2Value: 15,
  carbonCreditShare: 0.5,

  // Impact assumption, now a named input rather than a constant buried in the loop.
  hoursPerPersonPerDay: 0.25,
  timeValueFactor: 0.50,   // Malawi appraisal/WHO convention (ADR-0034)
  toiletLifespanYears: 5,  // carbon crediting stops after this (R-8.5)

  // Flags. These are now independent: `verify` controls the integrity/viability
  // checks, `enableBreakEvenSolver` controls the solvers. One flag used to control
  // both, so disabling the solver silently disabled every guard (F-11, fixed).
  enableBreakEvenSolver: false,
  verify: false,
};
