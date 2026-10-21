/**
 * sensitivity.test.js — evidence-bounded one-at-a-time analysis (ADR-0045).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const validSpec = () => ({
  metric: 'netAssets',
  parameters: [
    {
      id: 'annualFixedOpsCost',
      low: 50000,
      high: 70000,
      source: 'Synthetic test fixture: explicit operating-cost cases',
    },
    {
      id: 'loanInterestRate',
      low: 0.35,
      high: 0.45,
      source: 'Synthetic test fixture: explicit household-rate cases',
    },
  ],
});

describe('evidence-bounded sensitivity (ADR-0045)', () => {
  test('returns deterministic, ranked low/base/high results without mutating inputs', () => {
    const inputs = { ...BASE };
    const spec = validSpec();
    const inputsBefore = JSON.stringify(inputs);
    const specBefore = JSON.stringify(spec);

    const first = ModelModule.runSensitivity(inputs, spec);
    const second = ModelModule.runSensitivity(inputs, spec);

    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.metric, 'netAssets');
    assert.strictEqual(first.results.length, 2);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
    assert.strictEqual(JSON.stringify(inputs), inputsBefore);
    assert.strictEqual(JSON.stringify(spec), specBefore);

    for (const item of first.results) {
      assert.ok(item.swing >= 0);
      assert.strictEqual(item.base.value, inputs[item.parameter]);
      assert.strictEqual(item.base.metrics.netAssets, first.baseline.netAssets);
      assert.ok(typeof item.low.metrics.viable === 'boolean');
      assert.ok(typeof item.high.metrics.toilets === 'number');
      assert.ok(item.source.startsWith('Synthetic test fixture:'));
    }
    assert.ok(first.results[0].swing >= first.results[1].swing,
      'results must be ranked by the selected outcome swing');
  });

  test('matches direct model runs at each supplied bound', () => {
    const spec = validSpec();
    const result = ModelModule.runSensitivity(BASE, spec);
    const ops = result.results.find(item => item.parameter === 'annualFixedOpsCost');
    const directLow = ModelModule.calculate({ ...BASE, annualFixedOpsCost: 50000, verify: false });
    const directHigh = ModelModule.calculate({ ...BASE, annualFixedOpsCost: 70000, verify: false });

    assert.strictEqual(ops.low.metrics.netAssets, directLow.kpis.financials.netAssets);
    assert.strictEqual(ops.high.metrics.netAssets, directHigh.kpis.financials.netAssets);
    assert.strictEqual(ops.low.metrics.toilets, directLow.kpis.reach.toilets);
    assert.strictEqual(ops.high.metrics.toilets, directHigh.kpis.reach.toilets);
  });

  test('refuses undocumented, unknown, duplicate, unbracketed, invalid, and excess ranges', () => {
    const cases = [
      { parameters: [{ id: 'annualFixedOpsCost', low: 50000, high: 70000, source: '' }] },
      { parameters: [{ id: 'notAParameter', low: 1, high: 2, source: 'test' }] },
      { parameters: [
        { id: 'annualFixedOpsCost', low: 50000, high: 70000, source: 'test' },
        { id: 'annualFixedOpsCost', low: 40000, high: 80000, source: 'test' },
      ] },
      { parameters: [{ id: 'annualFixedOpsCost', low: 61000, high: 70000, source: 'test' }] },
      { parameters: [{ id: 'grantSupportPct', low: -0.1, high: 0.2, source: 'test' }] },
      { parameters: Array.from({ length: 9 }, (_, index) => ({
        id: ['investGrant', 'investLoan', 'annualFixedOpsCost', 'avgToiletCost', 'termHh',
          'termMe', 'loanInterestRate', 'hhDefaultRate', 'toiletsPerMeMonth'][index],
        low: index === 4 || index === 5 ? 6 : 0,
        high: index === 4 || index === 5 ? 24 : BASE[['investGrant', 'investLoan',
          'annualFixedOpsCost', 'avgToiletCost', 'termHh', 'termMe', 'loanInterestRate',
          'hhDefaultRate', 'toiletsPerMeMonth'][index]] * 2 + 1,
        source: 'test',
      })) },
    ];

    for (const spec of cases) {
      const result = ModelModule.runSensitivity(BASE, { metric: 'netAssets', ...spec });
      assert.strictEqual(result.ok, false);
      assert.ok(result.errors.length > 0);
      assert.deepStrictEqual(Array.from(result.results), []);
    }
  });

  test('rejects unsupported ranking metrics instead of silently substituting one', () => {
    const result = ModelModule.runSensitivity(BASE, { ...validSpec(), metric: 'irr' });
    assert.strictEqual(result.ok, false);
    assert.ok(Array.from(result.errors).some(error => error.includes('Unsupported sensitivity metric')));
  });
});
