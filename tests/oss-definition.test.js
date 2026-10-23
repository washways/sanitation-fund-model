/**
 * oss-definition.test.js — operating self-sufficiency counts only income the
 * operations can actually use (F-69, Q17, ADR-0059).
 *
 * Operations are paid from the loan ledger (R-5.3). Carbon revenue accrues to the
 * ring-fenced grant ledger (R-8.1) and can never pay them, so it is not operating
 * revenue. A run with no operating cost has no OSS: the ratio is undefined, not 0%.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const sum = a => a.reduce((x, y) => x + y, 0);
const run = overrides => {
  const inputs = { ...BASE, ...overrides, verify: false };
  const result = ModelModule.calculate(inputs);
  return { inputs, ...result, viability: ModelModule.checkViability(result.series, inputs, result.kpis) };
};

describe('OSS uses loan-ledger operating income (F-69, ADR-0059)', () => {
  test('OSS is loan interest divided by fixed plus variable operating cost', () => {
    const { series: s, kpis } = run({ co2PerToilet: 250, co2Value: 20 });
    assert.ok(sum(s.dataMonthlyCarbonRevenue) > 0, 'control: carbon revenue is present');
    const expected = (sum(s.dataMonthlyRevenueHh) + sum(s.dataMonthlyRevenueMe))
      / (sum(s.dataMonthlyOps) + sum(s.dataMonthlyFees));
    assert.ok(Math.abs(kpis.sustainability.oss - expected) < 1e-12,
      `OSS ${kpis.sustainability.oss} should exclude grant-ledger carbon revenue (${expected})`);
  });

  test('carbon revenue cannot lift OSS above what loan interest supports', () => {
    // Carbon still changes OSS indirectly: it tops up the grant ledger, which shifts the
    // grant/loan production mix and so loan interest. It must not count as revenue.
    const oss = run({ co2PerToilet: 250, co2Value: 20 }).kpis.sustainability.oss;
    assert.ok(oss < 5, `OSS ${oss} looks like it still includes carbon revenue (was 565x)`);
  });

  test('OSS is null, and V4 is not applied, when there is no operating cost', () => {
    const r = run({ annualFixedOpsCost: 0, mgmtFeeRatio: 0, meCostRate: 0, contingencyRate: 0 });
    assert.strictEqual(r.kpis.sustainability.oss, null);
    assert.ok(!r.viability.issues.some(i => i.code === 'OSS_BELOW_1'),
      'an undefined ratio must not be reported as 0% self-sufficiency');
  });

  test('V4 still fails when interest does not cover operating cost', () => {
    const r = run({ annualFixedOpsCost: 900000 });
    assert.ok(r.kpis.sustainability.oss < 1);
    assert.ok(r.viability.issues.some(i => i.code === 'OSS_BELOW_1'));
  });
});
