/**
 * engine.js — part of the S5 structural split (ADR-0033). The core simulation: rate/annuity helpers and the month loop. Pure — no DOM, no browser globals — enforced by tests/purity.test.js.
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
        // Months of production an enterprise must finance before it is paid. The
        // floor is an input (Q18, ADR-0061); it was a hard-coded, unsourced 6.
        const reserveMonths = Math.max(inputs.meWorkingCapitalMonths || 0, inputs.termHh || 0);
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

    // One cash-aware senior-debt waterfall (ADR-0036, F-44/F-45). Keeping this
    // arithmetic in a pure helper makes the payment order directly testable instead
    // of asking an end-state KPI to prove that arrears were actually serviced.
    serviceInvestorDebt({
        loanCash,
        liability,
        accruedInterest,
        accruedPrincipal,
        currentInterest,
        scheduledPrincipal,
        acceleratePrincipal = false,
    }) {
        // Default only absent values. Deliberately let NaN propagate so INV-8 catches
        // corrupted inputs; `value || 0` would silently turn NaN into plausible zero.
        const nonNegative = value => value === null || value === undefined
            ? 0
            : Math.max(0, value);
        const openingLiability = nonNegative(liability);
        const interestArrearsDue = Math.min(
            nonNegative(accruedInterest),
            openingLiability
        );
        const originalPrincipalOutstanding = Math.max(0, openingLiability - interestArrearsDue);
        const regularPrincipalDue = nonNegative(scheduledPrincipal)
            + nonNegative(accruedPrincipal);
        const principalDue = acceleratePrincipal
            ? originalPrincipalOutstanding
            : Math.min(originalPrincipalOutstanding, regularPrincipalDue);

        let available = nonNegative(loanCash);
        const paidArrearsInterest = Math.min(interestArrearsDue, available);
        available -= paidArrearsInterest;

        const currentInterestDue = nonNegative(currentInterest);
        const paidCurrentInterest = Math.min(currentInterestDue, available);
        available -= paidCurrentInterest;

        const paidPrincipal = Math.min(principalDue, available);
        const missedCurrentInterest = currentInterestDue - paidCurrentInterest;
        const endingAccruedInterest = Math.max(
            0,
            interestArrearsDue - paidArrearsInterest + missedCurrentInterest
        );
        const endingAccruedPrincipal = Math.max(0, principalDue - paidPrincipal);
        const totalPaid = paidArrearsInterest + paidCurrentInterest + paidPrincipal;
        const endingLiability = Math.max(
            0,
            openingLiability - paidArrearsInterest - paidPrincipal + missedCurrentInterest
        );

        return {
            loanCash: loanCash - totalPaid,
            liability: endingLiability,
            accruedInterest: endingAccruedInterest,
            accruedPrincipal: endingAccruedPrincipal,
            paidArrearsInterest,
            paidCurrentInterest,
            paidPrincipal,
            missedCurrentInterest,
        };
    },

    // Pure input boundary (ADR-0037, F-46). These are mathematical and
    // definitional constraints only; policy judgements such as a maximum interest
    // rate or maximum programme cost deliberately do not belong here.
    validateInputs(inputs) {
        const labels = {
            investGrant: 'Initial Grant Capital',
            investLoan: 'Initial Loan Capital',
            duration: 'Duration',
            fundRepaymentTerm: 'Fund Repayment Term',
            investorGracePeriod: 'Investor Grace Period',
            fundCostOfCapital: 'Fund Cost of Capital',
            popReqToilets: 'Rural Population Without Basic Sanitation',
            popGrowthRate: 'Annual Population Growth',
            avgHHSize: 'Avg Household Size',
            avgToiletCost: 'Avg Toilet Cost',
            inflationRate: 'Annual Cost Escalation',
            districts: 'Administrative Units',
            mePerDistrict: 'Micro-enterprises per Unit',
            jobsPerMe: 'Jobs Supported per Active ME',
            toiletsPerMeMonth: 'Toilets per ME per Month',
            meSetupCost: 'ME Setup Cost',
            meWorkingCapitalMonths: 'ME Working-Capital Months',
            grantSupportPct: 'Grant-Funded Pacing',
            loanInterestRate: 'HH Loan Interest Rate',
            meLoanInterestRate: 'ME Loan Interest Rate',
            hhDefaultRate: 'HH Annual Write-down Rate',
            meDefaultRate: 'ME Annual Write-down Rate',
            meExitRate: 'ME Annual Closure Rate',
            meExpansionBudgetShare: 'ME Expansion Budget Share',
            meMaxMonthlyGrowthRate: 'ME Max Monthly Growth Rate',
            termHh: 'HH Loan Term',
            termMe: 'ME Loan Term',
            annualFixedOpsCost: 'Annual Fixed Ops Cost',
            mgmtFeeRatio: 'Mgmt Fee Ratio',
            meCostRate: 'M&E Cost',
            contingencyRate: 'Cost Contingency',
            initialMeNetworkShare: 'Initial ME Network Share',
            dalyPerPerson: 'Sanitation DALY Burden per Exposed Person',
            dalyImpactRealisation: 'Sanitation Health Effect',
            dalyValue: 'Value per DALY',
            avgAnnualIncome: 'Avg Annual Income',
            co2PerToilet: 'CO2e per Toilet',
            co2Value: 'Value per Tonne CO2e',
            carbonCreditShare: 'Fund Carbon Share',
            hoursPerPersonPerDay: 'Hours Saved per Person per Day',
            timeValueFactor: 'Value of Saved Time',
            toiletLifespanYears: 'Toilet Service Life',
        };
        const errors = [];
        const finite = key => Number.isFinite(inputs[key]);

        for (const [key, label] of Object.entries(labels)) {
            if (!finite(key)) errors.push(`${label} must be a finite number.`);
        }

        const requireWhenFinite = (keys, predicate, message) => {
            for (const key of keys) {
                if (finite(key) && !predicate(inputs[key])) {
                    errors.push(`${labels[key]} ${message}`);
                }
            }
        };

        requireWhenFinite([
            'investGrant', 'investLoan', 'fundRepaymentTerm', 'popReqToilets', 'districts',
            'mePerDistrict', 'jobsPerMe', 'toiletsPerMeMonth', 'meSetupCost', 'meWorkingCapitalMonths',
            'annualFixedOpsCost', 'mgmtFeeRatio', 'meCostRate',
            'contingencyRate', 'dalyPerPerson', 'dalyValue', 'avgAnnualIncome',
            'co2PerToilet', 'co2Value', 'meMaxMonthlyGrowthRate',
            'hoursPerPersonPerDay',
        ], value => value >= 0, 'cannot be negative.');

        requireWhenFinite([
            'duration', 'avgHHSize', 'avgToiletCost', 'termHh', 'termMe',
            'toiletLifespanYears',
        ], value => value > 0, 'must be greater than zero.');

        requireWhenFinite([
            'grantSupportPct', 'hhDefaultRate', 'meDefaultRate', 'meExitRate',
            'meExpansionBudgetShare', 'initialMeNetworkShare', 'carbonCreditShare',
            'timeValueFactor', 'dalyImpactRealisation',
        ], value => value >= 0 && value <= 1, 'must be between 0% and 100%.');

        requireWhenFinite([
            'popGrowthRate', 'inflationRate', 'loanInterestRate',
            'meLoanInterestRate', 'fundCostOfCapital',
        ], value => value > -1, 'must be greater than -100%.');

        requireWhenFinite([
            'districts', 'mePerDistrict', 'investorGracePeriod', 'termHh', 'termMe',
        ], Number.isInteger, 'must be a whole number.');

        if (finite('duration') && !Number.isInteger(inputs.duration * 12)) {
            errors.push('Duration must resolve to a whole number of months.');
        }
        if (finite('fundRepaymentTerm') && !Number.isInteger(inputs.fundRepaymentTerm * 12)) {
            errors.push('Fund Repayment Term must resolve to a whole number of months.');
        }
        if (finite('hoursPerPersonPerDay') && inputs.hoursPerPersonPerDay > 24) {
            errors.push('Hours Saved per Person per Day cannot exceed 24.');
        }
        if (finite('investorGracePeriod') && inputs.investorGracePeriod < 0) {
            errors.push('Investor Grace Period cannot be negative.');
        }
        if (finite('investLoan') && inputs.investLoan > 0
            && finite('fundRepaymentTerm') && !(inputs.fundRepaymentTerm > 0)) {
            errors.push('Fund Repayment Term must be greater than zero when Initial Loan Capital is positive.');
        }
        if (finite('investLoan') && inputs.investLoan > 0
            && finite('investorGracePeriod') && finite('fundRepaymentTerm')
            && inputs.investorGracePeriod > inputs.fundRepaymentTerm * 12) {
            errors.push('Investor Grace Period cannot exceed the Fund Repayment Term.');
        }

        return errors;
    },

    calculate(inputs) {
        const validationErrors = this.validateInputs(inputs);
        if (validationErrors.length > 0) {
            const error = new RangeError(`Invalid model inputs:\n- ${validationErrors.join('\n- ')}`);
            error.code = 'INVALID_INPUTS';
            error.validationErrors = validationErrors;
            throw error;
        }

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

        // Arrears (R-4.5). Unpaid interest capitalises into the liability; unpaid
        // principal stays in it by construction. These accumulators are the audit
        // trail of what was missed, not a place where money goes to disappear.
        let accruedInvestorInt = 0;
        let accruedInvestorPrin = 0;
        let capitalisedInterest = 0;
        let capitalisedInterestRepaid = 0;

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
        const annualWriteDownHh = inputs.hhDefaultRate ?? 0.05;
        const annualWriteDownMe = inputs.meDefaultRate ?? 0.10;

        // Cumulative Trackers
        let cumulativeCarbon = 0;
        let cumulativeDalys = 0;
        let dataDalys = [];
        // Accumulators (Audit)

        // --- Output Arrays ---
        const monthlyLabels = [];
        const dataMonthlyCashBalance = [];
        // F-66 / ADR-0057: the ledger that pays debt service and operations. Every
        // solvency verdict reads this, never the pooled balance above.
        const dataMonthlyLoanCash = [];
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
        const dataMonthlyInvestorLiability = [];
        const dataMonthlyInvestorInterestArrears = [];
        const dataMonthlyInvestorPrincipalArrears = [];
        const dataMonthlyNewLoansHhVal = [];
        const dataMonthlyNewLoansMeVal = [];
        const dataMonthlyNewMes = [];
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
        const dataMonthlyBacklog = [];

        // Audit & Unit Economics Arrays
        const dataMonthlyUnitCost = [];
        const dataMonthlyPerToiletPrincipal = [];
        const dataMonthlyPerToiletGrant = [];
        const dataMonthlyPerToiletOps = [];

        const dataConstraintBinding = [];
        const dataConstraintForegone = [];

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
        const dataJobs = []; // Active FTE jobs supported at each reporting date
        const dataCarbon = []; // Annual Snapshot

        // Sim Helpers
        let yearLoansHh = 0, yearLoansMe = 0, yearGrants = 0, yearRepayments = 0, yearDefaultsHh = 0, yearDefaultsMe = 0, yearDebtService = 0;

        // One reporting path for complete and partial years (F-52). Duration is
        // month-granular, so the final reporting period is not always 12 months.
        const recordAnnualPeriod = label => {
            labels.push(label);
            dataToilets.push(toiletsBuiltCumulative);
            dataPeople.push(toiletsBuiltCumulative * inputs.avgHHSize);
            dataJobs.push(Math.floor(currentMEs) * inputs.jobsPerMe);
            dataCarbon.push(cumulativeCarbon);
            dataDalys.push(cumulativeDalys);

            dataLoansHh.push(yearLoansHh);
            dataLoansMe.push(yearLoansMe);
            dataGrants.push(yearGrants);
            dataRepayments.push(yearRepayments);
            dataDefaultsHh.push(yearDefaultsHh);
            dataDefaultsMe.push(yearDefaultsMe);
            dataFundDebtService.push(yearDebtService);

            yearLoansHh = 0;
            yearLoansMe = 0;
            yearGrants = 0;
            yearRepayments = 0;
            yearDefaultsHh = 0;
            yearDefaultsMe = 0;
            yearDebtService = 0;
        };

        // Initial Startup (M0 Logic)
        // Assumption: ME Setup is a LOAN from LoanCash.
        let startLoanVolume = 0;
        let startMEs = 0;

        // Inputs are complete and finite after validateInputs(). Honor an explicit
        // zero capacity; `|| 20` silently restored the default and made a no-network
        // stress case look identical to the healthy Malawi scenario (F-50).
        const maxTotalMEs = inputs.districts * inputs.mePerDistrict; // Cap
        // R-6.1, ADR-0031: the SAME capital requirement decides both how many MEs the
        // fund can afford to start AND how big the loan it books for them is. Until
        // 2026-08-21 these were two different numbers (F-21) — the loan booked used
        // setup cost alone, 7.3x less than what this affordability check already knew
        // one ME actually costs.
        const startupCostPerMe = this.meCapitalRequirement(inputs);

        const affordableStartMEs = Math.floor(Math.max(0, loanCash) / startupCostPerMe);
        // F-54 / ADR-0047: month zero is a pilot, not an instantaneous cash-maximising
        // national rollout. `ceil` lets a positive share seed a small non-zero network;
        // an explicit zero remains zero and therefore disables later percentage growth.
        const targetStartMEs = inputs.initialMeNetworkShare === 0
            ? 0
            : Math.ceil(maxTotalMEs * inputs.initialMeNetworkShare);

        startMEs = Math.min(maxTotalMEs, affordableStartMEs, targetStartMEs);

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
            const probDefHh = 1 - Math.pow(1 - annualWriteDownHh, 1 / 12);
            const probDefMe = 1 - Math.pow(1 - annualWriteDownMe, 1 / 12);

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
            const isTerminalSettlement = windUpMonth === m;
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
            }

            // Old capitalised interest ranks first, followed by current interest and
            // then original principal. In the wind-up month all remaining original
            // principal becomes due, but no new interest accrues (ADR-0036).
            const debt = this.serviceInvestorDebt({
                loanCash,
                liability: loanFundLiability,
                accruedInterest: accruedInvestorInt,
                accruedPrincipal: accruedInvestorPrin,
                currentInterest: scheduledInt,
                scheduledPrincipal: scheduledPrin,
                acceleratePrincipal: isTerminalSettlement,
            });
            outflows.investInt = debt.paidArrearsInterest + debt.paidCurrentInterest;
            outflows.investPrin = debt.paidPrincipal;
            capitalisedInterest += debt.missedCurrentInterest;
            capitalisedInterestRepaid += debt.paidArrearsInterest;
            accruedInvestorInt = debt.accruedInterest;
            accruedInvestorPrin = debt.accruedPrincipal;
            loanCash = debt.loanCash;
            loanFundLiability = debt.liability;
            const debtService = outflows.investInt + outflows.investPrin;

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
            let newMes = 0;

            // R-7.1: grow the carried backlog before subtracting this month's
            // production. The previous implementation subtracted first and then
            // grew the remainder, understating demand by production * growth.
            backlogToilets *= (1 + monthlyPopGrowth);

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
                    // Whole enterprises only (R-2.5, F-68, ADR-0060). currentMEs is
                    // continuous after attrition; unfloored headroom relaunched
                    // fractions of an enterprise every month at the cap.
                    const space = Math.floor(maxTotalMEs - currentMEs);
                    newMes = Math.min(potentialNew, space);

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

            // R-7.6 / ADR-0044: explain the production decision with the same
            // quantities that produced it. Capacity and loan-capital losses form an
            // additive partition of whole-toilet demand less actual output. Grant
            // capital is an overlapping diagnostic: output recoverable if the
            // intended grant allocation were fully funded while loan capacity stayed
            // fixed. It must not be added to the other two fields.
            const demandUnits = Math.max(0, Math.floor(demand));
            const capacityUnits = Math.max(0, Math.floor(capacity));
            const plannedUnits = Math.min(demandUnits, capacityUnits);
            const capacityForegone = Math.max(0, demandUnits - plannedUnits);
            const loanCapitalForegone = Math.max(0, plannedUnits - production);
            const fullyFundedGrantTarget = Math.min(plannedUnits, Math.max(0, targetGrantCount));
            const safeLoanCapacity = Math.max(0, maxUnits);
            const outputWithFullGrantTarget = Math.min(
                plannedUnits,
                fullyFundedGrantTarget + safeLoanCapacity
            );
            const grantCapitalForegone = Math.max(0, outputWithFullGrantTarget - production);

            const bindingCauses = [];
            if (capacityForegone > 0) bindingCauses.push("Capacity");
            if (loanCapitalForegone > 0) bindingCauses.push("Loan Capital");
            if (grantCapitalForegone > 0) bindingCauses.push("Grant Capital");
            const constraint = bindingCauses.length === 0
                ? "Target Need"
                : bindingCauses.length === 1
                    ? bindingCauses[0]
                    : `Mixed: ${bindingCauses.join(" + ")}`;
            dataConstraintBinding.push(constraint);
            dataConstraintForegone.push({
                capacity: capacityForegone,
                loanCapital: loanCapitalForegone,
                grantCapital: grantCapitalForegone
            });

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
            const dalys = (creditingToilets * inputs.avgHHSize * inputs.dalyPerPerson
                * inputs.dalyImpactRealisation) / 12;

            cumulativeDalys += dalys;

            dataMonthlyHoursSaved.push(hours);
            dataMonthlyDalysAverted.push(dalys);
            dataMonthlyActiveToilets.push(toiletsBuiltCumulative);
            dataMonthlyCreditingToilets.push(creditingToilets);
            dataMonthlyBacklog.push(backlogToilets);

            // 10. Data Push
            const netFlow = (loanInflow + carbonRev) - (outflows.fixed + outflows.varFees + outflows.investPrin + outflows.investInt + outflows.loansHh + outflows.loansMe + outflows.grants);
            dataMonthlyNet.push(netFlow);
            dataMonthlyCashBalance.push(loanCash + grantCash);
            dataMonthlyLoanCash.push(loanCash);

            dataMonthlyGrantDisbursed.push(outflows.grants);
            dataMonthlyGrantCash.push(grantCash);
            dataMonthlyCarbonRevenue.push(inflows.carbon);
            dataMonthlyNewLoansHhVal.push(outflows.loansHh);
            dataMonthlyNewLoansMeVal.push(outflows.loansMe);
            dataMonthlyNewMes.push(newMes);
            dataMonthlyRevenueHh.push(inflows.hhInt);
            dataMonthlyRevenueMe.push(inflows.meInt);
            dataMonthlyRepaymentHh.push(inflows.hhPrin);
            dataMonthlyRepaymentMe.push(inflows.mePrin);
            dataMonthlyDefaultsHh.push(outflows.defaultsHh);
            dataMonthlyDefaultsMe.push(outflows.defaultsMe);
            dataMonthlyFundPrincipal.push(outflows.investPrin);
            dataMonthlyFundInt.push(outflows.investInt);
            dataMonthlyInvestorLiability.push(loanFundLiability);
            dataMonthlyInvestorInterestArrears.push(accruedInvestorInt);
            dataMonthlyInvestorPrincipalArrears.push(accruedInvestorPrin);
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
                recordAnnualPeriod(`Year ${currentYear}`);
            }
        } // End Loop

        const partialMonths = totalSimMonths % 12;
        if (partialMonths !== 0) {
            const partialYear = Math.ceil(totalSimMonths / 12);
            recordAnnualPeriod(`Year ${partialYear} (${partialMonths} months)`);
        }

        // --- Final Package ---
        const series = {
            monthlyLabels,
            labels,
            dataMonthlyCashBalance,
            dataMonthlyLoanCash,
            dataMonthlyNet,
            dataToilets,
            dataToiletsMonthlyGrant,
            dataToiletsMonthlyLoan,
            dataMonthlyGrantDisbursed,
            dataMonthlyCarbonRevenue,
            dataMonthlyNewLoansHhVal,
            dataMonthlyNewLoansMeVal,
            dataMonthlyNewMes,
            dataMonthlyRevenueHh,
            dataMonthlyRevenueMe,
            dataMonthlyRepaymentHh,
            dataMonthlyRepaymentMe,
            dataMonthlyDefaultsHh,
            dataMonthlyDefaultsMe,
            dataMonthlyFundPrincipal,
            dataMonthlyFundInt,
            dataMonthlyInvestorLiability,
            dataMonthlyInvestorInterestArrears,
            dataMonthlyInvestorPrincipalArrears,
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
            dataMonthlyBacklog,
            dataPeople,
            dataJobs,
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
            dataConstraintForegone,

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
            capitalisedInterestRepaid,
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
