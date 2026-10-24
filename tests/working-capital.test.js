/**
 * working-capital.test.js — the enterprise working-capital floor is an input
 * (Q18, F-70, ADR-0061).
 *
 * meCapitalRequirement = meSetupCost + toiletsPerMeMonth * avgToiletCost
 *                        * max(meWorkingCapitalMonths, termHh)
 *
 * The 6 used to be a hard-coded literal with no source. It multiplies every
 * enterprise loan and the affordable-network cap, so it is now a visible,
 * validated input whose default reproduces the previous behaviour exactly.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const run = overrides => ModelModule.calculate({ ...BASE, ...overrides, verify: false });

describe('enterprise working-capital months are an input (Q18, ADR-0061)', () => {
  test('the default is 6 months, the value previously hard-coded', () => {
    assert.strictEqual(BASE.meWorkingCapitalMonths, 6);
  });

  test('the requirement uses the input when it exceeds the household term', () => {
    const inputs = { ...BASE, termHh: 3, meWorkingCapitalMonths: 9 };
    const expected = BASE.meSetupCost + BASE.toiletsPerMeMonth * BASE.avgToiletCost * 9;
    assert.strictEqual(ModelModule.meCapitalRequirement(inputs), expected);
  });

  test('the household term still sets the floor when it is longer', () => {
    const inputs = { ...BASE, termHh: 12, meWorkingCapitalMonths: 6 };
    const expected = BASE.meSetupCost + BASE.toiletsPerMeMonth * BASE.avgToiletCost * 12;
    assert.strictEqual(ModelModule.meCapitalRequirement(inputs), expected);
  });

  test('the startup cohort is lent the requirement the input implies', () => {
    for (const months of [3, 9]) {
      const inputs = { ...BASE, termHh: 3, meWorkingCapitalMonths: months };
      const { series: s } = run(inputs);
      assert.ok(s.startMEs > 0, 'control: a startup cohort is launched');
      assert.strictEqual(s.startupCost, s.startMEs * ModelModule.meCapitalRequirement(inputs),
        `startup lending at ${months} months must be startMEs x the requirement`);
    }
  });

  test('a missing or negative value is rejected by validation', () => {
    const missing = { ...BASE };
    delete missing.meWorkingCapitalMonths;
    assert.ok(ModelModule.validateInputs(missing).some(e => /Working-Capital Months/.test(e)));
    assert.ok(ModelModule.validateInputs({ ...BASE, meWorkingCapitalMonths: -1 })
      .some(e => /Working-Capital Months/.test(e)));
  });
});
