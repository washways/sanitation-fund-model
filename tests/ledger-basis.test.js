/**
 * ledger-basis.test.js — solvency is judged on the ledger that pays the bills
 * (F-66, Q15, ADR-0057).
 *
 * The grant and loan ledgers never transfer (R-5.2, ADR-0022). The loan ledger pays
 * debt service and operations; grant cash cannot. A verdict that tests the pooled sum
 * lets a large grant hide an overdrawn loan ledger. These tests fail if V1,
 * depletionMonth, monthsInsolvent or opsRunway go back to the pooled balance.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const run = overrides => {
  const inputs = { ...BASE, ...overrides, verify: false };
  const result = ModelModule.calculate(inputs);
  return {
    inputs,
    ...result,
    viability: ModelModule.checkViability(result.series, inputs, result.kpis),
  };
};

describe('solvency verdicts use the loan ledger (F-66, ADR-0057)', () => {
  test('the engine exposes a loan-ledger cash series that reconciles to pooled cash', () => {
    const { series: s } = run({});
    assert.strictEqual(s.dataMonthlyLoanCash.length, s.dataMonthlyCashBalance.length);
    for (let i = 0; i < s.dataMonthlyLoanCash.length; i++) {
      const pooled = s.dataMonthlyLoanCash[i] + s.dataMonthlyGrantCash[i];
      assert.ok(Math.abs(pooled - s.dataMonthlyCashBalance[i]) < 1e-6,
        `loan + grant cash must equal pooled cash at M${i + 1}`);
    }
  });

  test('a large grant no longer hides an overdrawn loan ledger', () => {
    const r = run({ investGrant: 5000000, investLoan: 500000 });
    const s = r.series;
    assert.ok(Math.min(...s.dataMonthlyCashBalance) > 0,
      'control: pooled cash stays positive in this scenario');
    assert.ok(Math.min(...s.dataMonthlyLoanCash) < 0,
      'control: the loan ledger is overdrawn in this scenario');

    assert.ok(r.viability.issues.some(i => i.code === 'INSOLVENT'),
      'V1 must report the overdrawn loan ledger');
    assert.notStrictEqual(r.kpis.sustainability.depletionMonth, null);
    assert.ok(r.kpis.sustainability.monthsInsolvent > 0);
    assert.ok(r.kpis.sustainability.minLoanCash < 0);
    assert.ok(r.kpis.sustainability.opsRunway < 20,
      'ring-fenced grant cash must not be counted as operating runway');
  });

  test('a fund with no loan capital cannot pay operations from its grant', () => {
    const r = run({ investLoan: 0, fundRepaymentTerm: 0 });
    assert.strictEqual(r.kpis.sustainability.depletionMonth, 1);
    assert.ok(r.viability.issues.some(i => i.code === 'INSOLVENT'));
  });

  test('opsRunway divides loan-ledger cash, not pooled cash, by fixed operating cost', () => {
    const r = run({ co2PerToilet: 250, co2Value: 20 });
    const s = r.series;
    const expected = s.dataMonthlyLoanCash[s.dataMonthlyLoanCash.length - 1] / r.inputs.annualFixedOpsCost;
    assert.ok(Math.abs(r.kpis.sustainability.opsRunway - expected) < 1e-9);
  });

  test('the Malawi baseline verdict is unchanged', () => {
    const r = run({});
    assert.strictEqual(r.kpis.sustainability.depletionMonth, null);
    assert.ok(!r.viability.issues.some(i => i.code === 'INSOLVENT'));
  });
});
