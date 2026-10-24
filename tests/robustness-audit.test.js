const { test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');
const {
  deriveCountryInputs,
  auditCountryScenario,
} = require('../tools/country-runtime-audit');

test('country audit derives the same model inputs as the browser contract', () => {
  const derived = deriveCountryInputs({
    ruralPopulation: { value: 1000000, year: '2025' },
    basicRuralSanitation: { value: 40, year: '2024' },
    populationGrowth: { value: 2.5, year: '2025' },
    gniPerCapita: null,
    gdpPerCapita: { value: 700, year: '2025' },
    householdSize: { value: 5.2, year: 2023 },
    adminUnits: { value: 45, year: '2019' },
  });

  assert.deepStrictEqual(derived, {
    inputs: {
      popReqToilets: 600000,
      popGrowthRate: 0.025,
      avgAnnualIncome: 700,
      avgHHSize: 5.2,
      districts: 45,
    },
    missing: [],
  });
});

test('country audit runs the model and refuses an incomplete observation set', () => {
  const complete = auditCountryScenario({
    ruralPopulation: { value: 9244139, year: '2024' },
    basicRuralSanitation: { value: 0, year: '2024' },
    populationGrowth: { value: 2.56, year: '2024' },
    gniPerCapita: { value: 600, year: '2024' },
    gdpPerCapita: { value: 650, year: '2024' },
    householdSize: { value: 4.3, year: 2024 },
    adminUnits: { value: 28, year: '2020' },
  });
  assert.strictEqual(complete.runnable, true);
  assert.strictEqual(complete.integrity.ok, true);
  assert.strictEqual(complete.inputs.avgAnnualIncome, 600, 'GNI must take precedence over GDP');

  const incomplete = auditCountryScenario({
    ruralPopulation: { value: 1000000, year: '2025' },
    basicRuralSanitation: null,
    populationGrowth: { value: 2.5, year: '2025' },
    gniPerCapita: { value: 700, year: '2025' },
    gdpPerCapita: { value: 650, year: '2025' },
    householdSize: null,
    adminUnits: { value: 28, year: '2020' },
  });
  assert.strictEqual(incomplete.runnable, false);
  assert.deepStrictEqual(incomplete.missing, ['basic sanitation', 'rural household size']);
  assert.strictEqual(incomplete.integrity, null);
});

test('384 deterministic valid parameter combinations preserve every ledger invariant', () => {
  let seed = 19091;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pick = values => values[Math.floor(random() * values.length)];
  const failures = [];

  for (let n = 0; n < 384; n++) {
    const inputs = {
      ...BASE,
      verify: false,
      enableBreakEvenSolver: false,
      investGrant: pick([0, 100000, 1000000, 5000000]),
      investLoan: pick([0, 500000, 4000000, 10000000]),
      duration: pick([1 / 12, 0.5, 1, 5, 10, 20]),
      fundRepaymentTerm: pick([1, 5, 10, 20]),
      investorGracePeriod: 0,
      popReqToilets: pick([0, 1000, 100000, 10000000]),
      popGrowthRate: pick([-0.03, 0, 0.025, 0.06]),
      avgHHSize: pick([2, 4.4, 8]),
      avgToiletCost: pick([25, 100, 500]),
      inflationRate: pick([-0.05, 0, 0.1, 0.4]),
      districts: pick([1, 10, 28, 100]),
      mePerDistrict: pick([0, 2, 20, 100]),
      jobsPerMe: pick([0, 1, 3, 10]),
      toiletsPerMeMonth: pick([0, 1, 7, 50]),
      meSetupCost: pick([0, 1000, 3000, 10000]),
      grantSupportPct: pick([0, 0.1, 0.5, 1]),
      loanInterestRate: pick([0, 0.1, 0.4, 1]),
      meLoanInterestRate: pick([0, 0.1, 0.4, 1]),
      hhDefaultRate: pick([0, 0.05, 0.2, 1]),
      meDefaultRate: pick([0, 0.05, 0.2, 1]),
      meExitRate: pick([0, 0.1, 0.5, 1]),
      annualFixedOpsCost: pick([0, 60000, 500000]),
      mgmtFeeRatio: pick([0, 0.01, 0.1]),
      meCostRate: pick([0, 0.02, 0.1]),
      contingencyRate: pick([0, 0.05, 0.5]),
      initialMeNetworkShare: pick([0, 0.15, 1]),
      meExpansionBudgetShare: pick([0, 0.1, 1]),
      meMaxMonthlyGrowthRate: pick([0, 0.1, 1]),
      termHh: pick([1, 12, 60]),
      termMe: pick([1, 12, 60]),
      dalyPerPerson: pick([0, 0.005, 0.03]),
      dalyImpactRealisation: pick([0, 0.21, 1]),
      dalyValue: pick([0, 100, 1000]),
      co2PerToilet: pick([0, 0.05, 1]),
      co2Value: pick([0, 15, 100]),
      hoursPerPersonPerDay: pick([0, 0.25, 2]),
      timeValueFactor: pick([0, 0.5, 1]),
      toiletLifespanYears: pick([1, 5, 20]),
    };
    inputs.investorGracePeriod = pick([0, 6, Math.min(24, inputs.fundRepaymentTerm * 12)]);
    if (inputs.investLoan === 0) inputs.fundRepaymentTerm = pick([0, 1, 5]);

    try {
      const result = ModelModule.calculate(inputs);
      const integrity = ModelModule.checkIntegrity(result.series, inputs, result.kpis);
      if (!integrity.ok) failures.push(`case ${n}: ${integrity.violations.join('; ')}`);
    } catch (error) {
      failures.push(`case ${n}: ${error.message}`);
    }
  }

  assert.deepStrictEqual(failures, []);
});
