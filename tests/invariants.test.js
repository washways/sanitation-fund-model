/**
 * invariants.test.js — the properties that must hold for every run.
 *
 * Defined in docs/MODEL_SPEC.md §12. Each test names its invariant ID.
 *
 * HOW THE WORK QUEUE WORKS
 * ------------------------
 * Invariants the model does not yet satisfy are marked `{ todo: true }` with
 * the finding that explains why. Node's runner reports those separately from
 * failures, so the suite is green today and turns red the moment a *passing*
 * invariant regresses.
 *
 * When a stage fixes a finding: delete the `{ todo: true }` marker. The test
 * must then pass. That is the exit gate — see docs/ROADMAP.md.
 *
 * Never mark a passing invariant as todo to make a build green.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

const TOL = 1.0; // dollars — see R-2.6
const sum = a => a.reduce((x, y) => x + y, 0);
const run = over => ModelModule.calculate({ ...BASE, ...over });

/**
 * The scenario matrix. Every invariant runs against all of these, so a fix that
 * works on the defaults but breaks a corner is caught here rather than by a user.
 */
const SCENARIOS = {
  'baseline': {},
  'no grant capital': { investGrant: 0 },
  'no loan capital': { investLoan: 0 },
  'grant only, no debt': { investLoan: 0, fundRepaymentTerm: 0 },
  'zero inflation': { inflationRate: 0 },
  'high inflation': { inflationRate: 0.45 },
  'zero defaults': { hhDefaultRate: 0, meDefaultRate: 0 },
  'high defaults': { hhDefaultRate: 0.40, meDefaultRate: 0.40 },
  'long horizon': { duration: 20 },
  'short horizon': { duration: 1 },
  'capital tight': { investLoan: 500000, investGrant: 100000 },
  'demand exhausted': { popReqToilets: 5000 },
  'carbon enabled': { co2PerToilet: 250, co2Value: 20, carbonCreditShare: 0.5 },
  'costly cost of capital': { fundCostOfCapital: 0.12 },
  'full grant support': { grantSupportPct: 1.0 },
  'no grant support': { grantSupportPct: 0 },
};

/** Run `assertion` over every scenario, collecting failures so one run reports them all. */
function forEachScenario(assertion, only = null) {
  const failures = [];
  for (const [name, over] of Object.entries(SCENARIOS)) {
    if (only && !only.includes(name)) continue;
    try {
      assertion(run(over), { ...BASE, ...over }, name);
    } catch (e) {
      failures.push(`  [${name}] ${e.message.split('\n')[0]}`);
    }
  }
  if (failures.length) {
    assert.fail(`${failures.length} of ${Object.keys(SCENARIOS).length} scenarios failed:\n` + failures.join('\n'));
  }
}

