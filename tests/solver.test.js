/**
 * solver.test.js — solveBreakEven / solveMaxGrant (F-27, ADR-0032).
 *
 * The old solvers binary-searched assuming netAssets is monotone in the swept
 * parameter. It is not, in scenarios ranging from mildly capital-tight to the
 * shipped baseline's grant-support sweep (see ADR-0032's measured sweep). Blind
 * bisection there could converge on a value that was not the answer, and
 * solveMaxGrant returned a bare 0 for "no answer exists" — indistinguishable
 * from a genuine answer of zero.
 *
 * These tests pin the typed result and the failure-is-not-zero distinction.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

describe('solveBreakEven / solveMaxGrant (F-27, ADR-0032)', () => {
  test('both solvers return a typed { ok, value, reason } result', () => {
    const be = ModelModule.solveBreakEven({ ...BASE });
    const mg = ModelModule.solveMaxGrant({ ...BASE });
    for (const r of [be, mg]) {
      assert.strictEqual(typeof r.ok, 'boolean');
      assert.ok(r.value === null || typeof r.value === 'number');
      assert.ok(r.reason === null || typeof r.reason === 'string');
    }
  });

  test('the shipped baseline finds a feasible break-even rate and max grant', () => {
    const be = ModelModule.solveBreakEven({ ...BASE });
    const mg = ModelModule.solveMaxGrant({ ...BASE });
    assert.strictEqual(be.ok, true);
    assert.ok(be.value > 0 && be.value < 1.5, `break-even rate ${be.value} out of range`);
    assert.strictEqual(mg.ok, true);
    assert.ok(mg.value >= 0 && mg.value <= 1.0, `max grant ${mg.value} out of range`);
  });

  test('an impossible scenario reports failure, not a fake zero (the original F-27 complaint)', () => {
    // annualFixedOpsCost of $50M dwarfs any revenue this model can produce — no
    // grant % or interest rate makes it solvent. The old solveMaxGrant returned
    // 0 here, identical to what it returns for the shipped baseline's genuine
    // near-zero answers elsewhere — a caller could not tell the two apart.
    const hopeless = { ...BASE, annualFixedOpsCost: 50_000_000 };
    const mg = ModelModule.solveMaxGrant(hopeless);
    const be = ModelModule.solveBreakEven(hopeless);
    assert.strictEqual(mg.ok, false, 'no grant % should rescue an impossible scenario');
    assert.strictEqual(mg.value, null);
    assert.ok(mg.reason, 'a failed solve must explain why');
    assert.strictEqual(be.ok, false, 'no interest rate should rescue an impossible scenario');
    assert.strictEqual(be.value, null);
    assert.ok(be.reason, 'a failed solve must explain why');
  });

  test('a capital-tight regime with no feasible grant % is reported as infeasible, not 0%', () => {
    // Confirmed by a fine-resolution (0.1%) reference sweep: no grant % in [0,100%]
    // keeps this scenario solvent. The old solver returned 0% — the same value it
    // returns for the shipped baseline being "already fine without any grant".
    const tight = { ...BASE, investLoan: 200000, investGrant: 50000 };
    const mg = ModelModule.solveMaxGrant(tight);
    assert.strictEqual(mg.ok, false);
    assert.strictEqual(mg.value, null);
  });

  test('solveBreakEven finds the true break-even rate to within one bisection cell, ' +
    'even where netAssets is non-monotone in the rate', () => {
    // "grant-heavy, loan-light" measured 14 of 74 downward steps in the ADR-0032
    // sweep — the regime the original binary search could not be trusted in.
    const scenario = { ...BASE, investLoan: 300000, investGrant: 700000 };
    const solved = ModelModule.solveBreakEven(scenario);
    assert.strictEqual(solved.ok, true);

    // Reference: scan at fine resolution for the true lowest feasible rate.
    let trueMin = null;
    for (let r = 0; r <= 1.5 + 1e-9; r += 0.002) {
      const na = ModelModule.calculate({ ...scenario, loanInterestRate: r, verify: false })
        .kpis.financials.netAssets;
      if (na >= 0) { trueMin = r; break; }
    }
    assert.ok(trueMin !== null, 'test setup: expected a feasible rate to exist');
    assert.ok(Math.abs(solved.value - trueMin) < 0.01,
      `solver found ${solved.value}, true break-even is ${trueMin} — gap too large`);
  });

  test('solveMaxGrant finds the true max grant to within one bisection cell, ' +
    'even where netAssets is non-monotone in the grant share', () => {
    // The shipped baseline itself is non-monotone here (27 of 50 downward steps),
    // though it stays feasible throughout — a real regression risk for any future
    // change that opens an infeasible pocket in the middle of the range.
    const solved = ModelModule.solveMaxGrant({ ...BASE });
    assert.strictEqual(solved.ok, true);

    let trueMax = null;
    for (let p = 1.0; p >= -1e-9; p -= 0.002) {
      const na = ModelModule.calculate({ ...BASE, grantSupportPct: p, verify: false })
        .kpis.financials.netAssets;
      if (na >= 0) { trueMax = p; break; }
    }
    assert.ok(trueMax !== null, 'test setup: expected a feasible grant % to exist');
    assert.ok(Math.abs(solved.value - trueMax) < 0.01,
      `solver found ${solved.value}, true max grant is ${trueMax} — gap too large`);
  });

  test('solveBreakEven does not mutate its input (same contract as calculate(), INV-12)', () => {
    const inputs = { ...BASE };
    const frozen = JSON.stringify(inputs);
    ModelModule.solveBreakEven(inputs);
    ModelModule.solveMaxGrant(inputs);
    assert.strictEqual(JSON.stringify(inputs), frozen, 'solver mutated its input object');
  });
});
