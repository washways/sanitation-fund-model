/**
 * wiring.test.js — does every parameter the model reads actually reach it?
 *
 * This suite exists because of finding F-01: `UI.getInputs()` reads
 * `fundCostOfCapital`, no such control exists in index.html, `getRaw` silently
 * returns its default of 0, and the fund therefore paid its investors no
 * interest for the entire life of the project. Nothing failed. Nothing warned.
 *
 * The class of bug is "a silent default stands in for a missing control", and
 * it is invisible to every other kind of test — the model runs fine, the
 * arithmetic is self-consistent, the answer is just wrong. These tests are the
 * only thing that catches it.
 *
 * See docs/TESTING.md.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { concatenated } = require('../tools/app-source');

const ROOT = path.join(__dirname, '..');
// The app's src/ files, concatenated in load order — this is what a browser's
// classic-script scope sees, and what these regex checks were written against
// before the S5 split (ADR-0033). The markers used below to slice out
// "the body of getInputs()" and "the body of ModelModule" still work unchanged,
// because the split kept the same section-header comments at the same relative
// positions in the load order.
const appSrc = concatenated();
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** Every id present in index.html. */
const htmlIds = new Set([...htmlSrc.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));

/** The body of UI.getInputs(), where the model's inputs are assembled. */
function getInputsBody() {
  const start = appSrc.indexOf('getInputs()');
  assert.ok(start > 0, 'UI.getInputs() not found in the concatenated src/');
  const end = appSrc.indexOf('// --- Initialization ---', start);
  assert.ok(end > start, 'end of getInputs() not found');
  return appSrc.slice(start, end);
}