describe('ledger invariants', () => {

  test('INV-1: cash[i] = cash[i-1] + net[i]', () => {
    forEachScenario(({ series: s }) => {
      for (let i = 1; i < s.dataMonthlyCashBalance.length; i++) {
        const drift = s.dataMonthlyCashBalance[i] - (s.dataMonthlyCashBalance[i - 1] + s.dataMonthlyNet[i]);
        assert.ok(Math.abs(drift) <= TOL, `M${i + 1} drift $${drift.toFixed(2)}`);
      }
    });
  });

  test('INV-2: opening balance reconciles to initial capital (F-12)', () => {
    forEachScenario(({ series: s }, inp) => {
      const opening = inp.investGrant + inp.investLoan - s.startupCost;
      const drift = s.dataMonthlyCashBalance[0] - (opening + s.dataMonthlyNet[0]);
      assert.ok(Math.abs(drift) <= TOL,
        `opening $${opening.toFixed(0)} + net[0] $${s.dataMonthlyNet[0].toFixed(0)} ` +
        `!= cash[0] $${s.dataMonthlyCashBalance[0].toFixed(0)} (drift $${drift.toFixed(2)})`);
    });
  });

  test('INV-3: output arrays have exactly duration * 12 months', () => {
    forEachScenario(({ series: s }, inp) => {
      const want = inp.duration * 12;
      for (const key of ['dataMonthlyCashBalance', 'dataMonthlyNet', 'dataMonthlyOps',
        'dataMonthlyPortfolioHh', 'dataMonthlyPortfolioMe', 'dataMonthlyUnitCost',
        'dataToiletsMonthlyLoan', 'dataToiletsMonthlyGrant', 'monthlyLabels']) {
        assert.strictEqual(s[key].length, want, `${key} has ${s[key].length}, expected ${want}`);
      }
    });
  });

  test('INV-4: cumulative toilet counts never decrease', () => {
    forEachScenario(({ series: s }) => {
      for (const key of ['dataToiletsMonthlyLoan', 'dataToiletsMonthlyGrant', 'dataToilets']) {
        for (let i = 1; i < s[key].length; i++) {
          assert.ok(s[key][i] >= s[key][i - 1] - 1e-9, `${key} fell at index ${i}`);
        }
      }
    });
  });

  test('INV-5: KPI toilet count matches the final monthly cumulative', () => {
    forEachScenario(({ series: s, kpis: k }) => {
      const last = s.dataToiletsMonthlyLoan.length - 1;
      const monthly = s.dataToiletsMonthlyLoan[last] + s.dataToiletsMonthlyGrant[last];
      assert.ok(Math.abs(monthly - k.reach.toilets) <= 1,
        `monthly ${monthly} vs KPI ${k.reach.toilets}`);
    });
  });

  test('INV-6: unit cost is positive in any month with production', () => {
    forEachScenario(({ series: s }) => {
      for (let i = 0; i < s.dataToiletsMonthlyLoan.length; i++) {
        const built = (s.dataToiletsMonthlyLoan[i] + s.dataToiletsMonthlyGrant[i])
          - (i > 0 ? s.dataToiletsMonthlyLoan[i - 1] + s.dataToiletsMonthlyGrant[i - 1] : 0);
        if (built > 0) assert.ok(s.dataMonthlyUnitCost[i] > 0, `zero unit cost at M${i + 1} with ${built} built`);
      }
    });
  });

  test('INV-7: inflation factor never decreases when inflation >= 0', () => {
    forEachScenario(({ series: s }, inp) => {
      if (inp.inflationRate < 0) return;
      for (let i = 1; i < s.dataMonthlyInflationFactor.length; i++) {
        assert.ok(s.dataMonthlyInflationFactor[i] >= s.dataMonthlyInflationFactor[i - 1] - 1e-12,
          `deflation at M${i + 1}`);
      }
    });
  });

  test('INV-8: no output is NaN or Infinity (F-03)', () => {
    const scenarios = { ...SCENARIOS, 'zero HH interest': { loanInterestRate: 0 }, 'zero ME interest': { meLoanInterestRate: 0 } };
    const failures = [];
    for (const [name, over] of Object.entries(scenarios)) {
      const { series: s, kpis: k } = ModelModule.calculate({ ...BASE, ...over });
      for (const [key, arr] of Object.entries(s)) {
        if (!Array.isArray(arr)) continue;
        const bad = arr.filter(v => typeof v === 'number' && !Number.isFinite(v)).length;
        if (bad) failures.push(`  [${name}] ${key}: ${bad}/${arr.length} non-finite`);
      }
      if (!Number.isFinite(k.reach.toilets)) failures.push(`  [${name}] kpis.reach.toilets is not finite`);
    }
    assert.deepStrictEqual(failures, [], `non-finite values:\n${failures.join('\n')}`);
  });

  test('INV-9: repaid principal never exceeds the senior loan', () => {
    forEachScenario(({ series: s }, inp) => {
      const repaid = sum(s.dataMonthlyFundPrincipal);
      assert.ok(repaid <= inp.investLoan + TOL,
        `repaid $${repaid.toFixed(0)} > loan $${inp.investLoan.toFixed(0)}`);
      assert.ok(repaid >= -TOL, `negative principal repaid: $${repaid.toFixed(0)}`);
    });
  });

  test('INV-10: grant spending never exceeds grant capital plus carbon income', () => {
    forEachScenario(({ series: s }, inp) => {
      const variableRate = inp.mgmtFeeRatio + inp.meCostRate + inp.contingencyRate;
      const spent = sum(s.dataMonthlyGrantDisbursed) * (1 + variableRate);
      const available = inp.investGrant + sum(s.dataMonthlyCarbonRevenue);
      assert.ok(spent <= available + TOL,
        `grant ledger overdrawn: spent $${spent.toFixed(0)} of $${available.toFixed(0)} available`);
    });
  });

  test('INV-11: write-offs are never treated as cash outflows', () => {
    forEachScenario(({ series: s }) => {
      for (let i = 0; i < s.dataMonthlyNet.length; i++) {
        const inflow = s.dataMonthlyRevenueHh[i] + s.dataMonthlyRevenueMe[i]
          + s.dataMonthlyRepaymentHh[i] + s.dataMonthlyRepaymentMe[i] + s.dataMonthlyCarbonRevenue[i];
        const outflow = s.dataMonthlyOps[i] + s.dataMonthlyFees[i] + s.dataMonthlyFundPrincipal[i]
          + s.dataMonthlyFundInt[i] + s.dataMonthlyNewLoansHhVal[i] + s.dataMonthlyNewLoansMeVal[i]
          + s.dataMonthlyGrantDisbursed[i];
        const drift = s.dataMonthlyNet[i] - (inflow - outflow);
        assert.ok(Math.abs(drift) <= TOL,
          `M${i + 1}: net does not equal inflows - outflows (drift $${drift.toFixed(2)}); ` +
          `write-offs that month were $${(s.dataMonthlyDefaultsHh[i] + s.dataMonthlyDefaultsMe[i]).toFixed(2)}`);
      }
    });
  });

  test('INV-12: calculate() is deterministic and does not mutate its input', () => {
    forEachScenario((_, inp) => {
      const frozen = JSON.parse(JSON.stringify(inp));
      const a = ModelModule.calculate(inp);
      assert.deepStrictEqual(inp, frozen, 'calculate() mutated the inputs object it was given');
      const b = ModelModule.calculate(inp);
      assert.deepStrictEqual(a.series.dataMonthlyCashBalance, b.series.dataMonthlyCashBalance,
        'two identical runs produced different cash series');
      assert.deepStrictEqual(a.kpis.reach.toilets, b.kpis.reach.toilets);
    });
  });

  test('INV-13: no ops cost with an empty portfolio and no production (F-31)', () => {
      const { series: s } = run({ duration: 20 });
      const offenders = [];
      // Test the portfolio the month STARTED with, i.e. the previous month's closing
      // balance. A month that opens with loans outstanding and collects the last of
      // them legitimately incurs a collections cost; a month that opens with nothing
      // does not. Checking the closing balance instead would flag the final
      // collection month, which is not what R-9.4 means.
      for (let i = 2; i < s.dataMonthlyOps.length; i++) {
        const openingPortfolio = s.dataMonthlyPortfolioHh[i - 1] + s.dataMonthlyPortfolioMe[i - 1];
        const built = (s.dataToiletsMonthlyLoan[i] + s.dataToiletsMonthlyGrant[i])
          - (s.dataToiletsMonthlyLoan[i - 1] + s.dataToiletsMonthlyGrant[i - 1]);
        if (openingPortfolio < 1 && built === 0 && s.dataMonthlyOps[i] > 1) offenders.push(i + 1);
      }
      assert.deepStrictEqual(offenders, [],
        `${offenders.length} months bill ops against a dead fund ` +
        `(first M${offenders[0]}, last M${offenders[offenders.length - 1]}), ` +
        `totalling $${sum(s.dataMonthlyOps.filter((_, i) => offenders.includes(i + 1))).toFixed(0)}`);
    });

  test('INV-14: once a fund has wound up, extending duration changes nothing (F-31)', () => {
    // The invariant applies to a fund that has FINISHED. A fund still lending at the
    // 5-year mark legitimately does more in 20 years, so comparing those two is
    // meaningless. Use a scenario that reliably dies early, and assert both that it
    // winds up and that nothing moves after it does.
    const dying = { annualFixedOpsCost: 400000, loanInterestRate: 0.05 };

    const short = run({ ...dying, duration: 5 });
    const long = run({ ...dying, duration: 20 });

    assert.ok(short.series.windUpMonth !== null && short.series.windUpMonth <= 60,
      'the control scenario must wind up inside 5 years for this test to mean anything; ' +
      `windUpMonth was ${short.series.windUpMonth}`);
    assert.strictEqual(short.series.windUpMonth, long.series.windUpMonth,
      'wind-up month must not depend on the requested horizon');

    const a = short.kpis.impact.financials, b = long.kpis.impact.financials;
    assert.ok(Math.abs(a.cashEnd - b.cashEnd) <= TOL,
      `cashEnd 5y $${a.cashEnd.toFixed(0)} vs 20y $${b.cashEnd.toFixed(0)}`);
    assert.ok(Math.abs(a.netAssets - b.netAssets) <= TOL,
      `netAssets 5y $${a.netAssets.toFixed(0)} vs 20y $${b.netAssets.toFixed(0)}`);
    assert.strictEqual(short.kpis.reach.toilets, long.kpis.reach.toilets);
  });

  test('INV-15: DALYs and time-saved stop accruing for a toilet past its service life, same as carbon (Q13, ADR-0025)',
    () => {
      // A short lifespan against a long duration guarantees real retirement within the
      // run, so this scenario actually exercises the fix rather than passing vacuously.
      const r = run({ toiletLifespanYears: 2, duration: 10 });
      const s = r.series;
      const last = s.dataMonthlyDalysAverted.length - 1;

      // The scenario must genuinely have toilets past service life by the end, or this
      // test proves nothing — retiredToiletsCumulative would be 0 and every basis agrees.
      assert.ok(s.dataMonthlyCreditingToilets[last] < s.dataMonthlyActiveToilets[last] * 0.9,
        'this scenario should have retired a meaningful share of its toilets by month ' +
        `${last + 1} (in-service ${s.dataMonthlyCreditingToilets[last]} vs all-time built ` +
        `${s.dataMonthlyActiveToilets[last]}) — otherwise it is not testing retirement at all`);

      // R-8.2/R-8.3: dalys[m] and hours[m] are keyed to the SAME in-service count carbon
      // already uses (R-8.1), not to every toilet ever built.
      const expectedDalys = s.dataMonthlyCreditingToilets[last] * BASE.avgHHSize * BASE.dalyPerPerson / 12;
      assert.ok(Math.abs(s.dataMonthlyDalysAverted[last] - expectedDalys) < 1,
        `dalys[${last}] = ${s.dataMonthlyDalysAverted[last].toFixed(2)}, expected ${expectedDalys.toFixed(2)} ` +
        `from creditingToilets — a retired toilet must not keep averting DALYs`);

      const hoursPerDay = BASE.hoursPerPersonPerDay !== undefined ? BASE.hoursPerPersonPerDay : 0.25;
      const expectedHours = s.dataMonthlyCreditingToilets[last] * BASE.avgHHSize * hoursPerDay * 30;
      assert.ok(Math.abs(s.dataMonthlyHoursSaved[last] - expectedHours) < 1,
        `hoursSaved[${last}] = ${s.dataMonthlyHoursSaved[last].toFixed(2)}, expected ${expectedHours.toFixed(2)} ` +
        `from creditingToilets — a retired toilet must not keep saving time`);
    });

  test('INV-16: the solvency gate reserves against scheduled investor principal, not just ops cost (F-10, ADR-0027)',
    () => {
      // Before ADR-0027, the shipped baseline built 133,469 toilets under a reserve of
      // 3 months' (possibly hibernation-cut) ops cost only. The reserve now also holds
      // back the next 3 months of scheduled investor principal, so a fund with real
      // debt service must lend more conservatively — reach must fall, not because the
      // fund performs worse, but because it no longer lends away cash it already owes.
      const r = run({});
      assert.ok(r.kpis.reach.toilets < 133469,
        `expected fewer toilets than the pre-ADR-0027 baseline (133,469) now that the ` +
        `solvency gate reserves against scheduled investor principal too — got ${r.kpis.reach.toilets}. ` +
        `If this is failing because the number went back up to 133,469, the lookahead reserve was reverted.`);
      assert.ok(r.viability.ok,
        'the baseline scenario must remain viable under the new reserve — conservatism should not tip it over');

      // The reserve must not apply after wind-up (R-9.2): a dead fund does no further
      // lending, so reserving against it is meaningless. Use a fund that dies early.
      const dying = run({ annualFixedOpsCost: 400000, loanInterestRate: 0.05 });
      assert.ok(dying.series.windUpMonth !== null, 'this scenario should wind up for the check below to mean anything');
    });
});
