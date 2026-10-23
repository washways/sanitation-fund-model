/**
 * repayment-window.test.js — V2 fails only on senior principal that was due and
 * unpaid within the simulated horizon (F-67, Q16, ADR-0058).
 *
 * Principal scheduled after the horizon is "not yet due", not a default. A run whose
 * debt term outlasts the horizon used to report "52.6% default" on debt nobody had
 * missed. These tests fail if V2 goes back to comparing repaid principal with the
 * whole loan regardless of schedule.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const run = overrides => {
  const inputs = { ...BASE, ...overrides, verify: false };
  const result = ModelModule.calculate(inputs);
  return { inputs, ...result, viability: ModelModule.checkViability(result.series, inputs, result.kpis) };
};

describe('senior repayment is judged against what was due (F-67, ADR-0058)', () => {
  test('principal scheduled after the horizon is reported as not yet due, not as default', () => {
    const r = run({ duration: 5, fundRepaymentTerm: 10 });
    const f = r.kpis.financials;
    assert.ok(f.investorRepaidPct < 0.9, 'control: most of a 10-year loan is still outstanding at 5 years');
    assert.ok(f.seniorPrincipalPastDue <= 1000, 'nothing should be past due in this scenario');
    assert.ok(f.seniorPrincipalNotYetDue > 1000000);
    assert.ok(!r.viability.issues.some(i => i.code === 'DEBT_UNREPAID'),
      'principal that is not yet due must not be reported as a default');
  });

  test('past-due and not-yet-due principal reconcile to the unrepaid loan', () => {
    for (const o of [{}, { duration: 5, fundRepaymentTerm: 10 }, { annualFixedOpsCost: 900000 }, { duration: 20 }]) {
      const { inputs, kpis } = run(o);
      const f = kpis.financials;
      const unrepaid = inputs.investLoan - f.investorRepaid;
      assert.ok(Math.abs(f.seniorPrincipalPastDue + f.seniorPrincipalNotYetDue - unrepaid) < 1,
        `${JSON.stringify(o)}: ${f.seniorPrincipalPastDue} + ${f.seniorPrincipalNotYetDue} != ${unrepaid}`);
    }
  });

  test('a fund that misses scheduled principal still fails V2', () => {
    const r = run({ annualFixedOpsCost: 900000 });
    assert.ok(r.kpis.financials.seniorPrincipalPastDue > 1000);
    assert.ok(r.viability.issues.some(i => i.code === 'DEBT_UNREPAID'));
  });

  test('a fund that winds up owes all remaining principal immediately', () => {
    const r = run({ popReqToilets: 0, annualFixedOpsCost: 900000, duration: 10, fundRepaymentTerm: 10 });
    assert.notStrictEqual(r.series.windUpMonth, null, 'control: this scenario must wind up');
    assert.ok(r.kpis.financials.seniorPrincipalNotYetDue < 1,
      'wind-up accelerates the debt, so nothing can remain "not yet due"');
    assert.ok(r.kpis.financials.seniorPrincipalPastDue > 1000);
    assert.ok(r.viability.issues.some(i => i.code === 'DEBT_UNREPAID'));
  });
});
