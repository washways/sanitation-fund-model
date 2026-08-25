/**
 * kpis.js — part of the S5 structural split (ADR-0033). computeKPIs — flattens the raw monthly series into the KPI shape the UI and CSV export read.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 3 violations in this file (`totalInflows`, `initialCapital`, `investorCapitalRepaidPct`).
 * Recorded, not fixed, per docs/ROADMAP.md's S0 task. Run `npx eslint src/` before
 * committing; if this file's count goes up, that is a new defect, not baseline noise.
 */
Object.assign(ModelModule, {
    // --- Phase 67: Centralized KPI Logic (Single Source of Truth) ---
    computeKPIs(series, inputs) {
        const s = series;
        const last = s.dataMonthlyCashBalance.length - 1;

        // 1. Reach — derive from monthly final index (most accurate)
        const totalToilets = (s.dataToiletsMonthlyLoan[last] || 0) + (s.dataToiletsMonthlyGrant[last] || 0);
        const loanToilets = s.dataToiletsMonthlyLoan[last] || 0;
        const grantToilets = s.dataToiletsMonthlyGrant[last] || 0;

        const households = totalToilets; // 1 per HH
        const people = households * inputs.avgHHSize;
        // Fix: Use dataMonthlyMes for accurate count
        // ME count is carried continuously so attrition can be fractional (R-6.3);
        // floor it here, where it becomes a count a human reads.
        const mes = s.dataMonthlyMes && s.dataMonthlyMes.length > 0
            ? Math.floor(s.dataMonthlyMes[s.dataMonthlyMes.length - 1]) : 0;

        // 2. Portfolio & Financials (Aggregates)
        const totalLoansDisbursedHH = s.dataMonthlyNewLoansHhVal.reduce((a, b) => a + b, 0);
        const totalLoansDisbursedME = s.dataMonthlyNewLoansMeVal.reduce((a, b) => a + b, 0);
        const totalLoansDisbursed = totalLoansDisbursedHH + totalLoansDisbursedME;



        const totalGrantsVal = s.dataMonthlyGrantDisbursed ? s.dataMonthlyGrantDisbursed.reduce((a, b) => a + b, 0) : 0;
        const totalOpsFixed = s.dataMonthlyOps ? s.dataMonthlyOps.reduce((a, b) => a + b, 0) : 0;
        const totalOpsVar = s.dataMonthlyFees ? s.dataMonthlyFees.reduce((a, b) => a + b, 0) : 0;
        const totalOps = totalOpsFixed + totalOpsVar;

        const totalDefaults = (s.dataMonthlyDefaultsHh ? s.dataMonthlyDefaultsHh.reduce((a, b) => a + b, 0) : 0) +
            (s.dataMonthlyDefaultsMe ? s.dataMonthlyDefaultsMe.reduce((a, b) => a + b, 0) : 0);
        const totalFundInterest = s.dataMonthlyFundInt ? s.dataMonthlyFundInt.reduce((a, b) => a + b, 0) : 0;
        // P2: Economic Cost Metric
        const economicCostPerLatrine = totalToilets > 0 ? ((totalOps + totalDefaults + totalGrantsVal + totalFundInterest) / totalToilets) : 0;

        const totalRevenueInt = s.dataMonthlyRevenueHh.reduce((a, b) => a + b, 0) + s.dataMonthlyRevenueMe.reduce((a, b) => a + b, 0);
        const totalCarbonRevenue = s.dataMonthlyCarbonRevenue.reduce((a, b) => a + b, 0);
        const totalInflows = totalRevenueInt + totalCarbonRevenue; // Excluding Principal Repayment

        // 3. Balance Sheet Metrics (End of Period)
        const cashEnd = s.dataMonthlyCashBalance[last] || 0;
        const portfolioHH_End = s.dataMonthlyPortfolioHh[last] || 0;
        const portfolioME_End = s.dataMonthlyPortfolioMe[last] || 0;
        const portfolioOutstanding = portfolioHH_End + portfolioME_End;

        // Investor Liability
        // We track liability decrement in the loop, but for robustness, we reconstruct it:
        const totalRepaidPrincipal = s.dataMonthlyFundPrincipal.reduce((a, b) => a + b, 0);
        // Use the liability the loop actually tracked (R-4.5). Reconstructing it as
        // investLoan - repaid ignores interest that capitalised when the fund could not
        // pay, and therefore overstates net assets by the whole of the arrears (F-06).
        const investorLiabilityEnd = s.investorLiabilityEnd !== undefined
            ? Math.max(0, s.investorLiabilityEnd)
            : Math.max(0, inputs.investLoan - totalRepaidPrincipal);

        const netAssetsEnd = cashEnd + portfolioOutstanding - investorLiabilityEnd;
        const initialCapital = inputs.investGrant + inputs.investLoan;

        // Capital Preserved: User wants "Grant Equity Multiple" and "Investor Capital Repaid"
        // GrantEquityMultiple = NetAssetsEnd / InitialGrant
        const grantEquityMultiple = inputs.investGrant > 0 ? (netAssetsEnd / inputs.investGrant) : 0;

        // InvestorCapitalRepaid = TotalPrincipalRepaid / InitialLoan
        const investorCapitalRepaidPct = inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0;

        // 4. Sustainability Metrics
        // OSS = Operating Revenue / Operating Expenses
        // Operating Revenue = Interest + Fees (if separate) + Carbon
        // Operating Expenses = FixedOps + VariableOps (Mgmt+ME)
        const operatingRevenue = totalRevenueInt + totalCarbonRevenue;
        // Check if Fees are in Revenue?
        // Fees are deducted from LoanFund (Expense).
        // Interest is added to LoanFund (Revenue).
        // So yes.
        const operatingExpenses = totalOps;
        const ossRatio = operatingExpenses > 0 ? (operatingRevenue / operatingExpenses) : 0;

        // FSS = Total Revenue / Total Expenses (Including Finance & Default)
        // Total Expenses = Ops + Defaults + FundInterest
        const totalExpenses = operatingExpenses + totalDefaults + totalFundInterest;
        const fssRatio = totalExpenses > 0 ? (operatingRevenue / totalExpenses) : 0;


        // Depletion Year
        // Find first month where Cash < 0
        let firstInsolvencyIndex = -1;
        let monthsInsolvent = 0;
        for (let i = 0; i < s.dataMonthlyCashBalance.length; i++) {
            if (s.dataMonthlyCashBalance[i] < 0) {
                if (firstInsolvencyIndex === -1) firstInsolvencyIndex = i;
                monthsInsolvent++;
            }
        }

        // R-11 / F-28: keep the model's output numeric. A string union ("Sustainable"
        // vs "3.4") forces every consumer to special-case a sentinel, and cannot be
        // charted or compared. Formatting belongs at the render boundary.
        const depletionMonth = firstInsolvencyIndex === -1 ? null : firstInsolvencyIndex + 1;
        const isSustainable = depletionMonth === null;
        const depletionYear = isSustainable ? "Sustainable" : ((depletionMonth - 1) / 12).toFixed(1);

        // 5. Unit Economics
        // Cost / Latrine = Total Expenditure / Total Toilets
        // Expenditure = Loans Disbursed + Grant Subsidy + Ops + Defaults + Financing
        const totalExpenditure = totalLoansDisbursed + totalGrantsVal + totalOps + totalDefaults + totalFundInterest;
        const costPerLatrine = totalToilets > 0 ? (totalExpenditure / totalToilets) : 0;
        const effectiveCostPerLatrine = totalToilets > 0 ? (inputs.investGrant / totalToilets) : 0;
        const subsidyPerLatrine = totalToilets > 0 ? (totalGrantsVal / totalToilets) : 0;

        // 6. Impact Value (Phase 30)
        // Reconstruct Value Logic from Arrays or inputs
        // Value = (DALYs * Value) + (Carbon * Value) + (Hours * Value)

        // DALYs (Cumulative)
        const totalDalys = s.dataDalys && s.dataDalys.length > 0 ? s.dataDalys[s.dataDalys.length - 1] : 0;
        const totalValDalys = totalDalys * (inputs.dalyValue || 0);

        // Carbon
        // cumulativeCarbon is tracked in loop. Last value is Total?
        const totalCarbon = s.dataCarbon.length > 0 ? s.dataCarbon[s.dataCarbon.length - 1] : 0;
        const totalValCarbon = totalCarbon * (inputs.co2Value || 0);

        // Hours Saved (R-8.2) — sum the monthly array the loop already builds. The old
        // annual-snapshot formula omitted avgHHSize entirely and disagreed with the loop
        // by a factor of ~4.4 (F-07).
        const totalHoursSaved = s.dataMonthlyHoursSaved
            ? s.dataMonthlyHoursSaved.reduce((a, b) => a + b, 0) : 0;
        // Value of an hour of time saved (R-8.6, resolves Q2).
        //
        // Derived from the country's own income, not from a global constant. The old
        // code used a hardcoded $0.50 whose provenance nobody could reconstruct — the
        // source comment literally asked where it came from. It is very close to
        // Malawi's GNI per capita divided by a 2,080-hour working year ($1,020 / 2,080
        // = $0.49), so it was almost certainly a Malawi figure valued at the FULL wage
        // rate, hardcoded into a tool that models forty-odd countries.
        //
        // Two changes:
        //   1. Scale with `avgAnnualIncome`, which the model already collects from the
        //      World Bank GNI-per-capita indicator and previously never used (F-25).
        //   2. Apply a valuation factor. Standard practice in WASH and transport
        //      cost-benefit analysis is to value non-market time BELOW the market wage,
        //      because the hour saved is household time rather than forgone paid work.
        //      A factor of around 0.3 is the common convention; it is an input, so a
        //      programme with its own evidence can override it.
        //
        // NOTE FOR REVIEWERS: 0.3 is the conventional default, not a figure verified
        // against a specific current source. Confirm it against the WHO/World Bank
        // sanitation cost-benefit guidance your programme reports against before
        // publishing an SROI derived from it.
        const WORKING_HOURS_PER_YEAR = 2080; // 40h x 52 weeks
        const timeValueFactor = inputs.timeValueFactor !== undefined ? inputs.timeValueFactor : 0.30;
        const hourValueUsd = ((inputs.avgAnnualIncome || 0) / WORKING_HOURS_PER_YEAR) * timeValueFactor;
        const totalValHours = totalHoursSaved * hourValueUsd;

        // SROI is SOCIAL value only (R-8.4, decided 2026-08-20 — see ADR-0011).
        //
        // Two prior defects, both deliberate-looking and both wrong:
        //   - DALY value was computed, displayed prominently, and then silently
        //     EXCLUDED from the ratio, so the screen contradicted itself.
        //   - Ending cash was ADDED to the numerator, so a fund that hoarded capital
        //     and built nothing scored well on a *social* return measure.
        //
        // Financial performance is reported separately, as netAssets and
        // capitalPreservation below. Do not merge the two again.
        const totalSocialValue =
            totalValDalys
            + totalValHours
            + (totalCarbon * (inputs.co2Value || 0));

        const initialInv = inputs.investGrant + inputs.investLoan;
        const sroi = initialInv > 0 ? (totalSocialValue / initialInv) : 0;
        // The financial counterpart, reported alongside rather than folded in.
        const capitalPreservation = initialInv > 0 ? (netAssetsEnd / initialInv) : 0;


        const goal = inputs.popReqToilets || 1;
        const minCash = Math.min(...s.dataMonthlyCashBalance);

        let dominantConstraint = "Demand Met (Success)";
        if (monthsInsolvent > 0) dominantConstraint = "Capital Depleted (Insolvent)";
        else if (goal > people && minCash > 0) dominantConstraint = "Supply Chain (ME Capacity)";
        else if (goal > people) dominantConstraint = "Capital Limited";

        // F-14 / ADR-0028: a single flat, documented object. Six named groups, each a
        // direct property of the return value — never nested inside one another, never
        // mutated by a renderer. `UI.updateKPIs` used to destructure-and-reassign this
        // exact shape on every render; that made it non-idempotent (a second call
        // destructured an already-overwritten `impact`, so financials/sustainability/
        // portfolio/value all reset to `{}`) and created a hidden coupling — code that
        // read `kpis.financials.X` only worked because a render had already run and
        // mutated the object. Returning this shape directly means nothing downstream
        // needs to know that history.
        return {
            reach: {
                toilets: totalToilets,
                people: people,
                mes: mes,
                jobs: mes * 3,
                loanToilets: loanToilets,
                grantToilets: grantToilets,
                sdg6Gap: (people / goal),
                dominantConstraint: dominantConstraint
            },
            impact: {
                dalys: totalDalys,
                valDalys: totalValDalys,
                carbon: totalCarbon,
                valCarbon: totalValCarbon,
                valHours: totalValHours,
                hourValueUsd: hourValueUsd
            },
            portfolio: {
                disbursed: totalLoansDisbursed,
                outstanding: portfolioOutstanding,
                defaults: totalDefaults
            },
            financials: {
                cashEnd: cashEnd,
                netAssets: netAssetsEnd,
                grantEquityMultiple: grantEquityMultiple, // Replaces capitalPreserved
                investorRepaid: totalRepaidPrincipal,
                investorRepaidPct: inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0,
                grantsDisbursed: totalGrantsVal,
                leverage: inputs.investGrant > 0 ? (totalLoansDisbursed / inputs.investGrant) : 0,
                // Fund Health = (Ending Balance + Repaid Principal) / Initial Loan
                fundHealth: inputs.investLoan > 0 ? ((cashEnd + totalRepaidPrincipal) / inputs.investLoan) : 0
            },
            sustainability: {
                oss: ossRatio,
                fss: fssRatio,
                selfSufficiency: fssRatio, // Map FSS to Self-Sufficiency for UI
                // null means "not applicable", not "99 years" (F-28).
                opsRunway: (inputs.annualFixedOpsCost > 0) ? (cashEnd / inputs.annualFixedOpsCost) : null,
                depletionMonth: depletionMonth,
                isSustainable: isSustainable,
                depletionYear: depletionYear, // display string; prefer depletionMonth
                windUpMonth: s.windUpMonth !== undefined ? s.windUpMonth : null,
                arrearsInterest: s.accruedInvestorInt || 0,
                arrearsPrincipal: s.accruedInvestorPrin || 0,
                capitalisedInterest: s.capitalisedInterest || 0,
                investorLiabilityEnd: investorLiabilityEnd,
                monthsInsolvent: monthsInsolvent,
                costPerLatrine: costPerLatrine,
                effectiveCostPerLatrine: effectiveCostPerLatrine,
                // F-30: the month the grant ledger can no longer fund a full unit, or
                // null if it never runs out within the horizon.
                grantExhaustedMonth: s.grantExhaustedMonth !== undefined ? s.grantExhaustedMonth : null
            },
            // Value Metrics
            value: {
                socialValue: totalSocialValue,          // DALYs + time + carbon
                capitalPreservation: capitalPreservation, // netAssets / capital invested
                economicValue: totalSocialValue,        // social only — see ADR-0011
                subsidyPerLatrine,
                economicCostPerLatrine,
                depletionYear,
                sroi: sroi
            }
        };
    },
});
