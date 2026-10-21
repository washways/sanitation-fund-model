/**
 * Investor debt waterfall regressions — F-44/F-45, ADR-0036.
 *
 * These tests deliberately separate the debt-service arithmetic from the rest of
 * the simulation. A plausible ending balance is not enough: old interest must
 * actually be payable, and every reduction in the liability must reconcile.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const TOL = 0.01;
const sum = values => values.reduce((a, b) => a + b, 0);

describe('investor debt waterfall (F-44/F-45)', () => {
  test('non-finite debt inputs propagate for INV-8 instead of becoming plausible zero', () => {
    const r = ModelModule.serviceInvestorDebt({
      loanCash: Number.NaN,
      liability: 1000,
      accruedInterest: 0,
      accruedPrincipal: 0,
      currentInterest: 10,
      scheduledPrincipal: 100,
    });
    assert.ok(Number.isNaN(r.loanCash));
    assert.ok(Number.isNaN(r.paidCurrentInterest));
  });

  test('past-due capitalised interest is paid before current interest and principal', () => {
    const r = ModelModule.serviceInvestorDebt({
      loanCash: 300,
      liability: 1200,
      accruedInterest: 200,
      accruedPrincipal: 100,
      currentInterest: 20,
      scheduledPrincipal: 100,
      acceleratePrincipal: false,
    });

    assert.strictEqual(r.paidArrearsInterest, 200);
    assert.strictEqual(r.paidCurrentInterest, 20);
    assert.strictEqual(r.paidPrincipal, 80);
    assert.strictEqual(r.loanCash, 0);
    assert.strictEqual(r.liability, 920);
    assert.strictEqual(r.accruedInterest, 0);
    assert.strictEqual(r.accruedPrincipal, 120);
  });

  test('newly missed current interest capitalises after older arrears are serviced', () => {
    const r = ModelModule.serviceInvestorDebt({
      loanCash: 50,
      liability: 1000,
      accruedInterest: 100,
      accruedPrincipal: 0,
      currentInterest: 20,
      scheduledPrincipal: 100,
      acceleratePrincipal: false,
    });

    assert.strictEqual(r.paidArrearsInterest, 50);
    assert.strictEqual(r.paidCurrentInterest, 0);
    assert.strictEqual(r.missedCurrentInterest, 20);
    assert.strictEqual(r.accruedInterest, 70);
    assert.strictEqual(r.accruedPrincipal, 100);
    assert.strictEqual(r.liability, 970);
  });

  test('terminal settlement accelerates original principal but not new interest', () => {
    const r = ModelModule.serviceInvestorDebt({
      loanCash: 250,
      liability: 1000,
      accruedInterest: 100,
      accruedPrincipal: 0,
      currentInterest: 0,
      scheduledPrincipal: 0,
      acceleratePrincipal: true,
    });

    assert.strictEqual(r.paidArrearsInterest, 100);
    assert.strictEqual(r.paidCurrentInterest, 0);
    assert.strictEqual(r.paidPrincipal, 150);
    assert.strictEqual(r.loanCash, 0);
    assert.strictEqual(r.liability, 750);
    assert.strictEqual(r.accruedInterest, 0);
    assert.strictEqual(r.accruedPrincipal, 750);
  });

  test('INV-20: ending senior liability reconciles to principal and capitalised-interest flows', () => {
    const scenarios = [
      {},
      { fundCostOfCapital: 0.08 },
      { annualFixedOpsCost: 400000, loanInterestRate: 0.05 },
      { popReqToilets: 0 },
    ];

    for (const overrides of scenarios) {
      const inputs = { ...BASE, ...overrides, verify: false };
      const s = ModelModule.calculate(inputs).series;
      const expected = inputs.investLoan
        - sum(s.dataMonthlyFundPrincipal)
        + s.capitalisedInterest
        - s.capitalisedInterestRepaid;
      assert.ok(Math.abs(s.investorLiabilityEnd - expected) <= TOL,
        `liability $${s.investorLiabilityEnd.toFixed(2)} did not reconcile to $${expected.toFixed(2)} ` +
        `for ${JSON.stringify(overrides)}`);
      assert.ok(s.accruedInvestorInt <= s.investorLiabilityEnd + TOL,
        'interest arrears cannot exceed the whole senior liability');
    }
  });

  test('wind-up applies all positive loan-ledger cash to the senior liability', () => {
    const r = ModelModule.calculate({ ...BASE, popReqToilets: 0, verify: false });
    const s = r.series;
    const last = s.dataMonthlyCashBalance.length - 1;
    const endingLoanCash = s.dataMonthlyCashBalance[last] - s.dataMonthlyGrantCash[last];

    assert.ok(s.windUpMonth !== null, 'the no-demand control must reach wind-up');
    assert.ok(s.dataMonthlyFundPrincipal[s.windUpMonth - 1] > 0,
      'the wind-up month must record the terminal principal transfer');
    assert.ok(Math.abs(endingLoanCash) <= TOL,
      `loan ledger retained $${endingLoanCash.toFixed(2)} while senior debt remained`);
    assert.ok(s.investorLiabilityEnd > 0,
      'the test must preserve and report the unpaid balance, not write it off');
  });
});

