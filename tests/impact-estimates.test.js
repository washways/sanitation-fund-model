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

describe('transparent impact estimates (F-56, ADR-0049)', () => {
  test('jobs supported use one explicit assumption in the KPI and annual chart', () => {
    assert.strictEqual(BASE.jobsPerMe, 3,
      'three jobs per ME must be an explicit editable assumption, not a hidden multiplier');
    const result = run({});
    const finalMes = result.kpis.reach.mes;

    assert.strictEqual(result.kpis.reach.jobs, finalMes * BASE.jobsPerMe);
    assert.strictEqual(result.kpis.reach.jobs, 801);
    assert.strictEqual(result.series.dataJobs.length, result.series.labels.length);
    assert.strictEqual(result.series.dataJobs.at(-1), result.kpis.reach.jobs,
      'the jobs chart and headline must end on the same canonical value');
  });

  test('zero jobs per enterprise is a genuine zero scenario', () => {
    const result = run({ jobsPerMe: 0 });
    assert.strictEqual(result.kpis.reach.jobs, 0);
    assert.ok(result.series.dataJobs.every(value => value === 0));
  });

  test('DALYs apply an explicit sanitation-effect realisation factor', () => {
    assert.strictEqual(BASE.dalyImpactRealisation, 0.21,
      'the basic non-sewered sanitation effect must be visible, not a hidden 100% assumption');
    const fullCounterfactual = run({ dalyPerPerson: 1, dalyImpactRealisation: 1 });
    const referenceEffect = run({ dalyPerPerson: 1 });
    assert.ok(Math.abs(
      referenceEffect.kpis.impact.dalys / fullCounterfactual.kpis.impact.dalys - 0.21
    ) < 1e-12, 'the reported averted burden must scale by the explicit realisation factor');

    const zeroEffect = run({ dalyPerPerson: 1, dalyImpactRealisation: 0 });
    assert.strictEqual(zeroEffect.kpis.impact.dalys, 0,
      'zero health-effect realisation must produce zero averted DALYs');
  });

  test('gross social value multiple has a canonical field and an identical legacy alias', () => {
    const result = run({});
    const expected = result.kpis.value.socialValue / (BASE.investGrant + BASE.investLoan);

    assert.ok(Math.abs(result.kpis.value.grossSocialValueMultiple - expected) < 1e-12);
    assert.strictEqual(result.kpis.value.sroi, result.kpis.value.grossSocialValueMultiple,
      'legacy sroi machine key must remain an exact compatibility alias');
  });
});