describe('input wiring', () => {
  test('every id read by getInputs() exists in index.html (F-01)', () => {
    const body = getInputsBody();
    const read = new Set(
      [...body.matchAll(/get(?:Raw|Decimal|ElementById)\('([A-Za-z0-9_-]+)'/g)].map(m => m[1])
    );
    assert.ok(read.size > 20, `expected many inputs, parsed ${read.size}`);

    const missing = [...read].filter(id => !htmlIds.has(id)).sort();

    // Each entry would be a parameter the model reads that the user cannot set.
    // F-01 (fundCostOfCapital) and F-15 (wiz-tech) are fixed, so this is empty and
    // must stay empty. Adding an entry here to make a build green is exactly the
    // failure mode this test exists to prevent.
    const KNOWN_MISSING = [];

    const unexpected = missing.filter(id => !KNOWN_MISSING.includes(id));
    assert.deepStrictEqual(unexpected, [],
      `getInputs() reads ids with no control in index.html, so they silently ` +
      `fall back to a default: ${unexpected.join(', ')}`);

    const fixed = KNOWN_MISSING.filter(id => !missing.includes(id));
    assert.deepStrictEqual(fixed, [],
      `${fixed.join(', ')} is now wired up — remove it from KNOWN_MISSING in this test.`);
  });

  test('every id touched anywhere in src/ exists in index.html', () => {
    const used = new Set(
      [...appSrc.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)].map(m => m[1])
    );
    const missing = [...used].filter(id => !htmlIds.has(id)).sort();

    // Banners are built on demand and inserted after .top-actions rather than being
    // declared in the markup. That is intentional; everything else here would be a bug.
    const KNOWN_MISSING = [
      'integrityBanner',   // model-defect banner
      'viabilityBanner',   // fund-viability verdict (F-29)
      'adviceBanner',      // model-tested solvency advice (F-04)
      'interest-help',     // smart-rate hint target; harmless when absent
    ];

    const unexpected = missing.filter(id => !KNOWN_MISSING.includes(id));
    assert.deepStrictEqual(unexpected, [],
      `src/ reaches for DOM ids that do not exist: ${unexpected.join(', ')}`);
  });

  test('no parameter is collected and then never used by the model (F-09, F-25)', () => {
    const body = getInputsBody();
    // Keys assembled into the inputs object, e.g. "popGrowthRate: getDecimal(...)"
    const keys = [...body.matchAll(/^\s{12}([a-zA-Z][\w]*):/gm)].map(m => m[1]);
    assert.ok(keys.length > 20, `expected many keys, parsed ${keys.length}`);

    // Where the model reads its inputs. Anything absent here is collected in vain.
    const modelStart = appSrc.indexOf('const ModelModule = {');
    const modelEnd = appSrc.indexOf('// --- UI Module ---');
    const modelSrc = appSrc.slice(modelStart, modelEnd);

    const unused = [...new Set(keys)]
      .filter(k => !modelSrc.includes(`inputs.${k}`))
      .sort();

    // `country` only labels the run; `enableBreakEvenSolver` is read by the controller
    // rather than by the maths. Nothing else may be collected and ignored — F-25 is
    // closed (avgAnnualIncome now sets the value of saved time, R-8.6) and this list
    // must not grow again.
    const KNOWN_UNUSED = ['country', 'enableBreakEvenSolver'];

    const unexpected = unused.filter(k => !KNOWN_UNUSED.includes(k));
    assert.deepStrictEqual(unexpected, [],
      `collected from the user but never read by ModelModule: ${unexpected.join(', ')}`);

    const nowUsed = KNOWN_UNUSED.filter(k => !unused.includes(k));
    assert.deepStrictEqual(nowUsed, [],
      `${nowUsed.join(', ')} is now used by the model — remove it from KNOWN_UNUSED.`);
  });

  test('baseline-inputs.js has not drifted from index.html defaults', () => {
    const BASE = require('../tools/baseline-inputs');

    // id in index.html -> key in the model's inputs object
    const map = {
      popReqToilets: 'popReqToilets', avgHHSize: 'avgHHSize',
      avgToiletCost: 'avgToiletCost', districts: 'districts',
      mePerDistrict: 'mePerDistrict', toiletsPerMeMonth: 'toiletsPerMeMonth',
      meSetupCost: 'meSetupCost', annualFixedOpsCost: 'annualFixedOpsCost',
      fundRepaymentTerm: 'fundRepaymentTerm', termHh: 'termHh', termMe: 'termMe',
      investorGracePeriod: 'investorGracePeriod', opsReserveCap: 'opsReserveCap',
      'wiz-duration-sidebar': 'duration',
      'wiz-invest-grant-sidebar': 'investGrant',
      'wiz-invest-loan-sidebar': 'investLoan',
      grantSupportPct: 'grantSupportPct', inflationRate: 'inflationRate',
      hhDefaultRate: 'hhDefaultRate', meDefaultRate: 'meDefaultRate',
      mgmtFeeRatio: 'mgmtFeeRatio', meCostRate: 'meCostRate',
      contingencyRate: 'contingencyRate', popGrowthRate: 'popGrowthRate',
      dalyPerPerson: 'dalyPerPerson', dalyValue: 'dalyValue',
      avgAnnualIncome: 'avgAnnualIncome',
      fundCostOfCapital: 'fundCostOfCapital',
      hoursPerPersonPerDay: 'hoursPerPersonPerDay',
      meExitRate: 'meExitRate',
      meExpansionBudgetShare: 'meExpansionBudgetShare',
      meMaxMonthlyGrowthRate: 'meMaxMonthlyGrowthRate',
      timeValueFactor: 'timeValueFactor',
      toiletLifespanYears: 'toiletLifespanYears',
    };

    // Rate fields are entered as percentages and divided by 100 once, at the input
    // boundary (R-2.3). Apply the same conversion here, so this test also pins the
    // convention: if someone reverts a field to decimal entry, this fails.
    const PERCENT_FIELDS = new Set([
      'popGrowthRate', 'grantSupportPct', 'inflationRate', 'hhDefaultRate',
      'meDefaultRate', 'mgmtFeeRatio', 'meCostRate', 'contingencyRate',
      'opsReserveCap', 'fundCostOfCapital', 'meExitRate', 'timeValueFactor',
      'meExpansionBudgetShare', 'meMaxMonthlyGrowthRate',
    ]);

    const drift = [];
    for (const [id, key] of Object.entries(map)) {
      const tag = htmlSrc.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
      if (!tag) { drift.push(`${id}: no input in index.html`); continue; }
      const attr = tag[0].match(/value="([^"]*)"/);
      if (!attr) { drift.push(`${id}: input has no value attribute`); continue; }

      const raw = parseFloat(attr[1].replace(/,/g, ''));
      const expected = PERCENT_FIELDS.has(id) ? raw / 100 : raw;
      if (Math.abs(expected - BASE[key]) > 1e-9) {
        drift.push(`${id}: index.html has ${raw}${PERCENT_FIELDS.has(id) ? ` (=> ${expected})` : ''}, ` +
          `baseline-inputs.js has ${BASE[key]}`);
      }
    }
    assert.deepStrictEqual(drift, [],
      'tools/baseline-inputs.js must mirror the defaults shipped in index.html, ' +
      'or every golden test is measuring a scenario no user will ever see:\n  ' +
      drift.join('\n  '));
  });

  test('meExpansionBudgetShare and meMaxMonthlyGrowthRate actually move ME growth (F-21, ADR-0019)', () => {
    // Textual wiring (the tests above) proves getInputs() reads these ids. That is not
    // the same as proving the model's arithmetic responds to them — F-01 read an input
    // that had no control at all, and this is the mirror-image risk: a control that
    // exists but whose value the model quietly ignores.
    const { ModelModule } = require('../tools/load-model');
    const BASE = require('../tools/baseline-inputs');

    const slow = ModelModule.calculate({ ...BASE, meMaxMonthlyGrowthRate: 0.02, verify: true });
    const fast = ModelModule.calculate({ ...BASE, meMaxMonthlyGrowthRate: 0.30, verify: true });
    assert.notStrictEqual(
      Math.round(slow.kpis.reach.toilets), Math.round(fast.kpis.reach.toilets),
      'meMaxMonthlyGrowthRate should change how many toilets get built');

    const tightBudget = ModelModule.calculate({ ...BASE, meExpansionBudgetShare: 0.01, verify: true });
    const looseBudget = ModelModule.calculate({ ...BASE, meExpansionBudgetShare: 0.50, verify: true });
    assert.notStrictEqual(
      Math.round(tightBudget.kpis.reach.toilets), Math.round(looseBudget.kpis.reach.toilets),
      'meExpansionBudgetShare should change how many toilets get built');

    // And the defaults (0.10, 0.10) must reproduce exactly what the hardcoded
    // constants used to produce — this is the "zero behaviour change" half of ADR-0019.
    const atDefault = ModelModule.calculate({ ...BASE, verify: true });
    assert.ok(atDefault.integrity.ok, 'the default-parameter run should still pass integrity checks');
  });
});
