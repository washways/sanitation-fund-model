/**
 * constraint-reporting.test.js — R-7.6 / Q14 / ADR-0044.
 *
 * Constraint explanations must be derived from the same quantities that determine
 * actual production. They are decision-support output, not a cash-balance heuristic.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const run = overrides => ModelModule.calculate({ ...BASE, ...overrides });

describe('actual production constraints (R-7.6, ADR-0044)', () => {
  test('monthly additive losses reconcile demand to actual production', () => {
    const { series: s } = run({});
    assert.strictEqual(s.dataConstraintForegone.length, s.dataMonthlyBacklog.length);

    let previousToilets = 0;
    for (let month = 0; month < s.dataMonthlyBacklog.length; month++) {
      const cumulativeToilets = s.dataToiletsMonthlyLoan[month] + s.dataToiletsMonthlyGrant[month];
      const production = cumulativeToilets - previousToilets;
      const demandBeforeProduction = Math.floor(s.dataMonthlyBacklog[month] + production);
      const loss = s.dataConstraintForegone[month];

      assert.strictEqual(
        loss.capacity + loss.loanCapital,
        demandBeforeProduction - production,
        `month ${month + 1}: constraint losses must reconcile demand to production`
      );
      assert.ok(loss.grantCapital >= 0 && loss.grantCapital <= loss.loanCapital,
        `month ${month + 1}: grant recovery is an overlapping subset of capital loss`);
      previousToilets = cumulativeToilets;
    }
  });

  test('the Malawi headline ranks actual foregone output and exposes secondary causes', () => {
    const result = run({});
    const analysis = result.kpis.reach.constraintAnalysis;

    assert.strictEqual(analysis.primary, 'capacity');
    assert.ok(analysis.foregone.capacity > analysis.foregone.loanCapital);
    assert.ok(analysis.foregone.loanCapital > 0);
    assert.ok(analysis.foregone.grantCapital > 0);
    assert.deepStrictEqual(Array.from(analysis.secondary), ['loanCapital', 'grantCapital']);
    assert.match(result.kpis.reach.dominantConstraint, /ME Capacity/);
    assert.match(result.kpis.reach.dominantConstraint, /secondary: Loan Capital, Grant Capital/);
    assert.ok(result.series.dataConstraintBinding.some(label => label.startsWith('Mixed:')),
      'months constrained by both capacity and capital must be reported as mixed');
  });

  test('a satisfied demand target is reported as success, with no invented bottleneck', () => {
    const result = run({ popReqToilets: 5000 });
    assert.strictEqual(result.kpis.reach.dominantConstraint, 'Demand Met (Success)');
    assert.strictEqual(result.kpis.reach.constraintAnalysis.primary, 'demand');
    assert.deepStrictEqual(Array.from(result.kpis.reach.constraintAnalysis.secondary), []);
    assert.deepStrictEqual({ ...result.kpis.reach.constraintAnalysis.foregone }, {
      capacity: 0,
      loanCapital: 0,
      grantCapital: 0,
    });
  });
});
