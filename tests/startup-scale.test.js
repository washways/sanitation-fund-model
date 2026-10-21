const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const run = overrides => ModelModule.calculate({
  ...BASE,
  ...overrides,
  enableBreakEvenSolver: false,
  verify: true,
});

describe('gradual enterprise rollout (F-54, ADR-0047)', () => {
  test('the Malawi default starts 15% of the target network, not the cash-maximising cohort', () => {
    assert.strictEqual(BASE.initialMeNetworkShare, 0.15,
      'the pilot-network share must be an explicit documented input');
    const result = run({});
    const targetNetwork = BASE.districts * BASE.mePerDistrict;
    const expectedPilot = Math.ceil(targetNetwork * BASE.initialMeNetworkShare);

    assert.strictEqual(result.series.startMEs, expectedPilot);
    assert.strictEqual(result.series.startMEs, 84);
    assert.ok(result.series.dataMonthlyRevenueMe[0] < 10000,
      `month-one ME interest $${result.series.dataMonthlyRevenueMe[0].toFixed(0)} still implies instant scale`);
    assert.ok(result.series.dataMonthlyMes[11] > result.series.startMEs,
      'the network should grow after the pilot rather than appearing at full scale in month zero');
    assert.strictEqual(result.viability.ok, true, 'the conservative startup must preserve baseline viability');
    assert.ok(result.kpis.financials.investorRepaidPct >= 0.999999,
      'the baseline must still repay senior principal in full');
    assert.ok(result.kpis.sustainability.fss > 1.05,
      `FSS ${result.kpis.sustainability.fss.toFixed(3)} leaves too little operating margin`);
  });

  test('available loan capital still caps the pilot cohort', () => {
    const result = run({ investLoan: 100000, investGrant: 0, fundRepaymentTerm: 5 });
    const affordable = Math.floor(100000 / ModelModule.meCapitalRequirement(BASE));
    assert.strictEqual(result.series.startMEs, affordable,
      'a rollout target must not lend capital the fund does not have');
  });

  test('an explicit zero pilot share launches no hidden seed cohort', () => {
    const result = run({ initialMeNetworkShare: 0 });
    assert.strictEqual(result.series.startMEs, 0);
    assert.ok(result.series.dataMonthlyMes.every(value => value === 0));
    assert.strictEqual(result.kpis.reach.toilets, 0);
  });
});
