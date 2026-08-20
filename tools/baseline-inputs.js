/**
 * baseline-inputs.js — the shipped defaults, as ModelModule receives them.
 *
 * These are the `value=""` attributes in index.html, normalised the way
 * UI.getInputs() normalises them: every rate is entered as a PERCENTAGE in the form
 * and divided by 100 exactly once at the input boundary (R-2.3), so the values here
 * are decimals. Also includes the carbon overrides the DOMContentLoaded handler applies.
 *
 * Two deliberate deviations from a real browser session, both documented:
 *
 *   fundCostOfCapital      — 2% concessional (decided 2026-08-20, ADR-0004). Seeded
 *                            from FR.INR.LEND on country fetch.
 *   loanInterestRate: 0.35 — index.html ships 0.35, but UI.updateSmartRates()
 *                            overwrites the field about one second after load
 *                            (finding F-05), so a real session runs at roughly
 *                            0.2332. We use the *declared* default here because
 *                            the override is itself a finding, not intent.
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
  popReqToilets: 27280461,
  popGrowthRate: 0.03,
  avgHHSize: 5,
  avgToiletCost: 100,
  inflationRate: 0.0332,

  // Delivery network
  districts: 50,
  mePerDistrict: 20,
  toiletsPerMeMonth: 7,
  meSetupCost: 2000,

  // Lending
  grantSupportPct: 0.10,
  loanInterestRate: 0.40,
  meLoanInterestRate: 0.10,
  hhDefaultRate: 0.05,
  meDefaultRate: 0.05,
  meExitRate: 0.10,        // annual business closure — distinct from write-down (R-6.3)
  termHh: 18,
  termMe: 12,

  // Costs
  annualFixedOpsCost: 60000,
  mgmtFeeRatio: 0.01,
  meCostRate: 0.02,
  contingencyRate: 0.05,
  opsReserveCap: 0.15,   // 15% — now converted at the boundary like every other rate

  // Impact
  dalyPerPerson: 0.005,
  dalyValue: 500,
  avgAnnualIncome: 1020,
  co2PerToilet: 0.0,
  co2Value: 15,
  carbonCreditShare: 0.5,

  // Impact assumption, now a named input rather than a constant buried in the loop.
  hoursPerPersonPerDay: 0.25,
  timeValueFactor: 0.30,   // saved time valued at 30% of the market wage (R-8.6)
  toiletLifespanYears: 5,  // carbon crediting stops after this (R-8.5)

  // Flags. These are now independent: `verify` controls the integrity/viability
  // checks, `enableBreakEvenSolver` controls the solvers. One flag used to control
  // both, so disabling the solver silently disabled every guard (F-11, fixed).
  enableBreakEvenSolver: false,
  verify: false,
};
