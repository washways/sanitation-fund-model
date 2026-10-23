/**
 * whole-enterprises.test.js — enterprises are launched in whole units (F-68, R-2.5,
 * ADR-0060).
 *
 * Attrition makes the active count continuous (R-6.3). The headroom under the network
 * cap must be floored, or a network at its cap relaunches a fraction of an enterprise
 * every month and books a proportionally small loan for it.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

test('every monthly enterprise launch is a whole number (F-68)', () => {
  const scenarios = [
    { districts: 2, mePerDistrict: 2 },
    { districts: 3, mePerDistrict: 5, duration: 10 },
    { duration: 20 },
  ];
  for (const o of scenarios) {
    const { series: s } = ModelModule.calculate({ ...BASE, ...o, verify: false });
    const fractional = s.dataMonthlyNewMes
      .map((n, i) => [i + 1, n])
      .filter(([, n]) => !Number.isInteger(n));
    // Length, not deepStrictEqual: series arrays come from the model's VM realm.
    assert.strictEqual(fractional.length, 0,
      `${JSON.stringify(o)}: ${fractional.length} fractional launches, first ${JSON.stringify(fractional.slice(0, 3))}`);
    const perMe = ModelModule.meCapitalRequirement({ ...BASE, ...o });
    s.dataMonthlyNewLoansMeVal.forEach((v, i) => {
      assert.ok(Math.abs(v - s.dataMonthlyNewMes[i] * perMe) < 1e-6,
        `M${i + 1}: ME loan value must be a whole number of enterprise loans`);
    });
  }
});
