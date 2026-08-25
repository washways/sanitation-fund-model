/**
 * invariants.js — part of the S5 structural split (ADR-0033). Integrity (INV-1..INV-18) and viability verdicts, plus the model-tested solvency advice that depends on them (MODEL_SPEC R-10, §12).
 */

Object.assign(ModelModule, {
    // --- Verification (MODEL_SPEC R-10, §12) ---
    //
    // Two independent verdicts. `checkIntegrity` asks whether the arithmetic is
    // self-consistent — a violation is a DEFECT IN THE MODEL. `checkViability` asks
    // whether the fund works — a failure is a FINDING ABOUT THE SCENARIO, and is a
    // perfectly legitimate result to report. Collapsing them is finding F-29.

    /** INV-1 .. INV-14. A violation here means the model is broken. */
    checkIntegrity(series, inputs, kpis) {
        const s = series;
        const k = kpis;
        const v = [];
        const TOL = 1.0;
        const last = s.dataMonthlyCashBalance.length - 1;

        // INV-8 — MUST BE FIRST. NaN defeats every other check in this function,
        // because NaN comparisons are always false: Math.abs(NaN - NaN) > 1 is false,
        // so a corrupted ledger sails through the cash identity below (F-03).
        for (const [key, arr] of Object.entries(s)) {
            if (!Array.isArray(arr)) continue;
            const bad = arr.reduce((n, x) => n + (typeof x === 'number' && !Number.isFinite(x) ? 1 : 0), 0);
            if (bad > 0) {
                v.push(`INV-8: ${key} contains ${bad} non-finite value(s) (NaN/Infinity)`);
            }
        }
        if (v.length > 0) {
            // Everything downstream is meaningless once NaN is loose. Stop here rather
            // than emitting a hundred derived complaints.
            return { ok: false, violations: v };
        }

        // INV-3: duration enforcement
        const expectedMonths = inputs.duration * 12;
        if (s.dataMonthlyCashBalance.length !== expectedMonths) {
            v.push(`INV-3: expected ${expectedMonths} months, got ${s.dataMonthlyCashBalance.length}`);
        }

        // INV-2: opening balance reconciles to initial capital. The identity loop below
        // starts at i=1, so without this the month-0 startup block is never checked (F-12).
        const opening = inputs.investGrant + inputs.investLoan - (s.startupCost || 0);
        const openingDrift = s.dataMonthlyCashBalance[0] - (opening + s.dataMonthlyNet[0]);
        if (Math.abs(openingDrift) > TOL) {
            v.push(`INV-2: opening $${opening.toFixed(0)} + net[0] $${s.dataMonthlyNet[0].toFixed(0)} ` +
                `!= cash[0] $${s.dataMonthlyCashBalance[0].toFixed(0)} (drift $${openingDrift.toFixed(2)})`);
        }

        // INV-1: cash continuity
        let identityFails = 0;
        for (let i = 1; i < s.dataMonthlyCashBalance.length; i++) {
            const drift = s.dataMonthlyCashBalance[i] - (s.dataMonthlyCashBalance[i - 1] + s.dataMonthlyNet[i]);
            if (Math.abs(drift) > TOL) {
                identityFails++;
                if (identityFails <= 5) v.push(`INV-1: cash identity fails at M${i + 1} (drift $${drift.toFixed(2)})`);
            }
        }
        if (identityFails > 5) v.push(`INV-1: ...and ${identityFails - 5} further month(s)`);

        // INV-4: cumulative production never decreases
        for (let i = 1; i < s.dataToiletsMonthlyLoan.length; i++) {
            if (s.dataToiletsMonthlyLoan[i] < s.dataToiletsMonthlyLoan[i - 1] - 0.5) {
                v.push(`INV-4: cumulative loan toilets fell at M${i + 1}`); break;
            }
        }
        for (let i = 1; i < s.dataToiletsMonthlyGrant.length; i++) {
            if (s.dataToiletsMonthlyGrant[i] < s.dataToiletsMonthlyGrant[i - 1] - 0.5) {
                v.push(`INV-4: cumulative grant toilets fell at M${i + 1}`); break;
            }
        }

        // INV-5: headline reach matches the monthly series
        const monthlyFinal = (s.dataToiletsMonthlyLoan[last] || 0) + (s.dataToiletsMonthlyGrant[last] || 0);
        if (k && k.reach && Math.abs(monthlyFinal - k.reach.toilets) > 1) {
            v.push(`INV-5: monthly total ${monthlyFinal.toFixed(0)} vs KPI ${k.reach.toilets.toFixed(0)}`);
        }

        // INV-6: unit cost positive wherever there was production
        for (let i = 0; i < s.dataToiletsMonthlyLoan.length; i++) {
            const built = (s.dataToiletsMonthlyLoan[i] + s.dataToiletsMonthlyGrant[i])
                - (i > 0 ? s.dataToiletsMonthlyLoan[i - 1] + s.dataToiletsMonthlyGrant[i - 1] : 0);
            if (built > 0 && !(s.dataMonthlyUnitCost[i] > 0)) {
                v.push(`INV-6: production at M${i + 1} with unit cost ${s.dataMonthlyUnitCost[i]}`); break;
            }
        }

        // INV-7: no deflation when the inflation rate is non-negative
        if (inputs.inflationRate >= 0) {
            for (let i = 1; i < s.dataMonthlyInflationFactor.length; i++) {
                if (s.dataMonthlyInflationFactor[i] < s.dataMonthlyInflationFactor[i - 1] - 1e-12) {
                    v.push(`INV-7: inflation factor fell at M${i + 1}`); break;
                }
            }
        }

        // INV-9: the fund cannot repay more principal than it borrowed
        const repaid = s.dataMonthlyFundPrincipal.reduce((a, b) => a + b, 0);
        if (repaid > inputs.investLoan + TOL) {
            v.push(`INV-9: repaid $${repaid.toFixed(0)} exceeds loan $${inputs.investLoan.toFixed(0)}`);
        }

        // INV-10: the grant ledger may not go overdrawn
        const variableRate = (inputs.mgmtFeeRatio || 0) + (inputs.meCostRate || 0) + (inputs.contingencyRate || 0);
        const grantSpent = s.dataMonthlyGrantDisbursed.reduce((a, b) => a + b, 0) * (1 + variableRate);
        const grantAvailable = inputs.investGrant + s.dataMonthlyCarbonRevenue.reduce((a, b) => a + b, 0);
        if (grantSpent > grantAvailable + TOL) {
            v.push(`INV-10: grant ledger overdrawn — spent $${grantSpent.toFixed(0)} of $${grantAvailable.toFixed(0)}`);
        }

        // INV-11: write-offs are not cash. Rebuild net from its components; if a
        // write-off had leaked into the cash flow, this would not reconcile.
        for (let i = 0; i < s.dataMonthlyNet.length; i++) {
            const inflow = s.dataMonthlyRevenueHh[i] + s.dataMonthlyRevenueMe[i]
                + s.dataMonthlyRepaymentHh[i] + s.dataMonthlyRepaymentMe[i] + s.dataMonthlyCarbonRevenue[i];
            const outflow = s.dataMonthlyOps[i] + s.dataMonthlyFees[i] + s.dataMonthlyFundPrincipal[i]
                + s.dataMonthlyFundInt[i] + s.dataMonthlyNewLoansHhVal[i] + s.dataMonthlyNewLoansMeVal[i]
                + s.dataMonthlyGrantDisbursed[i];
            if (Math.abs(s.dataMonthlyNet[i] - (inflow - outflow)) > TOL) {
                v.push(`INV-11: net flow at M${i + 1} does not equal inflows - outflows`); break;
            }
        }

        // INV-13: a wound-up fund does not bill operating costs
        if (s.windUpMonth) {
            for (let i = s.windUpMonth; i < s.dataMonthlyOps.length; i++) {
                if (s.dataMonthlyOps[i] > TOL) {
                    v.push(`INV-13: ops billed at M${i + 1}, after wind-up at M${s.windUpMonth}`); break;
                }
            }
        }

        return { ok: v.length === 0, violations: v };
    },

    /**
     * Does the fund work? (R-10.2)
     * A failure here is NOT a bug — it is the model correctly telling you the
     * scenario does not stand up. It must be reported to the user on screen,
     * which is precisely what did not happen before (F-29).
     */
    checkViability(series, inputs, kpis) {
        const s = series;
        const issues = [];
        const TOL = 1000; // $1k

        // V1 — never insolvent
        const minCash = Math.min(...s.dataMonthlyCashBalance);
        if (minCash < 0) {
            const k = kpis && kpis.sustainability ? kpis.sustainability : null;
            const when = k && k.depletionMonth ? `from month ${k.depletionMonth}` : '';
            issues.push({
                code: 'INSOLVENT',
                text: `The fund runs out of cash ${when}, reaching -$${Math.abs(minCash).toLocaleString('en-US', { maximumFractionDigits: 0 })} at its worst.`
            });
        }

        // V2 — senior debt repaid in full
        if (inputs.investLoan > 0) {
            const repaid = s.dataMonthlyFundPrincipal.reduce((a, b) => a + b, 0);
            const shortfall = inputs.investLoan - repaid;
            if (shortfall > TOL) {
                issues.push({
                    code: 'DEBT_UNREPAID',
                    text: `Senior debt is not repaid in full: $${shortfall.toLocaleString('en-US', { maximumFractionDigits: 0 })} ` +
                        `of $${inputs.investLoan.toLocaleString('en-US')} outstanding ` +
                        `(${((1 - repaid / inputs.investLoan) * 100).toFixed(1)}% default).`
                });
            }
        }

        // V3 — no interest had to be rolled up because the fund could not pay it.
        // Distinct from V2: V2 is about principal never returned, this is about the
        // fund borrowing from its own lender to stay afloat. Reporting the raw sum of
        // all missed payments here would double-count what V2 already covers, since
        // missed interest capitalises into the liability rather than sitting apart.
        const capitalised = s.capitalisedInterest || 0;
        if (capitalised > TOL) {
            issues.push({
                code: 'INTEREST_CAPITALISED',
                text: `$${capitalised.toLocaleString('en-US', { maximumFractionDigits: 0 })} of investor interest could not ` +
                    `be paid when due and was added to the outstanding balance, increasing what the fund owes.`
            });
        }

        // V4 — operations cover themselves
        const oss = kpis && kpis.sustainability ? kpis.sustainability.oss : null;
        if (oss !== null && oss < 1.0) {
            issues.push({
                code: 'OSS_BELOW_1',
                text: `Operating self-sufficiency is ${(oss * 100).toFixed(0)}% — revenue does not cover operating costs, ` +
                    `so the fund is consuming its capital to run.`
            });
        }

        return { ok: issues.length === 0, issues };
    },

    /**
     * What would actually close a repayment shortfall? (replaces the auto-adjuster, F-04)
     *
     * Every candidate is TESTED by re-running the simulation, rather than asserted from
     * a rule of thumb. That matters: the old advisor told users to extend the repayment
     * term, which measurably makes repayment WORSE in this model (F-32). Advice about a
     * model should be derived from the model.
     *
     * Returns the options that work, best first. Applies nothing.
     */
    suggestSolvencyFix(inputs, shortfall) {
        const sim = (over) => {
            const t = { ...inputs, ...over, enableBreakEvenSolver: false, verify: false };
            const r = this.calculate(t);
            const repaid = r.series.dataMonthlyFundPrincipal.reduce((a, b) => a + b, 0);
            // Measure against the loan in THIS simulation. Raising investLoan and then
            // dividing by the original would report >100% repayment on a bigger debt.
            return {
                repaidPct: t.investLoan > 0 ? repaid / t.investLoan : 1,
                toilets: r.kpis.reach.toilets,
                viable: r.viability ? r.viability.ok : false
            };
        };

        const base = sim({});
        const candidates = [
            { label: 'Raise the household interest rate', field: 'loanInterestRate',
              values: [0.30, 0.40, 0.50, 0.60, 0.75], fmt: v => `${(v * 100).toFixed(0)}%` },
            { label: 'Reduce annual fixed operating cost', field: 'annualFixedOpsCost',
              values: [inputs.annualFixedOpsCost * 0.75, inputs.annualFixedOpsCost * 0.5, inputs.annualFixedOpsCost * 0.25],
              fmt: v => `$${Math.round(v).toLocaleString('en-US')}` },
            { label: 'Increase initial loan capital', field: 'investLoan',
              values: [inputs.investLoan * 1.25, inputs.investLoan * 1.5],
              fmt: v => `$${Math.round(v).toLocaleString('en-US')}` },
            { label: 'Shorten the household loan term', field: 'termHh',
              values: [3, 4], fmt: v => `${v} months` },
            { label: 'Reduce grant support', field: 'grantSupportPct',
              values: [inputs.grantSupportPct * 0.5, 0], fmt: v => `${(v * 100).toFixed(0)}%` },
        ];

        const options = [];
        for (const c of candidates) {
            for (const value of c.values) {
                const r = sim({ [c.field]: value });
                if (r.repaidPct > base.repaidPct + 0.01) {
                    options.push({
                        label: c.label, field: c.field, value, display: c.fmt(value),
                        repaidPct: r.repaidPct, toilets: r.toilets, fullyRepaid: r.repaidPct >= 0.999,
                        toiletDelta: r.toilets - base.toilets
                    });
                    if (r.repaidPct >= 0.999) break; // smallest sufficient change of this kind
                }
            }
        }
        options.sort((a, b) => b.repaidPct - a.repaidPct);

        return {
            shortfall,
            basePaidPct: base.repaidPct,
            options: options.slice(0, 4),
            noneWork: options.length === 0
        };
    },

    /** Route both verdicts to the user. The console is not a reporting channel. */
    reportVerification(integrity, viability) {
        if (typeof UI === 'undefined') return;

        if (!integrity.ok) {
            console.error('MODEL INTEGRITY CHECK FAILED:', integrity.violations);
            if (UI.showIntegrityError) UI.showIntegrityError(integrity.violations);
        } else if (UI.clearIntegrityError) {
            UI.clearIntegrityError();
        }

        if (UI.showViability) UI.showViability(viability);
    }
});
