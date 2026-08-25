/**
 * engine.js — part of the S5 structural split (ADR-0033). The core simulation: rate/annuity helpers and the month loop. Pure — no DOM, no browser globals — enforced by tests/purity.test.js.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 1 violation in this file (`constraints`). Recorded, not fixed, per
 * docs/ROADMAP.md's S0 task. Run `npx eslint src/` before committing; if this file's
 * count goes up, that is a new defect, not baseline noise.
 */
// --- Model Module (Dynamic Core) ---
const ModelModule = {
    // Helper: Geometric Monthly Rate
    getMonthlyRate(annualRate) {
        if (!annualRate) return 0;
        return Math.pow(1 + annualRate, 1 / 12) - 1;
    },

    // Helper: Annuity payment (MODEL_SPEC R-3.2)
    // The r === 0 branch is not optional: (P*0)/(1 - 1) is 0/0 = NaN, and NaN then
    // silently corrupts every downstream figure while passing every invariant check,
    // because NaN comparisons are always false. See finding F-03.
    annuityPayment(principal, monthlyRate, termMonths) {
        if (!(termMonths > 0)) return 0;
        if (!monthlyRate) return principal / termMonths;
        return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
    },

    // Helper: true capital requirement to establish one micro-enterprise (R-6.1).
    // Setup cost alone is not enough to start production — a business also needs
    // working capital to bridge the gap between disbursing and building (it isn't
    // paid for the toilets it builds until the loan or grant that funds them clears).
    // Sized on the BASE unit cost, not the inflated current one, matching the
    // original month-0 affordability formula this generalises (ADR-0031, F-21).
    //
    // Until 2026-08-21 the month-0 loan actually booked, and every in-loop expansion
    // loan, used setup cost alone — 7.3x less than this at the shipped defaults — so
    // the fund decided how many enterprises it could afford using this number, then
    // only lent them a seventh of it.
    meCapitalRequirement(inputs) {
        const reserveMonths = Math.max(6, inputs.termHh || 0);
        const workingCapital = (inputs.toiletsPerMeMonth || 0) * (inputs.avgToiletCost || 0) * reserveMonths;
        return (inputs.meSetupCost || 0) + workingCapital;
    },

    // Helper: Investor Repayment Schedule (MODEL_SPEC R-4.1)
    // Principal only. Interest is computed in the loop against the live liability,
    // which may have grown through capitalised arrears (R-4.5). Returning an
    // interest figure here as well would be a second, divergent source of truth.
    calculateInvestorSchedule(principal, termYears, graceMonths) {
        const schedule = [];
        const totalMonths = termYears * 12;
        const effectiveMonths = Math.max(1, totalMonths - graceMonths);

        // Flat principal amortisation over the post-grace months.
        const principalPmt = principal / effectiveMonths;

        let balance = principal;

        for (let m = 1; m <= totalMonths; m++) {
            let p = 0;
            if (m > graceMonths) {
                p = principalPmt;
            }
            // Ensure we don't overpay due to rounding
            if (p > balance) p = balance;

            balance -= p;

            schedule[m] = { principal: p, balance: balance };
        }
        return schedule;
    },

    calculate(inputs) {
        // --- 1. Configuration & Standardization ---
        const durationMonths = inputs.duration * 12;
        const totalSimMonths = durationMonths; // Hard cap at duration * 12
        const activeMonths = durationMonths;   // Winding-down zone if < totalSimMonths

        // Rates (Standardized Geometric)
        const getRate = (r) => this.getMonthlyRate(r);
        const monthlyIntRateHh = getRate(inputs.loanInterestRate);
        const monthlyIntRateMe = getRate(inputs.meLoanInterestRate !== undefined ? inputs.meLoanInterestRate : inputs.loanInterestRate);
        const monthlyCostOfCapital = getRate(inputs.fundCostOfCapital);

        // --- PRE-CALCULATION: Inflation & Unit Costs ---
        // 2026-02-11: Fixed to (1+rate)^(m/12)
        const inflationFactor = new Array(totalSimMonths + 1).fill(1.0);
        const unitCost = new Array(totalSimMonths + 1).fill(inputs.avgToiletCost);

        for (let m = 1; m <= totalSimMonths; m++) {
            // Compound Monthly: (1 + Annual)^ (m/12)
            inflationFactor[m] = Math.pow(1 + inputs.inflationRate, m / 12);
            unitCost[m] = inputs.avgToiletCost * inflationFactor[m];
        }

        // Terms
        const termHh = inputs.termHh || 6;
        const termMe = inputs.termMe || 12;

        // --- 2. Dual Ledger Initialization ---
        let grantCash = inputs.investGrant;     // Subsidy Fund (Grants, Carbon)
        let loanCash = inputs.investLoan;       // Revolving Fund (Lending, Ops, Repayment)

        // Liability
        let loanFundLiability = inputs.investLoan;

        // Investor Schedule (Pre-calc) — principal only, see R-4.1
        const investorSchedule = this.calculateInvestorSchedule(
            inputs.investLoan,
            inputs.fundRepaymentTerm,
            inputs.investorGracePeriod || 0
        );

        // Starting capacity throttle (R-6.1) — sizes the month-0 ME cohort only, and
        // does nothing after. Relabelled from "Liquidity Buffer" 2026-08-21 (F-10,
        // ADR-0027) — it is not the fund's ongoing solvency reserve; that is
        // `requiredReserves`, computed fresh every month below (R-5.4).
        // Already a decimal - converted once at the input boundary (R-2.3).
        const opsReserveRate = inputs.opsReserveCap !== undefined ? inputs.opsReserveCap : 0.15;
        const totalOpsReserve = (inputs.investGrant + inputs.investLoan) * opsReserveRate;
        let currentReserve = totalOpsReserve; // Simplified Reserve Logic

        // Arrears (R-4.5). Unpaid interest capitalises into the liability; unpaid
        // principal stays in it by construction. These accumulators are the audit
        // trail of what was missed, not a place where money goes to disappear.
        let accruedInvestorInt = 0;
        let accruedInvestorPrin = 0;
        let capitalisedInterest = 0;

        // Wind-up (R-9). Once the portfolio is empty, production has stopped and the
        // solvency gate is shut, the fund is finished. Without this the loop keeps
        // billing the collections floor forever against zero income, so "ending cash"
        // becomes a function of the horizon rather than of performance (F-31).
        let windUpMonth = null;
        let prevPortfolio = Infinity, prevProduction = -1, prevLendable = Infinity;

        // Portfolios & State
        let hhCohorts = [];
        let meCohorts = [];
        let currentMEs = 0;
        let toiletsBuiltCumulative = 0;
        let backlogToilets = inputs.popReqToilets / inputs.avgHHSize;

        // Toilet service life (R-8.5). Toilets are retired `toiletLifespanYears` after
        // construction and stop earning carbon credits from that point. We keep the
        // production history so retirement can be applied to the right vintages rather
        // than to an undifferentiated stock.
        const lifespanMonths = Math.max(1, Math.round((inputs.toiletLifespanYears || 5) * 12));
        const monthlyProduction = [];
        let retiredToiletsCumulative = 0;

        // Grant-fund runway (F-30). The month the grant ledger can no longer afford even
        // one more fully-burdened unit — reset to null if a later month affords one again
        // (carbon revenue can top the ledger back up), so this only holds once the fund is
        // truly, contiguously exhausted through to the end of the run.
        let grantExhaustedMonth = null;

        // Micro-enterprise attrition (R-6.3). Business closure and loan write-down are
        // DIFFERENT events — a business can close having repaid, and a loan can be
        // written down by a business that trades on — so they get separate parameters.
        // Modelling only the write-down left capacity untouched by enterprise failure
        // (F-20). Exit reduces capacity; it does not touch the loan cohorts, which
        // meDefaultRate already handles. Combining them would double-count.
        const monthlyMeExitRate = this.getMonthlyRate(inputs.meExitRate || 0) > 0
            ? 1 - Math.pow(1 - (inputs.meExitRate || 0), 1 / 12)
            : 0;
        // Demand grows with population (R-7.1). Without this the model shows the fund
        // closing a gap that is in fact widening (F-09).
        const monthlyPopGrowth = this.getMonthlyRate(inputs.popGrowthRate || 0);

        // Cumulative Trackers
        let cumulativeCarbon = 0;
        let cumulativeDalys = 0;
        let dataDalys = [];
        let constraints = { capital: 0, capacity: 0, demand: 0 };

        // Accumulators (Audit)

        // --- Output Arrays ---
        const monthlyLabels = [];
        const dataMonthlyCashBalance = [];
        const dataMonthlyNet = [];
        const dataMonthlyRevenueHh = [];
        const dataMonthlyRevenueMe = [];
        const dataMonthlyRepaymentHh = [];
        const dataMonthlyRepaymentMe = [];
        const dataMonthlyDefaultsHh = [];
        const dataMonthlyDefaultsMe = [];
        const dataMonthlyMes = [];
        const dataMonthlyOps = []; // Fixed
        const dataMonthlyFees = []; // Variable
        const dataMonthlyFundPrincipal = [];
        const dataMonthlyFundInt = [];
        const dataMonthlyNewLoansHhVal = [];
        const dataMonthlyNewLoansMeVal = [];
        const dataMonthlyGrantDisbursed = [];
        const dataMonthlyGrantCash = []; // F-30: the grant ledger's own running balance
        const dataMonthlyCarbonRevenue = [];
        const dataToiletsMonthlyLoan = [];
        const dataToiletsMonthlyGrant = [];
        const dataMonthlyPortfolioHh = [];
        const dataMonthlyPortfolioMe = [];

        // Impact AUC Arrays
        const dataMonthlyHoursSaved = [];
        const dataMonthlyDalysAverted = [];
        const dataMonthlyActiveToilets = [];
        const dataMonthlyCreditingToilets = [];

        // Audit & Unit Economics Arrays
        const dataMonthlyUnitCost = [];
        const dataMonthlyPerToiletPrincipal = [];
        const dataMonthlyPerToiletGrant = [];
        const dataMonthlyPerToiletOps = [];

        const dataConstraintBinding = [];

        // Audit & Reconciliation
        const dataMonthlyInflationFactor = [];
        const dataMonthlyBaseCost = [];
        const dataMonthlyContingencyAdd = [];
        const dataMonthlyInflatedCost = [];

        // Annual Aggregates (Layout placeholder)
        const labels = [];
        const dataToilets = [];
        const dataLoansHh = [];
        const dataLoansMe = [];
        const dataGrants = [];
        const dataRepayments = [];
        const dataDefaultsHh = [];
        const dataDefaultsMe = [];
        const dataFundDebtService = [];
        const dataPeople = []; // Annual Snapshot
        const dataCarbon = []; // Annual Snapshot

        // Sim Helpers
        let yearLoansHh = 0, yearLoansMe = 0, yearGrants = 0, yearRepayments = 0, yearDefaultsHh = 0, yearDefaultsMe = 0, yearDebtService = 0;

        // Initial Startup (M0 Logic)
        // Assumption: ME Setup is a LOAN from LoanCash.
        let startLoanVolume = 0;
        let startMEs = 0;

        const maxTotalMEs = inputs.districts * (inputs.mePerDistrict || 20); // Cap
        // R-6.1, ADR-0031: the SAME capital requirement decides both how many MEs the
        // fund can afford to start AND how big the loan it books for them is. Until
        // 2026-08-21 these were two different numbers (F-21) — the loan booked used
        // setup cost alone, 7.3x less than what this affordability check already knew
        // one ME actually costs.
        const startupCostPerMe = this.meCapitalRequirement(inputs);

        const lendableStart = Math.max(0, loanCash - currentReserve);
        const affordableStartMEs = Math.floor(lendableStart / startupCostPerMe);

        startMEs = Math.min(maxTotalMEs, affordableStartMEs); // Use Max Cap

        if (startMEs > 0) {
            startLoanVolume = startMEs * startupCostPerMe;
            loanCash -= startLoanVolume;
            currentMEs += startMEs;

            // Add to Cohort
            const pmt = this.annuityPayment(startLoanVolume, monthlyIntRateMe, termMe);
            meCohorts.push({ balance: startLoanVolume, monthlyPayment: pmt, termRemaining: termMe });
        }

        // Sim Loop
        for (let m = 1; m <= totalSimMonths; m++) {
            monthlyLabels.push(`M${m}`);
            const isWindingDown = m > activeMonths;
            const currentYear = Math.ceil(m / 12);

            // Retire toilets that have reached the end of their service life (R-8.5).
            // monthlyProduction[i] is what was built in month i+1.
            const retiringIndex = m - lifespanMonths - 1;
            if (retiringIndex >= 0 && monthlyProduction[retiringIndex] !== undefined) {
                retiredToiletsCumulative += monthlyProduction[retiringIndex];
            }

            // Micro-enterprises close (R-6.3). Continuous, so a fractional count is
            // carried; it is floored only where a count is displayed.
            if (monthlyMeExitRate > 0 && currentMEs > 0) {
                currentMEs = Math.max(0, currentMEs * (1 - monthlyMeExitRate));
            }

            // Wind-up test (R-9.1), evaluated at the START of the month against the
            // state carried from the previous one. Nothing left to collect, nothing
            // built, and no capital free to redeploy: the fund is finished. Testing it
            // here rather than at month end means the wind-up month itself is not
            // billed for operations.
            if (windUpMonth === null && m > 1
                && prevPortfolio < 1 && prevProduction === 0 && prevLendable <= 0) {
                windUpMonth = m;
            }

            // 1. Ledger Buckets
            const inflows = { hhInt: 0, hhPrin: 0, meInt: 0, mePrin: 0, carbon: 0 };
            const outflows = { fixed: 0, varFees: 0, investPrin: 0, investInt: 0, loansHh: 0, loansMe: 0, grants: 0, defaultsHh: 0, defaultsMe: 0 };

            // 2. Inflation & Unit Cost (Pre-Calculated)
            const currentInflationFactor = inflationFactor[m];
            const currentUnitCost = unitCost[m];

            // Audit
            dataMonthlyInflationFactor.push(currentInflationFactor);
            const baseCost = inputs.avgToiletCost;
            dataMonthlyBaseCost.push(baseCost);
            dataMonthlyInflatedCost.push(currentUnitCost);

            const currentFixedOps = (inputs.annualFixedOpsCost / 12) * currentInflationFactor;

            // Audit Track
            dataMonthlyUnitCost.push(currentUnitCost);

            // 3. Collect Revenues (Legacy Portfolios)
            // Monthly Default Prob (1 - (1-AnnualRate)^(1/12))
            const probDefHh = 1 - Math.pow(1 - (inputs.hhDefaultRate || 0.05), 1 / 12);
            const probDefMe = 1 - Math.pow(1 - (inputs.meDefaultRate || 0.10), 1 / 12);

            // Process HH
            hhCohorts = hhCohorts.filter(c => c.termRemaining > 0);
            hhCohorts.forEach(c => {
                const def = c.balance * probDefHh;
                outflows.defaultsHh += def;
                c.balance -= def; // Write-off

                const int = c.balance * monthlyIntRateHh;
                inflows.hhInt += int;

                let prin = 0;
                if (c.termRemaining === 1) prin = c.balance;
                else prin = Math.max(0, c.monthlyPayment - int);
                if (prin > c.balance) prin = c.balance;

                inflows.hhPrin += prin;
                c.balance -= prin;
                c.termRemaining--;
            });

            // Process ME
            meCohorts = meCohorts.filter(c => c.termRemaining > 0);
            meCohorts.forEach(c => {
                const def = c.balance * probDefMe;
                outflows.defaultsMe += def;
                c.balance -= def;

                const int = c.balance * monthlyIntRateMe;
                inflows.meInt += int;

                let prin = 0;
                if (c.termRemaining === 1) prin = c.balance;
                else prin = Math.max(0, c.monthlyPayment - int);
                if (prin > c.balance) prin = c.balance;

                inflows.mePrin += prin;
                c.balance -= prin;
                c.termRemaining--;
            });

            // 4. Update Ledgers (Inflows)
            // Rule: Interest & Principal -> LoanCash
            const loanInflow = inflows.hhInt + inflows.hhPrin + inflows.meInt + inflows.mePrin;
            loanCash += loanInflow;

            // 5. Outflows: Debt Service (R-4.3, R-4.4, R-4.5)
            //
            // Interest accrues from month 1 on the outstanding liability. A grace
            // period defers PRINCIPAL only — deferring interest as well silently
            // forgave it (F-06). Principal is still scheduled only after grace and
            // only within the repayment term.
            let scheduledPrin = 0;
            let scheduledInt = 0;
            // A wound-up fund is finished: the ledger is frozen (R-9.2), so no further
            // interest accrues or capitalises. Without this the liability compounds for
            // as long as the simulation happens to run, and net assets — unlike cash —
            // would still depend on the requested horizon, which is the whole defect
            // R-9 exists to remove (F-31).
            if (windUpMonth === null && loanFundLiability > 0) {
                scheduledInt = loanFundLiability * monthlyCostOfCapital;
                if (m <= inputs.fundRepaymentTerm * 12 && m > inputs.investorGracePeriod) {
                    scheduledPrin = investorSchedule[m]?.principal || 0;
                }
                // Catch up any principal the fund could not pay earlier, once it can.
                scheduledPrin += accruedInvestorPrin;
                if (scheduledPrin > loanFundLiability) scheduledPrin = loanFundLiability;
            }

            // Cash-aware: never pay out money the fund does not hold. Interest ranks
            // ahead of principal.
            const canPayDebt = Math.max(0, loanCash);
            const actualInt = Math.min(scheduledInt, canPayDebt);
            const actualPrin = Math.min(scheduledPrin, Math.max(0, canPayDebt - actualInt));
            outflows.investInt = actualInt;
            outflows.investPrin = actualPrin;

            // Unpaid interest CAPITALISES into the liability rather than evaporating.
            const missedInt = scheduledInt - actualInt;
            accruedInvestorPrin = Math.max(0, scheduledPrin - actualPrin);
            accruedInvestorInt += missedInt;
            capitalisedInterest += missedInt;

            loanCash -= (actualInt + actualPrin);
            loanFundLiability -= actualPrin;
            loanFundLiability += missedInt;
            const debtService = actualInt + actualPrin;

            // 6. Outflows: Operations (Survival floor if insolvent or winding down)
            // Suppressed entirely once the fund is wound up (R-9.2) — a dead fund with
            // no portfolio and no production does not employ a collections team.
            let opsCost = windUpMonth !== null ? 0 : currentFixedOps;
            if (windUpMonth === null && (isWindingDown || loanCash < 0)) {
                opsCost *= 0.3; // hibernation / collections floor
            }
            outflows.fixed = opsCost;
            loanCash -= opsCost;

            // 7. New Business (Lending & Grants)
            // Hard-stop solvency gate: only lend if cash exceeds reserve floor.
            //
            // R-5.4, F-10, ADR-0027: 3 months of the FULL fixed ops cost — not
            // `opsCost`, which is already cut to 30% during hibernation, so the buffer
            // must not shrink exactly when the fund is most fragile — plus the next 3
            // months of scheduled investor principal, so the fund does not lend away
            // cash it already knows it owes next quarter. The README has claimed this
            // debt-service lookahead existed since before the audit; it did not.
            const lookaheadPrincipal =
                (investorSchedule[m + 1]?.principal || 0) +
                (investorSchedule[m + 2]?.principal || 0) +
                (investorSchedule[m + 3]?.principal || 0);
            const requiredReserves = windUpMonth !== null
                ? 0
                : (currentFixedOps * 3) + lookaheadPrincipal;
            const solvent = (loanCash >= requiredReserves) && (grantCash >= 0);
            let lendable = solvent ? Math.max(0, loanCash - requiredReserves) : 0;
            if (isWindingDown) lendable = 0;

            let production = 0;
            let grantCount = 0;
            let loanCount = 0;
            let targetGrantCount = 0;

            // A. ME Expansion
            // Only if lendable > 0 and backlog > 0
            if (lendable > 0 && backlogToilets > 0) {
                // Basic growth logic (R-6.2). Both shares were hardcoded at 0.1 until
                // ADR-0019 exposed them as inputs, defaults unchanged.
                const expansionBudget = lendable * inputs.meExpansionBudgetShare;
                // R-6.1, ADR-0031: same capital requirement as month 0, not setup cost
                // alone — see meCapitalRequirement's own comment for why (F-21).
                const meSetup = ModelModule.meCapitalRequirement(inputs);
                if (expansionBudget > meSetup) {
                    const potentialNew = Math.min(Math.floor(expansionBudget / meSetup), Math.ceil(currentMEs * inputs.meMaxMonthlyGrowthRate));
                    // Check against Max Cap
                    const space = maxTotalMEs - currentMEs;
                    const newMes = Math.min(potentialNew, space);

                    if (newMes > 0) {
                        const cost = newMes * meSetup;
                        outflows.loansMe = cost;
                        loanCash -= cost;
                        lendable -= cost;
                        currentMEs += newMes;

                        // Schedule
                        const pmt = ModelModule.annuityPayment(cost, monthlyIntRateMe, termMe);
                        meCohorts.push({ balance: cost, monthlyPayment: pmt, termRemaining: termMe });
                    }
                }
            }


            // B. Toilets
            const capacity = currentMEs * inputs.toiletsPerMeMonth;

            // Fix: Include Contingency in Variable Rate (Cost Overrun / Mark-up)
            // variableRate now includes: Mgmt (2%) + ME Cost (2%) + Contingency (10%)
            const variableRate = inputs.mgmtFeeRatio + inputs.meCostRate + (inputs.contingencyRate || 0);

            // Audit Contingency Add (Just the Contingency Portion for Display)
            const contingencyAmt = currentUnitCost * (inputs.contingencyRate || 0);
            dataMonthlyContingencyAdd.push(contingencyAmt);

            // Note: variableMarkup includes Mgmt + ME + Contingency
            const variableMarkup = currentUnitCost * variableRate;
            const grossUnitCost = currentUnitCost + variableMarkup;

            // Affordability
            const maxUnits = Math.floor(lendable / grossUnitCost); // Loan Capacity

            // Audit ME Demand
            // Required MEs to clear backlog in e.g. 12 months? Or just instant?
            // "MEsComputedRequired" -> simple capacity check
            // If backlog is 1000, and capacity is 7/mo, needed = 1000/7.
            // But this changes every month.
            // Let's just log if Constraint was Capacity.
            let constraint = "Demand";
            const meCapacity = currentMEs * inputs.toiletsPerMeMonth;
            if (meCapacity < backlogToilets) constraint = "Capacity";
            if (maxUnits < backlogToilets && maxUnits < meCapacity) constraint = "Capital";
            dataConstraintBinding.push(constraint);

            // Carbon & Grant Capacity
            // Strategy: Check GrantCash for Subsidy
            // Grant Cost = GrossUnitCost (Fully Burdened)
            const maxGrants = Math.floor(grantCash / grossUnitCost);

            // F-30: grant-fund runway. See the declaration above for why this resets.
            if (maxGrants === 0) {
                if (grantExhaustedMonth === null) grantExhaustedMonth = m;
            } else {
                grantExhaustedMonth = null;
            }

            const demand = backlogToilets;
            production = Math.min(capacity, demand); // Tentative

            // Split
            targetGrantCount = Math.floor(production * inputs.grantSupportPct);
            grantCount = Math.min(targetGrantCount, maxGrants);

            // Remain is Loan
            let tentativeLoan = production - grantCount;
            // Cap Loan by Lendable
            loanCount = Math.min(tentativeLoan, maxUnits);

            // Final Production — enforce non-negative integers, cap to remaining backlog
            grantCount = Math.max(0, Math.floor(grantCount));
            loanCount = Math.max(0, Math.floor(loanCount));
            const remainingDemand = Math.max(0, Math.floor(backlogToilets));
            if (grantCount + loanCount > remainingDemand) {
                grantCount = Math.min(grantCount, remainingDemand);
                loanCount = Math.min(loanCount, Math.max(0, remainingDemand - grantCount));
            }
            production = grantCount + loanCount;

            if (production > 0) {
                // Disbursements
                const grantVal = grantCount * currentUnitCost;
                const loanVal = loanCount * currentUnitCost;

                outflows.grants = grantVal;
                outflows.loansHh = loanVal;

                // Fees
                const grantFees = grantVal * variableRate;
                const loanFees = loanVal * variableRate;
                outflows.varFees = grantFees + loanFees;

                // Deduct from Ledgers
                // Grant pays Grant
                if (grantVal > 0) grantCash -= (grantVal + grantFees);
                // Loan pays Loan
                if (loanVal > 0) loanCash -= (loanVal + loanFees);

                // Track
                toiletsBuiltCumulative += production;
                backlogToilets = Math.max(0, backlogToilets - production); // Never go below 0

                // Add HH Loan
                if (loanVal > 0) {
                    const pmt = ModelModule.annuityPayment(loanVal, monthlyIntRateHh, termHh);
                    hhCohorts.push({ balance: loanVal, monthlyPayment: pmt, termRemaining: termHh });
                }
            }

            monthlyProduction.push(production);

            // 8. Carbon Revenue (R-8.1)
            //
            // Accrues ANNUALLY against toilets still within their crediting life,
            // matching the input's label of "Tonnes/Yr". Previously the input was
            // divided by 1000 as if it were kilograms (F-33), the fund's share was
            // divided by 100 a second time having already been normalised (F-02), and
            // the credit was granted once at construction rather than each year the
            // toilet operates.
            //
            // Crediting stops after `toiletLifespanYears` (R-8.5). Carbon methodologies
            // issue credits over a finite crediting period, not in perpetuity, and a
            // toilet past its service life is not abating anything.
            const creditingToilets = toiletsBuiltCumulative - retiredToiletsCumulative;
            let carbonRev = 0;
            const newCarbonTons = (creditingToilets * inputs.co2PerToilet) / 12;

            if (inputs.co2PerToilet > 0) {
                carbonRev = newCarbonTons * inputs.co2Value * inputs.carbonCreditShare;
            }

            inflows.carbon = carbonRev;
            cumulativeCarbon += newCarbonTons;
            grantCash += carbonRev;

            // 9. Impact (Area Under Curve)
            //
            // Health and time benefits are gated by the same in-service count carbon
            // already uses (R-8.1) — a retired toilet stops averting DALYs and saving
            // time, same as it stops earning carbon credit. Resolves Q13, ADR-0025.
            // Was `toiletsBuiltCumulative` (every toilet ever built, retired or not),
            // which kept crediting health/time benefits forever after service life —
            // internally inconsistent with carbon's own accrual rule one line above.
            const hoursPerPersonPerDay = inputs.hoursPerPersonPerDay !== undefined
                ? inputs.hoursPerPersonPerDay : 0.25;
            const hours = creditingToilets * inputs.avgHHSize * hoursPerPersonPerDay * 30;
            const dalys = (creditingToilets * inputs.avgHHSize * inputs.dalyPerPerson) / 12;

            cumulativeDalys += dalys;

            dataMonthlyHoursSaved.push(hours);
            dataMonthlyDalysAverted.push(dalys);
            dataMonthlyActiveToilets.push(toiletsBuiltCumulative);
            dataMonthlyCreditingToilets.push(creditingToilets);

            // 10. Data Push
            const netFlow = (loanInflow + carbonRev) - (outflows.fixed + outflows.varFees + outflows.investPrin + outflows.investInt + outflows.loansHh + outflows.loansMe + outflows.grants);
            dataMonthlyNet.push(netFlow);
            dataMonthlyCashBalance.push(loanCash + grantCash);

            dataMonthlyGrantDisbursed.push(outflows.grants);
            dataMonthlyGrantCash.push(grantCash);
            dataMonthlyCarbonRevenue.push(inflows.carbon);
            dataMonthlyNewLoansHhVal.push(outflows.loansHh);
            dataMonthlyNewLoansMeVal.push(outflows.loansMe);
            dataMonthlyRevenueHh.push(inflows.hhInt);
            dataMonthlyRevenueMe.push(inflows.meInt);
            dataMonthlyRepaymentHh.push(inflows.hhPrin);
            dataMonthlyRepaymentMe.push(inflows.mePrin);
            dataMonthlyDefaultsHh.push(outflows.defaultsHh);
            dataMonthlyDefaultsMe.push(outflows.defaultsMe);
            dataMonthlyFundPrincipal.push(outflows.investPrin);
            dataMonthlyFundInt.push(outflows.investInt);
            dataMonthlyOps.push(outflows.fixed);
            dataMonthlyFees.push(outflows.varFees);

            // Audit: Unit Breakdown (Avoid NaN if production is 0)
            const unitPrincipal = production > 0 ? (outflows.loansHh / production) : 0;
            const unitGrant = production > 0 ? (outflows.grants / production) : 0;
            const unitOps = production > 0 ? ((outflows.fixed + outflows.varFees) / production) : 0;

            dataMonthlyPerToiletPrincipal.push(unitPrincipal);
            dataMonthlyPerToiletGrant.push(unitGrant);
            dataMonthlyPerToiletOps.push(unitOps);

            // Portfolio Snapshots
            const portfolioHhNow = hhCohorts.reduce((s, c) => s + c.balance, 0);
            const portfolioMeNow = meCohorts.reduce((s, c) => s + c.balance, 0);
            dataMonthlyPortfolioHh.push(portfolioHhNow);
            dataMonthlyPortfolioMe.push(portfolioMeNow);
            dataMonthlyMes.push(currentMEs);

            // Demand grows with population (R-7.1), net of what was just built.
            backlogToilets *= (1 + monthlyPopGrowth);

            // Carry this month's state forward for next month's wind-up test.
            prevPortfolio = portfolioHhNow + portfolioMeNow;
            prevProduction = production;
            prevLendable = lendable;

            // Cumulative Toilet Tracks
            const prevGrant = dataToiletsMonthlyGrant.length ? dataToiletsMonthlyGrant[dataToiletsMonthlyGrant.length - 1] : 0;
            const prevLoan = dataToiletsMonthlyLoan.length ? dataToiletsMonthlyLoan[dataToiletsMonthlyLoan.length - 1] : 0;
            dataToiletsMonthlyGrant.push(prevGrant + grantCount);
            dataToiletsMonthlyLoan.push(prevLoan + loanCount);

            // Annual Aggregation
            yearLoansHh += outflows.loansHh;
            yearLoansMe += outflows.loansMe;
            yearGrants += outflows.grants;
            yearRepayments += loanInflow; // Int+Prin
            yearDefaultsHh += outflows.defaultsHh;
            yearDefaultsMe += outflows.defaultsMe;
            yearDebtService += debtService;

            if (m % 12 === 0) {
                labels.push(`Year ${currentYear}`);
                dataToilets.push(toiletsBuiltCumulative);
                // Snapshot People for Legacy Charts (optional)
                dataPeople.push(toiletsBuiltCumulative * inputs.avgHHSize);
                dataCarbon.push(cumulativeCarbon);
                dataDalys.push(cumulativeDalys);

                dataLoansHh.push(yearLoansHh);
                dataLoansMe.push(yearLoansMe);
                dataGrants.push(yearGrants);
                dataRepayments.push(yearRepayments);
                dataDefaultsHh.push(yearDefaultsHh);
                dataDefaultsMe.push(yearDefaultsMe);
                dataFundDebtService.push(yearDebtService);

                // Reset
                yearLoansHh = 0; yearLoansMe = 0; yearGrants = 0; yearRepayments = 0; yearDefaultsHh = 0; yearDefaultsMe = 0; yearDebtService = 0;
            }
        } // End Loop

        // --- Final Package ---
        const series = {
            monthlyLabels,
            labels,
            dataMonthlyCashBalance,
            dataMonthlyNet,
            dataToilets,
            dataToiletsMonthlyGrant,
            dataToiletsMonthlyLoan,
            dataMonthlyGrantDisbursed,
            dataMonthlyCarbonRevenue,
            dataMonthlyNewLoansHhVal,
            dataMonthlyNewLoansMeVal,
            dataMonthlyRevenueHh,
            dataMonthlyRevenueMe,
            dataMonthlyRepaymentHh,
            dataMonthlyRepaymentMe,
            dataMonthlyDefaultsHh,
            dataMonthlyDefaultsMe,
            dataMonthlyFundPrincipal,
            dataMonthlyFundInt,
            dataMonthlyOps,
            dataMonthlyFees, // Variable Ops
            dataLoansHh,
            dataLoansMe,
            dataGrants,
            dataRepayments,
            dataDefaultsHh,
            dataDefaultsMe,
            dataFundDebtService,
            // Impact Arrays
            dataMonthlyHoursSaved,
            dataMonthlyDalysAverted,
            dataMonthlyActiveToilets,
            dataMonthlyCreditingToilets,
            dataPeople,
            dataMonthlyPortfolioHh,
            dataMonthlyPortfolioMe,
            dataMonthlyMes,
            dataCarbon,
            dataDalys,

            // Audit
            dataMonthlyUnitCost,
            dataMonthlyPerToiletPrincipal,
            dataMonthlyPerToiletGrant,
            dataMonthlyPerToiletOps,
            dataConstraintBinding,

            // New Audit Fields
            dataMonthlyInflationFactor,
            dataMonthlyBaseCost,
            dataMonthlyContingencyAdd,
            dataMonthlyInflatedCost,

            // Startup
            startupCost: startLoanVolume,
            startMEs: startMEs,

            // Cash-aware repayment audit
            accruedInvestorInt,
            accruedInvestorPrin,
            capitalisedInterest,
            investorLiabilityEnd: loanFundLiability,
            windUpMonth,

            // Grant-fund runway (F-30)
            dataMonthlyGrantCash,
            grantExhaustedMonth
        };

        const kpis = ModelModule.computeKPIs(series, inputs);

        // Two independent verdicts (R-10). They answer different questions and must
        // never be collapsed into one "model OK" indicator:
        //   integrity — is the arithmetic self-consistent?  (a defect in the model)
        //   viability — does the fund actually work?        (a finding about the scenario)
        // Previously only the first was computed, and it was reported in language that
        // implied the second: the shipped defaults print "Model Integrity Verified" for
        // a run that goes insolvent and defaults on $750k of senior debt (F-29).
        //
        // `verify` is its own flag. It used to be gated on enableBreakEvenSolver, so
        // turning off the solver silently turned off every guard in the model (F-11).
        let integrity = { ok: true, violations: [] };
        let viability = { ok: true, issues: [] };
        if (inputs.verify !== false) {
            integrity = ModelModule.checkIntegrity(series, inputs, kpis);
            viability = ModelModule.checkViability(series, inputs, kpis);
            ModelModule.reportVerification(integrity, viability);
        }

        // Output
        return { series, kpis, integrity, viability };
    },
};
