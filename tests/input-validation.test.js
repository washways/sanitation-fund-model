/** Input-boundary regressions — F-46, ADR-0037. */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

describe('model input validation (F-46)', () => {
  test('the shipped Malawi inputs pass without warnings', () => {
    assert.deepStrictEqual([...ModelModule.validateInputs(BASE)], []);
  });

  test('invalid fields are reported together with field-specific messages', () => {
    const errors = ModelModule.validateInputs({
      ...BASE,
      avgHHSize: 0,
      avgToiletCost: -100,
      fundRepaymentTerm: -1,
      hhDefaultRate: 1.5,
      duration: -1,
      investorGracePeriod: 100,
    });

    assert.ok(errors.length >= 5, `expected at least five errors, got ${errors.join('; ')}`);
    assert.ok(errors.some(e => e.includes('Avg Household Size')));
    assert.ok(errors.some(e => e.includes('Avg Toilet Cost')));
    assert.ok(errors.some(e => e.includes('Fund Repayment Term')));
    assert.ok(errors.some(e => e.includes('HH Annual Write-down Rate')));
    assert.ok(errors.some(e => e.includes('Duration')));
    assert.ok(errors.some(e => e.includes('Investor Grace Period')));
  });

  test('calculate fails before simulation and exposes the complete validation result', () => {
    assert.throws(
      () => ModelModule.calculate({ ...BASE, inflationRate: -1.5, termHh: 0 }),
      e => e && e.code === 'INVALID_INPUTS'
        && Array.isArray(e.validationErrors)
        && e.validationErrors.some(x => x.includes('Annual Cost Escalation'))
        && e.validationErrors.some(x => x.includes('HH Loan Term'))
    );
  });

  test('zero remains valid where the parameter definition allows it', () => {
    const inputs = {
      ...BASE,
      investGrant: 0,
      investLoan: 0,
      fundRepaymentTerm: 0,
      grantSupportPct: 0,
      hhDefaultRate: 0,
      meDefaultRate: 0,
      meExitRate: 0,
      dalyPerPerson: 0,
      dalyValue: 0,
      co2PerToilet: 0,
    };
    assert.deepStrictEqual([...ModelModule.validateInputs(inputs)], []);
    assert.doesNotThrow(() => ModelModule.calculate(inputs));
  });

  test('an explicit zero enterprise capacity is honored, not replaced by the default (F-50, ADR-0041)', () => {
    const result = ModelModule.calculate({ ...BASE, mePerDistrict: 0, verify: true });

    assert.strictEqual(result.series.startMEs, 0);
    assert.ok(result.series.dataMonthlyMes.every(value => value === 0));
    assert.strictEqual(result.kpis.reach.toilets, 0);
    assert.strictEqual(result.viability.ok, false,
      'a no-delivery scenario must not inherit the default scenario\'s viable verdict');
  });

  test('valid partial-year horizons retain their final months in annual reporting (F-52, ADR-0043)', () => {
    for (const duration of [0.5, 1.5]) {
      const result = ModelModule.calculate({ ...BASE, duration, verify: true });
      const s = result.series;
      const expectedPeriods = Math.ceil(duration);
      const partialMonths = (duration * 12) % 12;

      assert.strictEqual(s.labels.length, expectedPeriods);
      assert.strictEqual(s.dataGrants.length, expectedPeriods);
      assert.match(s.labels[s.labels.length - 1], new RegExp(`\\(${partialMonths} months\\)$`));
      assert.strictEqual(s.dataToilets[s.dataToilets.length - 1], result.kpis.reach.toilets,
        'final period snapshot must include every simulated month');

      const finalStart = Math.floor(duration) * 12;
      const expectedFinalGrants = s.dataMonthlyGrantDisbursed
        .slice(finalStart)
        .reduce((sum, value) => sum + value, 0);
      assert.ok(Math.abs(s.dataGrants[s.dataGrants.length - 1] - expectedFinalGrants) < 0.01,
        'final partial-period grant flow must reconcile to its monthly values');
    }
  });
});

