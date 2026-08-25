/**
 * writedown.test.js — T-DEF-1: realised loss is not the headline write-down rate.
 *
 * MODEL_SPEC.md §R-3.4 converts the annual "default rate" input into a monthly hazard
 * applied to each cohort's outstanding balance (R-3.3), not a discrete "x% of loans
 * fail". That makes realised loss, as a share of principal disbursed, depend on the
 * loan term:
 *
 *   - Below about a year, amortisation shrinks the exposed balance faster than the
 *     hazard eats it, so realised loss is well BELOW the headline rate.
 *   - Past about 18-24 months, cumulative exposure across multiple years of hazard
 *     overtakes that effect, and realised loss EXCEEDS the headline rate.
 *
 * This is F-26 (the label was fixed 2026-08-20; this test is the "add the realised
 * loss test" item that was still open) and F-35 (MODEL_SPEC.md previously claimed
 * realised loss is "always less" than headline, which is only true on one side of
 * this crossover — see docs/ANALYSIS.md#f-35).
 *
 * WHY A STANDALONE COHORT SIMULATION, NOT A FULL MODEL RUN
 * ----------------------------------------------------------
 * A full `ModelModule.calculate()` run blends many vintages started in different
 * months, some cut short by wind-up. That is the right thing for the app to do and
 * the wrong thing to pin a single relationship against — the aggregate ratio would
 * mix terms, timing and horizon effects together. Instead this test replicates the
 * R-3.3 cohort recurrence directly (write-off, then interest, then principal, exactly
 * as src/model/engine.js orders it), using the model's own public `annuityPayment` and
 * `getMonthlyRate` helpers for the payment schedule, so the amortisation math is the
 * real thing and only the write-off/interest/principal loop is reimplemented from the
 * four-line spec in R-3.3.
 *
 * If the loop in src/model/engine.js and the loop here ever disagree, that is exactly
 * the kind of drift this test exists to catch — MODEL_SPEC.md is normative, so a
 * mismatch means the model moved away from the spec, not that this test needs
 * updating to match the model.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ModelModule } = require('../tools/load-model');
const BASE = require('../tools/baseline-inputs');

/**
 * Simulate a single amortising cohort under R-3.3/R-3.4 and return realised loss as a
 * fraction of the principal disbursed.
 */
function realisedLossRatio(annualWriteDownRate, annualInterestRate, termMonths, principal = 1_000_000) {
    const probDefault = 1 - Math.pow(1 - annualWriteDownRate, 1 / 12);          // R-3.4
    const monthlyRate = ModelModule.getMonthlyRate(annualInterestRate);          // R-2.2
    const payment = ModelModule.annuityPayment(principal, monthlyRate, termMonths); // R-3.2

    let balance = principal;
    let termRemaining = termMonths;
    let totalWriteOff = 0;

    for (let m = 0; m < termMonths; m++) {
        const writeOff = balance * probDefault;                                  // R-3.3 step 1
        totalWriteOff += writeOff;
        balance -= writeOff;

        const interest = balance * monthlyRate;                                  // R-3.3 step 2 (post-write-off)

        let principalDue = termRemaining === 1 ? balance : Math.max(0, payment - interest); // R-3.3 step 3
        if (principalDue > balance) principalDue = balance;

        balance -= principalDue;                                                 // R-3.3 step 4
        termRemaining--;
    }

    return totalWriteOff / principal;
}

describe('T-DEF-1 — realised loss vs. disbursed principal (F-26, F-35)', () => {

    test('the shipped household default (18 months, 5% headline) realises 4.13%, not 5%', () => {
        const ratio = realisedLossRatio(BASE.hhDefaultRate, BASE.loanInterestRate, BASE.termHh);
        assert.ok(Math.abs(ratio - 0.0413) < 0.001,
            `realised loss ${(ratio * 100).toFixed(2)}% should be pinned near 4.13% for the shipped ` +
            `18-month term — if this moved, either the amortisation math or the shipped defaults changed`);
        assert.ok(ratio < BASE.hhDefaultRate,
            `at the shipped term, realised loss (${(ratio * 100).toFixed(2)}%) should still read below ` +
            `the headline rate (${(BASE.hhDefaultRate * 100).toFixed(1)}%) — R-3.4`);
    });

    test('a 6-month term realises far below headline — the case the audit originally measured', () => {
        // Matches the figure already published in docs/ANALYSIS.md, docs/PARAMETERS.md and
        // ADR-0014: a 5% headline write-down on a 6-month term realises ~1.50% of disbursed.
        const ratio = realisedLossRatio(0.05, BASE.loanInterestRate, 6);
        assert.ok(Math.abs(ratio - 0.0150) < 0.0005,
            `expected ~1.50% realised loss on a 6-month term at a 5% headline rate, got ${(ratio * 100).toFixed(2)}%`);
    });

    test('realised loss crosses the headline rate between 18 and 24 months (F-35)', () => {
        // This is the relationship MODEL_SPEC.md previously got wrong by omission: realised
        // loss is not "always less than headline" — it is less below the crossover and MORE
        // above it, because a multi-year term accumulates hazard across multiple years while
        // a headline rate is a single year's worth.
        const at18 = realisedLossRatio(0.05, BASE.loanInterestRate, 18);
        const at24 = realisedLossRatio(0.05, BASE.loanInterestRate, 24);
        const at36 = realisedLossRatio(0.05, BASE.loanInterestRate, 36);

        assert.ok(at18 < 0.05, `18 months should still be under headline, got ${(at18 * 100).toFixed(2)}%`);
        assert.ok(at24 > 0.05, `24 months should be over headline, got ${(at24 * 100).toFixed(2)}%`);
        assert.ok(at36 > at24 && at24 > at18,
            'realised loss should increase monotonically with term, at a fixed headline rate');
    });

    test('shortening the term always reduces realised loss, at a fixed headline rate', () => {
        // The one part of the original R-3.4 claim that holds unconditionally: exposure
        // duration is monotone in term, regardless of which side of the crossover you are on.
        const terms = [3, 6, 12, 18, 24, 36, 48];
        const ratios = terms.map(t => realisedLossRatio(0.08, BASE.loanInterestRate, t));
        for (let i = 1; i < ratios.length; i++) {
            assert.ok(ratios[i] > ratios[i - 1],
                `realised loss at ${terms[i]}mo (${(ratios[i] * 100).toFixed(2)}%) should exceed ` +
                `${terms[i - 1]}mo (${(ratios[i - 1] * 100).toFixed(2)}%)`);
        }
    });

    test('the micro-enterprise write-down rate has the same term-dependence', () => {
        // R-3.4 applies identically to meDefaultRate — this is not a household-only quirk.
        const ratio = realisedLossRatio(BASE.meDefaultRate, BASE.meLoanInterestRate, BASE.termMe);
        assert.ok(ratio < BASE.meDefaultRate,
            `at the shipped ${BASE.termMe}-month ME term, realised loss should be below the ` +
            `${(BASE.meDefaultRate * 100).toFixed(1)}% headline — got ${(ratio * 100).toFixed(2)}%`);
        assert.ok(ratio > 0, 'a positive write-down rate should realise a positive loss');
    });

    test('a 0% write-down rate realises exactly 0% loss (INV-8 territory — no NaN)', () => {
        const ratio = realisedLossRatio(0, BASE.loanInterestRate, BASE.termHh);
        assert.strictEqual(ratio, 0);
    });
});
