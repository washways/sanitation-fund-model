/**
 * Sanitation Revolving Fund Model App
 * Handles Logic, API Fetching, and UI Updates
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline, recorded 2026-08-21 when ESLint was first added: 15 no-unused-vars
 * violations plus 1 no-dupe-keys violation. The no-dupe-keys one was the duplicate
 * `downloadCSV` — a real bug (F-36), fixed the same day (ADR-0026), which is why it
 * is no longer in this list. The no-unused-vars ones are recorded, not fixed, per
 * docs/ROADMAP.md's S0 task: "do not fix findings while adding the linter — record
 * the count, ... remove the suppressions stage by stage."
 *
 * Do not add a new violation under this suppression. Run `npx eslint app.js` before
 * committing a change to this file; if the count goes up, that is a new defect, not
 * baseline noise. Removing this line (or narrowing it) is the exit criterion for
 * whichever findings it currently covers — see docs/ANALYSIS.md.
 */

// --- Global State ---
let chartInstances = {};

// Embedded Stakeholders Data (To avoid CORS issues with local file fetching)
const stakeholdersData = [
    { "type": "Informal Sector", "name": "Pit emptying operators", "role": "Manual desludging services", "scope": "Urban slums" },
    { "type": "Informal Sector", "name": "Village artisans", "role": "Latrine construction, minor repairs", "scope": "Rural" },
    { "type": "Microbusiness", "name": "Sanitation kiosk operators", "role": "Sell soap, hygiene products", "scope": "Peri-urban" },
    { "type": "Microbusiness", "name": "Toilet builders (solo)", "role": "Build basic toilets", "scope": "Urban/rural" },
    { "type": "SME", "name": "Skyloos Ltd", "role": "Eco-toilet manufacturing", "scope": "National" },
    { "type": "SME", "name": "Sanitation products distributor", "role": "Distribution of slabs, cement, pipes", "scope": "National" },
    { "type": "Regulator", "name": "Reserve Bank of Malawi", "role": "Regulates MFIs and banks", "scope": "National" },
    { "type": "Regulator", "name": "Malawi Microfinance Network (MAMN)", "website": "https://www.facebook.com/people/Malawi-Microfinance-Network-MAMN/100095180764740/", "role": "Umbrella body for MFIs", "scope": "National" },
    { "type": "MFI", "name": "Malawi Rural Finance Company", "role": "", "scope": "Rural" },
    { "type": "MFI", "name": "NEEF", "website": "https://www.neef.mw/about/", "scope": "National" },
    { "type": "MFI", "name": "Mzinda SACCO", "scope": "Urban" },
    { "type": "MFI", "name": "Saile Financial Services Ltd", "website": "https://sailefinancialservices.mw/", "scope": "Regional (Mzuzu)" },
    { "type": "MFI", "name": "FINCA Malawi", "website": "https://finca.mw/", "scope": "National" },
    { "type": "MFI", "name": "VisionFund Malawi", "website": "https://www.visionfund.org/where-we-work/africa/malawi", "scope": "National" },
    { "type": "MFI", "name": "CUMO Microfinance", "scope": "Rural Malawi" },
    { "type": "Commercial Bank", "name": "National Bank of Malawi", "website": "https://www.natbank.co.mw/", "scope": "National" },
    { "type": "Commercial Bank", "name": "Standard Bank Malawi", "website": "https://www.standardbank.co.mw/", "scope": "National" },
    { "type": "Commercial Bank", "name": "FDH Bank", "website": "https://www.fdh.co.mw/", "scope": "National" },
    { "type": "Commercial Bank", "name": "NBS Bank", "website": "https://www.nbsmw.com/", "scope": "National" },
    { "type": "Commercial Bank", "name": "First Capital Bank Malawi", "website": "https://www.firstcapitalbank.co.mw/", "scope": "National" },
    { "type": "Commercial Bank", "name": "CDH Investment Bank", "website": "https://www.cdh-malawi.com/", "scope": "National" },
    { "type": "Commercial Bank", "name": "Ecobank Malawi", "website": "https://ecobank.com/mw", "scope": "National" },
    { "type": "Commercial Bank", "name": "MyBucks Banking Corporation", "website": "https://www.mybucksbanking.mw/", "scope": "National" },
    { "type": "Regional Bank", "name": "ABSA Bank Limited", "website": "https://www.absa.africa/", "scope": "South Africa" },
    { "type": "Regional Bank", "name": "Nedbank Limited", "website": "https://www.nedbank.co.za/", "scope": "South Africa" },
    { "type": "Regional Bank", "name": "FirstRand Bank Ltd", "website": "https://www.firstrand.co.za/", "scope": "South Africa" },
    { "type": "Regional Bank", "name": "Standard Bank Group", "website": "https://www.standardbank.com/", "scope": "South Africa" },
    { "type": "Impact Fund", "name": "Old Mutual Alternative Investments", "website": "https://aiimafrica.com/", "scope": "South Africa" },
    { "type": "Impact Fund", "name": "Khanyisa Impact Investment Fund (STANLIB)", "website": "https://stanlib.com/", "scope": "South Africa" },
    { "type": "Impact Fund", "name": "Impact Capital Africa (ICA)", "website": "https://impactcapafrica.com/", "scope": "Southern Africa" },
    { "type": "Impact Fund", "name": "Fund for Export Development in Africa (FEDA)", "website": "https://feda.africa/", "scope": "Africa" },
    { "type": "Impact Fund", "name": "Africa Impact Ventures", "website": "https://www.aiventures.co/", "scope": "Africa" }
];

// --- API Module ---
const ApiModule = {
    indicators: {
        ruralPop: 'SP.RUR.TOTL',
        basicSanitation: 'SH.STA.BASS.RU.ZS',
        safelyManaged: 'SH.STA.SMSS.RU.ZS',
        gdpPerCapita: 'NY.GDP.PCAP.CD',
        gniPerCapita: 'NY.GNP.PCAP.CD', // Added GNI
        inflation: 'FP.CPI.TOTL.ZG',
        popGrowth: 'SP.POP.GROW',
        lendingRate: 'FR.INR.LEND',
        gini: 'SI.POV.GINI',
        poverty: 'SI.POV.DDAY', // Poverty headcount ratio at $2.15 a day (2017 PPP) (% of population)
        politicalStability: 'PV.EST' // Political Stability and Absence of Violence/Terrorism (Estimate, 0-100 Rank)
    },

    async fetchData(countryCode) {
        const baseUrl = 'https://api.worldbank.org/v2/country';
        const format = 'format=json';

        const fetchIndicator = async (ind) => {
            try {
                // Fetch last 5 years (MRV=5) to handle patchy data (like Governance)
                const url = `${baseUrl}/${countryCode}/indicator/${ind}?${format}&MRV=5`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && data[1] && data[1].length > 0) {
                    // Loop through results to find the first non-null value
                    const validRecord = data[1].find(r => r.value !== null);
                    return validRecord ? validRecord.value : null;
                }
                return null;
            } catch (e) {
                console.error(`Error fetching ${ind}`, e);
                return null;
            }
        };

        const [pop, basicSan, safeSan, gdp, gni, inflation, popGrowth, lendingRate, gini, poverty, politicalStability] = await Promise.all([
            fetchIndicator(this.indicators.ruralPop),
            fetchIndicator(this.indicators.basicSanitation),
            fetchIndicator(this.indicators.safelyManaged),
            fetchIndicator(this.indicators.gdpPerCapita),
            fetchIndicator(this.indicators.gniPerCapita),
            fetchIndicator(this.indicators.inflation),
            fetchIndicator(this.indicators.popGrowth),
            fetchIndicator(this.indicators.lendingRate),
            fetchIndicator(this.indicators.gini),
            fetchIndicator(this.indicators.poverty),
            fetchIndicator(this.indicators.politicalStability)
        ]);

        return { pop, basicSan, safeSan, gdp, gni, inflation, popGrowth, lendingRate, gini, poverty, politicalStability };
    },

    async fetchStates(countryName) {
        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: countryName })
            });
            const data = await res.json();
            if (data && data.data && data.data.states) {
                return data.data.states;
            }
            return [];
        } catch (e) {
            console.error("Error fetching states", e);
            return [];
        }
    }
};

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

    // --- Numeric Solver for Break-Even Interest ---
    solveBreakEven(inputs) {
        // Binary Search for Rate (0% to 150%)
        let low = 0;
        let high = 1.50; // 150%
        let bestRate = high;
        const iterations = 10; // Precision trade-off
        const targetNetAssets = 0;

        // Use structuredClone for deep copy (Safe)
        const simInputs = structuredClone(inputs);
        // Sub-simulations: no recursion into the solvers, and no verification noise.
        // These are now separate flags — overloading one to mean both is finding F-11.
        simInputs.enableBreakEvenSolver = false;
        simInputs.verify = false;

        for (let i = 0; i < iterations; i++) {
            const mid = (low + high) / 2;
            simInputs.loanInterestRate = mid; // Decimal

            // Run Light Simulation 
            const res = this.calculate(simInputs);
            const kpi = res.kpis;

            // Objective: Net Assets >= 0 
            // Note: If Net Assets > 0, we can lower the interest rate?
            // Yes, we want the LOWEST rate that sustains the fund.
            if (kpi.financials.netAssets >= targetNetAssets) {
                bestRate = mid;
                high = mid; // Try lower
            } else {
                low = mid; // Need higher
            }
        }
        if (this.calculate({ ...simInputs, loanInterestRate: bestRate }).kpis.financials.netAssets >= targetNetAssets) {
            return bestRate;
        } else {
            console.warn("Solver failed: No break-even rate found.");
            return null; // Return null if even max rate fails
        }
    },

    // New Solver for Max Sustainable Grant Support %
    solveMaxGrant(inputs) {
        let low = 0;
        let high = 1.0; // 100%
        let bestPct = 0;
        const iterations = 10;
        const targetNetAssets = 0;

        const simInputs = structuredClone(inputs);
        simInputs.enableBreakEvenSolver = false;
        simInputs.verify = false;

        for (let i = 0; i < iterations; i++) {
            const mid = (low + high) / 2;
            simInputs.grantSupportPct = mid;

            const res = this.calculate(simInputs);
            const kpi = res.kpis;

            // Objective: Maximize Grant while solving NetAssets >= 0
            if (kpi.financials.netAssets >= targetNetAssets) {
                bestPct = mid;
                low = mid; // Try higher
            } else {
                high = mid; // Too aggressive
            }
        }
        return bestPct;
    },

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
};


// --- UI Module ---
const UI = {
    getInputs() {
        const getRaw = (id, defaultVal = 0) => {
            const el = document.getElementById(id);
            if (!el) return defaultVal;
            // Strip commas and currency symbols
            const val = el.value.replace(/,/g, '').replace(/\$/g, '');
            const parsed = parseFloat(val);
            return isNaN(parsed) ? defaultVal : parsed;
        };
        /**
         * Every rate is entered as a PERCENTAGE and converted to a decimal here,
         * exactly once (MODEL_SPEC R-2.3). Nothing downstream may guess at units.
         *
         * This replaces two heuristics that contradicted each other about the same
         * DOM node - getInputs divided anything above 1 by 100, updateSmartRates
         * multiplied anything below 1 by 100 - which made 100% ambiguous and any
         * rate above 100% unrepresentable: a user modelling 150% inflation, entirely
         * plausible in the countries this tool targets, silently got 1.5%. See F-17.
         *
         * @param id   element id
         * @param def  default IN PERCENT (e.g. 5 means 5%)
         */
        const getPercent = (id, def = 0) => getRaw(id, def) / 100;

        return {
            country: document.getElementById('countryInput').value || 'Unknown',
            investGrant: getRaw('wiz-invest-grant-sidebar'),
            investLoan: getRaw('wiz-invest-loan-sidebar'),
            popReqToilets: getRaw('popReqToilets'),
            popGrowthRate: getPercent('popGrowthRate', 0),
            avgHHSize: getRaw('avgHHSize', 5),
            grantSupportPct: getPercent('grantSupportPct', 20), // Default 0.20
            avgToiletCost: getRaw('avgToiletCost', 50),
            districts: getRaw('districts'),
            mePerDistrict: getRaw('mePerDistrict'),
            toiletsPerMeMonth: getRaw('toiletsPerMeMonth'),
            meSetupCost: getRaw('meSetupCost'),
            loanInterestRate: getPercent('loanInterestRate_v2', 10),
            meLoanInterestRate: getPercent('meLoanInterestRate_v2', 10),
            hhDefaultRate: getPercent('hhDefaultRate', 5),
            meDefaultRate: getPercent('meDefaultRate', 5),
            // Business closure, distinct from loan write-down — see R-6.3.
            meExitRate: getPercent('meExitRate', 10),
            // In-loop ME expansion pacing (R-6.2). Both were hardcoded 0.1 until
            // ADR-0019; defaults unchanged.
            meExpansionBudgetShare: getPercent('meExpansionBudgetShare', 10),
            meMaxMonthlyGrowthRate: getPercent('meMaxMonthlyGrowthRate', 10),
            mgmtFeeRatio: getPercent('mgmtFeeRatio', 2),
            inflationRate: getPercent('inflationRate', 0),
            contingencyRate: getPercent('contingencyRate', 5),
            opsReserveCap: getPercent('opsReserveCap', 15),
            annualFixedOpsCost: getRaw('annualFixedOpsCost', 50000),
            meCostRate: getPercent('meCostRate', 5),
            fundCostOfCapital: getPercent('fundCostOfCapital', 2),
            fundRepaymentTerm: getRaw('fundRepaymentTerm'),
            termHh: getRaw('termHh', 12),
            termMe: getRaw('termMe', 24),
            // Impact
            dalyPerPerson: getRaw('dalyPerPerson', 0.005),
            dalyValue: getRaw('dalyValue', 500),
            avgAnnualIncome: getRaw('avgAnnualIncome', 1500),
            co2PerToilet: getRaw('co2PerToilet', 0.2),
            co2Value: getRaw('co2Value', 50),
            carbonCreditShare: getPercent('carbonCreditShare', 100), // 100% -> 1.0
            // Optimization Flags
            enableBreakEvenSolver: true,
            verify: true,
            investorGracePeriod: getRaw('investorGracePeriod', 6), // New Input
            duration: getRaw('wiz-duration-sidebar', 10),
            // Hours saved per person per day (R-8.2). Was a hardcoded 0.25 buried in
            // two conflicting formulas; now a single named assumption.
            hoursPerPersonPerDay: getRaw('hoursPerPersonPerDay', 0.25),
            // Share of the market wage at which saved household time is valued (R-8.6).
            timeValueFactor: getPercent('timeValueFactor', 30),
            // Service life; carbon crediting stops after this (R-8.5).
            toiletLifespanYears: getRaw('toiletLifespanYears', 5)
        };
    },

    // --- Initialization ---
    init() {
        // Capture Default Values for Auto-Reset
        UI.defaultValues = {};
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(el => {
            if (el.id) UI.defaultValues[el.id] = el.value;
        });

        // Use slightly delayed init to ensure DOM is ready
        setTimeout(() => {
            // Check for saved scenario or just run defaults
            if (UI.lastApiData) {
                // If we have API data in memory (unlikely on fresh load, but good practice), re-run
            } else {
                runCalculation();
            }
        }, 100);
    },

    updateKPIs(results) {
        if (!results) return;

        const inputs = UI.getInputs();
        const k = results.kpis;
        if (!k) return;

        // kpis structure (F-14 / ADR-0028): { reach, impact, portfolio, financials,
        // sustainability, value } — six flat, documented groups. computeKPIs returns
        // this shape directly; nothing here mutates it any more.

        // Helpers
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const fmtVal = (num) => (num || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const fmtValMoney = (count, val) => {
            if (val !== undefined) return `${fmtVal(count)} (${fmtMoney(val)})`;
            return fmtVal(count);
        };
        const fmtPct = (val) => ((val || 0) * 100).toFixed(1) + '%';
        const fmtNum = (val) => (val || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

        // Show what the time-value factor actually resolves to, so the number in the
        // SROI is visible rather than implied (R-8.6).
        const hourHelp = document.getElementById('hour-value-help');
        if (hourHelp && k.impact && k.impact.hourValueUsd !== undefined) {
            hourHelp.innerText = `= $${k.impact.hourValueUsd.toFixed(3)}/hour, from ` +
                `$${(inputs.avgAnnualIncome || 0).toLocaleString('en-US')} income over a 2,080-hour year.`;
        }

        // Grant-fund runway (F-30). Grant Support % paces subsidy; it does not set the
        // total. This makes the actual constraint — how long the grant capital lasts —
        // visible next to the dial, instead of only discoverable by reading the code.
        const runwayHelp = document.getElementById('grant-runway-help');
        if (runwayHelp && k.sustainability) {
            const exhaustedMonth = k.sustainability.grantExhaustedMonth;
            runwayHelp.innerText = exhaustedMonth
                ? `Grant capital runs out around month ${exhaustedMonth} at this pace — total subsidy is set by ` +
                  `Initial Grant Capital, not by this %.`
                : `Grant capital lasts the full run at this pace.`;
        }

        try {
            // --- Reach Card ---
            setText('sum-toilets', fmtVal(k.reach.toilets));
            setText('sum-toilets-loan-count', fmtVal(k.reach.loanToilets));
            setText('sum-toilets-loan-val', fmtMoney(k.portfolio.disbursed));

            setText('sum-toilets-grant-count', fmtVal(k.reach.grantToilets));
            setText('sum-toilets-grant-val', fmtMoney(k.financials.grantsDisbursed));

            setText('sum-households', fmtVal(k.reach.toilets));
            setText('sum-people', fmtVal(k.reach.people));
            setText('sum-mes', fmtVal(k.reach.mes));

            // New Phase 22: SDG6
            if (k.reach.sdg6Gap !== undefined) {
                setText('sum-sdg6', fmtPct(k.reach.sdg6Gap));
            }
            setText('sum-constraint', k.reach.dominantConstraint || '--');


            // --- Impact Card ---
            if (k.impact) {
                setText('sum-dalys', fmtVal(k.impact.dalys));
                setText('sum-val-dalys', fmtMoney(k.impact.valDalys));
                setText('sum-carbon', fmtNum(k.impact.carbon));
                setText('sum-val-carbon', fmtMoney(k.impact.valCarbon));
                setText('sum-jobs', fmtVal(k.reach.jobs)); // Jobs is in Reach now
                setText('sum-val-jobs', fmtMoney(k.impact.valHours)); // Time savings value
            }

            // --- Sustainability Scorecard ---

            // Liquidity / Export Stats Population
            const sData = results.series.dataMonthlyCashBalance || [];
            const minCash = sData.length ? Math.min(...sData) : 0;
            const insolvencyMonths = k.sustainability.monthsInsolvent;
            const isInsolvent = minCash < 0;

            // Store Summary Stats for Export (Already standardized in computeKPIs, but useful for Reference)
            UI.lastSummaryStats = {
                totalLatrines: k.reach.toilets,
                loanToilets: k.reach.loanToilets,
                grantToilets: k.reach.grantToilets,
                households: k.reach.toilets, // Assuming households = toilets for now
                people: k.reach.people,
                mes: k.reach.mes,
                dalys: k.impact ? k.impact.dalys.toFixed(0) : 0,
                economicValue: k.impact ? k.impact.valDalys.toFixed(0) : 0,
                carbon: k.impact ? k.impact.carbon.toFixed(1) : 0,
                jobs: k.reach ? k.reach.jobs.toFixed(0) : 0,
                ossRatio: k.sustainability.oss,
                minCash: minCash,
                insolvencyMonths: insolvencyMonths,
                fundBalance: k.financials.cashEnd
            };

            // OSS Display
            const oss = (k.sustainability.oss || 0) * 100;
            const ossEl = document.getElementById('sus-oss-ratio');
            if (ossEl) {
                if (isInsolvent) {
                    ossEl.innerText = "Insolvent (0%)";
                    ossEl.style.color = "#ef4444";
                    ossEl.title = "Fund runs out of cash. OSS is invalid.";
                } else {
                    ossEl.innerText = oss.toFixed(1) + '%';
                    ossEl.style.color = oss >= 100 ? '#22c55e' : '#ef4444';
                    ossEl.title = "";
                }
            }

            setText('sus-depletion', k.sustainability.depletionYear || "Sustainable");

            // Breakeven / Max Grant (Placeholders for now)
            const beRate = (results.breakEvenRate || 0) * 100;
            setText('sus-breakeven-rate', beRate > 0 ? beRate.toFixed(1) + '%' : 'N/A');

            const maxGrant = (results.maxGrantPct || 0);
            setText('sus-max-grant', maxGrant > 0 ? maxGrant.toFixed(1) + '%' : '0%');

            // --- Liquidity ---
            setText('sum-min-cash', fmtMoney(minCash));
            const mcEl = document.getElementById('sum-min-cash');
            if (mcEl) mcEl.style.color = minCash < 0 ? '#ef4444' : 'inherit';
            setText('sum-insolvency', insolvencyMonths + " Mo");

            // --- Fund Balance (Capital Card) ---
            setText('sum-balance', fmtMoney(k.financials.cashEnd));
            setText('sum-capital-repaid', fmtMoney(k.financials.investorRepaid || 0));

            // Additional Liquidity / Sustainability Context
            setText('sum-repaid', fmtMoney(k.financials.investorRepaid || 0));
            setText('sum-repaid-pct', fmtPct(k.financials.investorRepaidPct || 0));
            setText('sum-preserved', fmtPct(k.financials.capitalPreservedPct || 0));

            setText('sum-health', fmtPct(k.financials.fundHealth || 0));

            const suffRatio = (k.sustainability.selfSufficiency || 0); // Already Ratio
            setText('sum-sufficiency', fmtPct(suffRatio));

            const runway = k.sustainability.opsRunway || 0;
            const runwayText = runway > 20 ? "Sustainable (>20y)" : fmtNum(runway) + " Years";
            setText('sum-ops-coverage', runwayText);

            // Unit Economics
            setText('sum-cost-per-latrine', fmtMoney(k.sustainability.costPerLatrine || 0));
            setText('sum-economic-cost', fmtMoney(k.value.economicCostPerLatrine || 0));
            setText('sum-effective-cost', fmtMoney(k.sustainability.effectiveCostPerLatrine || 0));

            // Legacy/Other
            setText('sum-leverage', fmtNum(k.financials.leverage || 0) + 'x');
            setText('sum-sroi', fmtNum(k.value.sroi || 0) + 'x');

        } catch (e) {
            console.error("ERROR IN UPDATEKPIS:", e);
        }
    },

    renderCharts(series, metric = 'toilets') {
        if (!series || !series.labels || series.labels.length === 0) return;

        // Aggregate Monthly Fund Interest to Annual (Phase 37)
        const annualFundInt = [];
        if (series.dataMonthlyFundInt) {
            let sumInt = 0;
            series.dataMonthlyFundInt.forEach((val, i) => {
                sumInt += val;
                if ((i + 1) % 12 === 0) {
                    annualFundInt.push(sumInt);
                    sumInt = 0;
                }
            });
        }

        // Monthly Scale-Up Chart
        const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
        if (chartInstances.monthly) chartInstances.monthly.destroy();

        chartInstances.monthly = new Chart(ctxMonthly, {
            type: 'bar',
            data: {
                labels: series.monthlyLabels,
                datasets: [
                    {
                        label: 'Loans (HH) - Cumulative',
                        data: series.dataToiletsMonthlyLoan,
                        backgroundColor: '#3b82f6',
                        stack: 'stack0'
                    },
                    {
                        label: 'Grants (HH) - Cumulative',
                        data: series.dataToiletsMonthlyGrant,
                        backgroundColor: '#8b5cf6',
                        stack: 'stack0'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: true, ticks: { maxTicksLimit: 20 } },
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Toilets Built (Cumulative)' } }
                }
            }
        });

        // Fund/Cashflow Chart (Switched to Monthly per User Request)
        const ctxFund = document.getElementById('fundChart').getContext('2d');
        if (chartInstances.fund) chartInstances.fund.destroy();

        // Calculate Monthly Borrower Repayments (Principal + Interest) [INFLOW]
        // Fix: User requested Repayments to show INFLOWS from borrowers, not OUTFLOWS to investors.
        const borrowerRepayments = series.dataMonthlyRepaymentHh.map((pHh, i) => {
            const pMe = series.dataMonthlyRepaymentMe[i] || 0;
            const iHh = series.dataMonthlyRevenueHh[i] || 0;
            const iMe = series.dataMonthlyRevenueMe[i] || 0;
            return pHh + pMe + iHh + iMe;
        });

        chartInstances.fund = new Chart(ctxFund, {
            type: 'line',
            data: {
                labels: series.monthlyLabels, // Switched to Monthly
                datasets: [
                    {
                        label: 'Fund Balance',
                        data: series.dataMonthlyCashBalance, // Switched to Monthly
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0 // Cleaner look for many data points
                    },
                    {
                        label: 'Borrower Repayments (Inflow)',
                        data: borrowerRepayments,
                        borderColor: '#f97316',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Split Cost Breakdown Chart (Stacked Bar)
        // Split Cost Breakdown Chart (Stacked Bar) -> Now "Annual Cash Flow Breakdown"
        const ctxCost = document.getElementById('costChart').getContext('2d');
        if (chartInstances.cost) chartInstances.cost.destroy();

        // Helper to aggregate Monthly -> Annual
        const aggregateAnnual = (monthlyArr) => {
            const annual = [];
            let sum = 0;
            monthlyArr.forEach((val, i) => {
                sum += val;
                if ((i + 1) % 12 === 0) {
                    annual.push(sum);
                    sum = 0;
                }
            });
            return annual;
        };

        // Prepare Annual Data
        const annRevHh = aggregateAnnual(series.dataMonthlyRevenueHh);
        const annRevMe = aggregateAnnual(series.dataMonthlyRevenueMe);
        const annCarbon = aggregateAnnual(series.dataMonthlyCarbonRevenue);

        const annLoansHh = aggregateAnnual(series.dataMonthlyNewLoansHhVal).map(v => -v); // Outflow
        const annLoansMe = aggregateAnnual(series.dataMonthlyNewLoansMeVal).map(v => -v); // Outflow
        const annGrants = series.dataGrants.map((v, i) => -(i === 0 ? v : v - series.dataGrants[i - 1])); // Delta, Outflow
        // Note: series.dataGrants is Cumulative. We need Annual Delta.

        const annFixOps = aggregateAnnual(series.dataMonthlyOps).map(v => -v); // Fixed
        const annVarOps = aggregateAnnual(series.dataMonthlyFees).map(v => -v); // Variable (Mgmt + M&E)

        const annFundInt = aggregateAnnual(series.dataMonthlyFundInt).map(v => -v);
        const annFundPrin = aggregateAnnual(series.dataMonthlyFundPrincipal).map(v => -v);
        // Defaults (HH + ME)
        const annDefaults = aggregateAnnual(series.dataMonthlyDefaultsHh).map((v, i) => {
            const meDef = series.dataMonthlyDefaultsMe[i * 12 + 11] ? 0 : 0; // Just aggregating same way
            // Wait, aggregateAnnual handles monthly array.
            // But we need to sum HH and ME defaults.
            // Let's optimize: sum monthly first? Or just map two annual arrays.
            return -(v + (aggregateAnnual(series.dataMonthlyDefaultsMe)[i] || 0));
        });
        const annNet = aggregateAnnual(series.dataMonthlyNet);

        // Calculate Annual Principal Repayments (Inflow)
        const annPrinRepayHh = aggregateAnnual(series.dataMonthlyRepaymentHh);
        const annPrinRepayMe = aggregateAnnual(series.dataMonthlyRepaymentMe);
        const annPrinRepayTotal = annPrinRepayHh.map((v, i) => v + annPrinRepayMe[i]);

        const allDatasets = [
            {
                type: 'line',
                label: 'Net Cash Flow',
                data: annNet,
                borderColor: '#1e293b',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 4,
                order: 0
            },
            // Inflows
            { label: 'Rev(HH)', data: annRevHh, backgroundColor: '#10b981', stack: 'Stack 0', order: 1 },
            { label: 'Rev(ME)', data: annRevMe, backgroundColor: '#059669', stack: 'Stack 0', order: 1 },
            { label: 'Repaid(Bor)', data: annPrinRepayTotal, backgroundColor: '#f97316', stack: 'Stack 0', order: 1 },
            { label: 'Carbon', data: annCarbon, backgroundColor: '#3b82f6', stack: 'Stack 0', order: 1 },

            // Outflows
            { label: 'Loans(HH)', data: annLoansHh, backgroundColor: '#3b82f6', stack: 'Stack 0', order: 1 },
            { label: 'Loans(ME)', data: annLoansMe, backgroundColor: '#1e40af', stack: 'Stack 0', order: 1 },
            { label: 'Grants', data: annGrants, backgroundColor: '#8b5cf6', stack: 'Stack 0', order: 1 },
            { label: 'FixedOps', data: annFixOps, backgroundColor: '#b91c1c', stack: 'Stack 0', order: 1 },
            { label: 'VarOps', data: annVarOps, backgroundColor: '#fca5a5', stack: 'Stack 0', order: 1 },
            { label: 'Debt(Int)', data: annFundInt, backgroundColor: '#f59e0b', stack: 'Stack 0', order: 1 },
            { label: 'Debt(Prin)', data: annFundPrin, backgroundColor: '#64748b', stack: 'Stack 0', order: 1 },
            { label: 'Defaults', data: annDefaults, backgroundColor: '#7f1d1d', stack: 'Stack 0', order: 1 }
        ];

        // Filter out empty datasets (Sum of absolute values > 1)
        const activeDatasets = allDatasets.filter(ds => {
            const sum = ds.data.reduce((a, b) => a + Math.abs(b), 0);
            return sum > 1; // Tolerance for rounding
        });

        chartInstances.cost = new Chart(ctxCost, {
            type: 'bar',
            data: {
                labels: series.labels,
                datasets: activeDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        title: { display: true, text: 'Annual Cash Flow ($)' }
                    }
                },
                plugins: {
                    title: { display: true, text: 'Annual Cash Flow Breakdown' },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });


        // Impact & Reach Chart
        const ctxProd = document.getElementById('productionChart').getContext('2d');
        if (chartInstances.prod) chartInstances.prod.destroy();

        // Config based on metric
        let label, data, color;
        switch (metric) {
            case 'people':
                label = 'People Reached (Cumulative)';
                data = series.dataPeople;
                color = '#10b981'; // Green
                break;
            case 'jobs':
                label = 'Jobs Supported (Annual)';
                data = series.dataJobs;
                color = '#3b82f6'; // Blue
                break;
            case 'dalys':
                label = 'DALYs Averted (Cumulative)';
                data = series.dataDalys;
                color = '#ef4444'; // Red
                break;
            case 'carbon':
                label = 'Carbon Mitigated (Cumulative Tonnes)';
                data = series.dataCarbon;
                color = '#f59e0b'; // Amber
                break;
            default: // toilets
                label = 'Latrines Built (Cumulative)';
                data = series.dataToilets;
                color = '#2563eb'; // Blue
        }

        chartInstances.prod = new Chart(ctxProd, {
            type: 'line',
            data: {
                labels: series.labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: color + '1A',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: label }
                    }
                },
                plugins: {
                    title: { display: true, text: label }
                }
            }
        });

        // --- Phase 23: Monthly Financial Charts ---
        const ctxIncome = document.getElementById('incomeChart').getContext('2d');
        if (chartInstances.income) chartInstances.income.destroy();

        chartInstances.income = new Chart(ctxIncome, {
            type: 'line',
            data: {
                labels: series.monthlyLabels,
                datasets: [
                    {
                        label: 'Interest (HH)',
                        data: series.dataMonthlyRevenueHh,
                        backgroundColor: '#10b981', // Green
                        borderColor: '#10b981',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Interest (ME)',
                        data: series.dataMonthlyRevenueMe,
                        backgroundColor: '#059669', // Emerald
                        borderColor: '#059669',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Carbon Revenue',
                        data: series.dataMonthlyCarbonRevenue,
                        backgroundColor: '#3b82f6', // Blue
                        borderColor: '#3b82f6',
                        fill: true,
                        tension: 0.3
                    }

                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { display: false },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Revenue ($)' },
                        stacked: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
        const ctxProfit = document.getElementById('profitChart').getContext('2d');
        if (chartInstances.profit) chartInstances.profit.destroy();

        chartInstances.profit = new Chart(ctxProfit, {
            type: 'bar',
            data: {
                labels: series.monthlyLabels,
                datasets: [
                    // REMOVED 'Cash Balance' from this chart
                    {
                        type: 'line',
                        label: 'Net Cash Flow',
                        data: series.dataMonthlyNet,
                        borderColor: '#1e293b', // Slate 800
                        borderWidth: 2,

                        tension: 0.1,
                        pointRadius: 0,
                        order: 0
                    },
                    {
                        label: 'RevInt(HH)',
                        data: series.dataMonthlyRevenueHh,
                        backgroundColor: '#10b981', // Green
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'RevInt(ME)',
                        data: series.dataMonthlyRevenueMe,
                        backgroundColor: '#059669', // Emerald 600
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Carbon Revenue',
                        data: series.dataMonthlyCarbonRevenue,
                        backgroundColor: '#3b82f6', // Blue 500
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Variable Ops',
                        data: series.dataMonthlyFees.map(v => -v),
                        backgroundColor: '#fca5a5', // Red 300
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Fixed Ops',
                        data: series.dataMonthlyOps.map(v => -v),
                        backgroundColor: '#b91c1c', // Red 700
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Defaults(HH)',
                        data: series.dataMonthlyDefaultsHh.map(v => -v),
                        backgroundColor: '#7f1d1d', // Dark Red
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Defaults(ME)',
                        data: series.dataMonthlyDefaultsMe.map(v => -v),
                        backgroundColor: '#991b1b', // Red 800
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'FundDebtService(Int)',
                        data: series.dataMonthlyFundInt.map(v => -v),
                        backgroundColor: '#f59e0b', // Amber
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'FundReflow(Principal)', // Renamed
                        data: series.dataMonthlyFundPrincipal.map(v => -v),
                        backgroundColor: '#64748b', // Slate 500
                        stack: 'stack1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { display: false, stacked: true },
                    y: {
                        title: { display: true, text: 'Cash Flow ($)' },
                        stacked: true
                    },
                    y1: {
                        position: 'right',
                        title: { display: true, text: 'Fund Balance ($)' },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(context.parsed.y));
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    },

    renderTable(series) {
        const tbody = document.querySelector('#annualResultsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!series || !series.labels) return;

        // Aggregate Monthly Fund Interest to Annual (Phase 37)
        const annualFundInt = [];
        if (series.dataMonthlyFundInt) {
            let sumInt = 0;
            series.dataMonthlyFundInt.forEach((val, i) => {
                sumInt += val;
                if ((i + 1) % 12 === 0) {
                    annualFundInt.push(sumInt);
                    sumInt = 0;
                }
            });
        }

        const fmtMoney = (n) => '$' + Math.round(n).toLocaleString();
        const fmtNum = (n) => Math.round(n).toLocaleString();

        // Need Annual Grants? series.dataGrants is Cumulative?
        // Let's check `calculate` return. 
        // `dataGrants` pushed `cumulativeGrants`. 
        // `dataLoansHh` pushed `amountLoanHh` (Annual).
        // `dataRepayments` pushed `borrowerPayment` (Annual).
        // `dataFund` is Annual Balance.

        series.labels.forEach((label, i) => {
            const tr = document.createElement('tr');

            // Calculate Annual Grant flow
            // Refactor Update: series.dataGrants is now populated with ANNUAL sums in the loop.
            const annualGrant = series.dataGrants[i];

            tr.innerHTML = `
                <td style="text-align:left">${label}</td>
                <td>${fmtNum(series.dataToilets[i])}</td>
                <td>${fmtMoney(series.dataLoansHh[i])}</td>
                <td>${fmtMoney(series.dataLoansMe[i])}</td>
                <td>${fmtMoney(annualGrant)}</td>
                <td>${fmtMoney(series.dataRepayments[i])}</td>
                <td>${fmtMoney(series.dataFund[i])}</td>
                <td>${fmtNum(series.dataCarbon[i])}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    // Integrity UI
    showIntegrityError(errors) {
        let banner = document.getElementById('integrityBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'integrityBanner';
            banner.style.background = '#fee2e2';
            banner.style.border = '1px solid #ef4444';
            banner.style.color = '#b91c1c';
            banner.style.padding = '1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.display = 'none';
            // Insert after top-actions
            const parent = document.querySelector('.top-actions');
            if (parent) parent.insertAdjacentElement('afterend', banner);
        }

        banner.innerHTML = `<strong>⚠️ Model Integrity Check Failed</strong><ul style="margin-top:0.5rem; padding-left:1.5rem;">` +
            errors.map(e => `<li>${e}</li>`).join('') + `</ul>`;
        banner.style.display = 'block';
    },

    /**
     * Render the fund-viability verdict ON SCREEN (R-10.3, finding F-29).
     *
     * The model used to report insolvency and investor default via console.warn, where
     * no user would ever see them, while printing "Model Integrity Verified" — a green
     * tick on a failing fund. These are two different claims and they get two different
     * banners: integrity failures are defects in the model, viability failures are
     * findings about the scenario and are a legitimate result.
     */
    showViability(viability) {
        let banner = document.getElementById('viabilityBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'viabilityBanner';
            banner.style.padding = '0.85rem 1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.fontSize = '0.85rem';
            banner.style.lineHeight = '1.5';
            const parent = document.querySelector('.top-actions') || document.body;
            if (!parent) return;   // no DOM to render into (headless test harness)
            parent.insertAdjacentElement(parent === document.body ? 'afterbegin' : 'afterend', banner);
        }

        if (viability.ok) {
            banner.style.background = '#dcfce7';
            banner.style.border = '1px solid #16a34a';
            banner.style.color = '#166534';
            banner.innerHTML = '<strong>&#10003; Fund is viable</strong> &mdash; stays solvent, repays senior debt in full, and covers its operating costs.';
        } else {
            banner.style.background = '#fef3c7';
            banner.style.border = '1px solid #d97706';
            banner.style.color = '#92400e';
            banner.innerHTML =
                '<strong>&#9888; This scenario does not stand up</strong>' +
                '<ul style="margin:0.5rem 0 0; padding-left:1.25rem;">' +
                viability.issues.map(i => `<li>${i.text}</li>`).join('') +
                '</ul>' +
                '<div style="margin-top:0.5rem; opacity:0.85;">This is the model reporting a result, not an error. ' +
                'Adjust the assumptions, or accept that the fund as specified needs more subsidy.</div>';
        }
        banner.style.display = 'block';
    },

    /** Show what would actually close a repayment shortfall — each option model-tested. */
    showAdvice(advice) {
        const existing = document.getElementById('adviceBanner');
        if (!advice) { if (existing) existing.style.display = 'none'; return; }

        let banner = existing;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'adviceBanner';
            banner.style.padding = '0.85rem 1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.fontSize = '0.85rem';
            banner.style.background = '#eff6ff';
            banner.style.border = '1px solid #3b82f6';
            banner.style.color = '#1e40af';
            const anchor = document.getElementById('viabilityBanner') || document.querySelector('.top-actions');
            if (anchor) anchor.insertAdjacentElement('afterend', banner);
        }

        const money = n => '$' + Math.round(n).toLocaleString('en-US');
        if (advice.noneWork) {
            banner.innerHTML = `<strong>Repayment shortfall: ${money(advice.shortfall)}</strong>` +
                `<div style="margin-top:0.4rem;">No single parameter change tested here closes the gap. ` +
                `The fund as specified cannot repay this much senior debt; it needs more grant capital, ` +
                `less debt, or a fundamentally different cost structure.</div>`;
        } else {
            banner.innerHTML = `<strong>Repayment shortfall: ${money(advice.shortfall)}</strong> ` +
                `(${(advice.basePaidPct * 100).toFixed(1)}% repaid). Model-tested changes that improve it:` +
                '<ul style="margin:0.5rem 0 0; padding-left:1.25rem;">' +
                advice.options.map(o =>
                    `<li>${o.label} to <strong>${o.display}</strong> &rarr; ` +
                    `${(o.repaidPct * 100).toFixed(1)}% repaid` +
                    (o.fullyRepaid ? ' <em>(repaid in full)</em>' : '') +
                    `, ${o.toiletDelta >= 0 ? '+' : ''}${Math.round(o.toiletDelta).toLocaleString('en-US')} toilets</li>`
                ).join('') +
                '</ul>' +
                '<div style="margin-top:0.5rem; opacity:0.85;">Nothing has been changed. Each figure above ' +
                'comes from re-running the model with that one change.</div>';
        }
        banner.style.display = 'block';
    },

    clearIntegrityError() {
        const banner = document.getElementById('integrityBanner');
        if (banner) banner.style.display = 'none';
    },

    // Stakeholders Removed

    // Wizard Logic REMOVED (finding F-15).
    // applyWizardSettings() and showWizardStep() referenced DOM ids that no longer
    // exist (wiz-risk, wiz-tech, loanInterestRate) and were called from nowhere.
    // Either would have thrown on first use. The markup they drove was deleted at
    // some earlier point; the handlers were not.

    setupFormatting() {
        const inputs = document.querySelectorAll('.formatted-number');
        const format = (v) => {
            // Strip non-numeric except .
            const val = parseFloat(v.replace(/,/g, ''));
            if (isNaN(val)) return v;
            return val.toLocaleString('en-US');
        };

        inputs.forEach(input => {
            // Initial format
            if (input.value) input.value = format(input.value);

            // Remove old listeners to prevent duplicates if called multiple times?
            // Ideally we'd use named functions but anon ok for now if we don't spam it.
            // Cloning node is a hacky way to strip listeners.
            // Let's just assume we only call it once or it's idempotent-ish (adding listeners multiple times is bad though).
            // A simple flag?
            if (input.dataset.hasFormatListener) return;
            input.dataset.hasFormatListener = "true";

            input.addEventListener('focus', (e) => {
                // Unformat on focus for editing
                const val = e.target.value.replace(/,/g, '');
                e.target.value = val;
                e.target.select();
            });

            input.addEventListener('blur', (e) => {
                // Format on blur
                e.target.value = format(e.target.value);
            });

            // Allow Enter to blur
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') e.target.blur();
            });

            // Remove auto-filled highlight on user edit
            input.addEventListener('input', (e) => {
                e.target.classList.remove('auto-filled');
            });
        });
    },

    calculateAffordability(data, toiletCost) {
        if (!data || !data.gdp) return;

        const costRatio = toiletCost / data.gdp;
        let estimatedGrantPct = 0.2; // Base 20%

        if (costRatio > 0.05) estimatedGrantPct += 0.2; // Expensive relative to income
        if (costRatio > 0.10) estimatedGrantPct += 0.2; // Very expensive

        if (data.gini && data.gini > 45) estimatedGrantPct += 0.1; // High inequality

        // Clamp
        estimatedGrantPct = Math.min(0.9, Math.max(0.1, estimatedGrantPct));

        const grantInput = document.getElementById('grantSupportPct');
        if (grantInput && !grantInput.dataset.manual) {
            grantInput.value = (estimatedGrantPct * 100).toFixed(0);
            grantInput.classList.add('auto-filled');
        }

        const helpEl = document.getElementById('affordability-help');
        if (helpEl) {
            let reason = "<strong>Base Grant (20%)</strong>: Standard subsidy floor.";
            if (costRatio > 0.05) reason += "<br>+ <strong>High Cost Burden</strong>: Toilet > 5% of GDP/Cap.";
            if (costRatio > 0.10) reason += "<br>+ <strong>Extreme Burden</strong>: Toilet > 10% of GDP/Cap.";
            if (data.gini && data.gini > 45) reason += "<br>+ <strong>Inequality Adjustment</strong>: Gini > 45.";

            helpEl.innerHTML = `
                 <div style="background:#f0f9ff; padding:8px; border-radius:4px; border:1px solid #bae6fd; font-size:0.9em;">
                     <strong>Affordability Analysis</strong>
                     <ul style="list-style:disc; margin-left:1rem; margin-top:4px; margin-bottom:4px;">
                         ${grantInput.dataset.manual ? '<li><span style="color:#ef4444; font-weight:bold;">Manual Override Active</span> (API ignored)</li>' : ''}
                         <li><strong>Toilet Cost:</strong> $${toiletCost}</li>
                         <li><strong>GDP/Capita:</strong> $${data.gdp.toFixed(0)}</li>
                         <li><strong>Cost Burden:</strong> ${(costRatio * 100).toFixed(1)}% of annual income.</li>
                         <li><strong>Gini Index:</strong> ${data.gini ? data.gini.toFixed(1) : 'N/A'}</li>
                     </ul>
                     <div style="margin-top:6px; border-top:1px solid #bae6fd; padding-top:4px;">
                         <em>Methodology:</em><br>
                         ${reason}
                     </div>
                 </div>`;
        }
    },

    downloadCSV() {
        if (!this.lastResults || !this.lastResults.series) {
            alert("No data available. Run model first.");
            return;
        }

        // Phase 35: Enhanced Export (Parameters)
        const inputs = UI.getInputs();
        const s = this.lastResults.series;
        const paramRows = [
            `Parameter,Value`,
            `Country,${inputs.country}`,
            `Districts,${inputs.districts}`,
            `GrantFund,$${inputs.investGrant}`,
            `LoanFund,$${inputs.investLoan}`,
            `AvgToiletCost,$${inputs.avgToiletCost}`,
            `LoanInterestRate,${inputs.loanInterestRate}`,
            `MEInterestRate,${inputs.meLoanInterestRate}`,
            `InflationRate,${inputs.inflationRate}`,
            `FundCostOfCapital,${inputs.fundCostOfCapital}`,
            `Duration,${inputs.duration} Years`,
            `GrantSupportPct,${inputs.grantSupportPct}`,
            `BadDebtBuffer,5x Expected Loss`,
            `CostPerLatrine,$${(document.getElementById('sum-cost-per-latrine')?.innerText || '0').replace('$', '')}`,
            `EconomicCostPerLatrine,$${(s && s.economicCostPerLatrine ? s.economicCostPerLatrine.toFixed(2) : '0')}`
        ];

        // Header
        const headers = [
            "Month", "Constraint", "ActiveMEs", "BaseCost", "InflationFx", "InflatedCost", "UnitContingencyAdd",
            "NewToiletsLoan", "NewToiletsGrant", "NewLoanValHH", "NewLoanValME",
            "RevIntHH", "RevIntME", "FundPrincipalCfl",
            "OpsExp", "BadDebtExp", "FundIntExp", "NetCashFlow",
            "PortfolioHH", "PortfolioME", "CashBalance",
            "UnitPrincipal", "UnitGrant", "UnitOps"
        ];

        const rows = [...paramRows, "", headers.join(",")];

        // P2: M0 Startup Row (Refined)
        // Only show if there are actual upfront costs. 
        // Current model starts with 0 MEs and grows them, so M0 startup cost is effectively 0.
        // We will output a clean M0 row showing the Initial Balance.
        const startupCost = s.startupCost || 0;
        const initialCash = inputs.investGrant + inputs.investLoan;

        const m0Row = [
            "M0 (Startup)",
            "", // Constraint
            s.startMEs || 0,
            (s.dataMonthlyUnitCost?.[0] || inputs.avgToiletCost).toFixed(2), // Est M0
            "1.000",
            0, 0, 0,
            startupCost.toFixed(2), // NewLoanValME
            0, 0, 0, // RevHH, RevME, FundPrin
            0, 0, 0, // Ops, BadDebt, FundInt
            (-startupCost).toFixed(2), // NetCash
            0, // PortfolioHH
            startupCost.toFixed(2), // PortfolioME
            (initialCash - startupCost).toFixed(2), // CashBalance
            "", "", "" // Unit Metrics
        ];
        rows.push(m0Row.join(","));
        const len = s.monthlyLabels.length;

        for (let i = 0; i < len; i++) {
            // Arrays are now Cumulative (Step 4808)
            const cumLoan = (s.dataToiletsMonthlyLoan[i] || 0);
            const cumGrant = (s.dataToiletsMonthlyGrant[i] || 0);

            const row = [
                s.monthlyLabels[i],
                s.dataConstraintBinding?.[i] || "",
                (s.dataMonthlyMes?.[i] || 0),
                (s.dataMonthlyBaseCost?.[i] || 0).toFixed(2),
                (s.dataMonthlyInflationFactor?.[i] || 0).toFixed(4),
                (s.dataMonthlyInflatedCost?.[i] || 0).toFixed(2),
                (s.dataMonthlyContingencyAdd?.[i] || 0).toFixed(2),

                // Toilets (Cumulative) -> Wait, we want Monthly here for columns "New..."
                (s.dataToiletsMonthlyLoan[i] - (i > 0 ? s.dataToiletsMonthlyLoan[i - 1] : 0)),
                (s.dataToiletsMonthlyGrant[i] - (i > 0 ? s.dataToiletsMonthlyGrant[i - 1] : 0)),

                // Finances
                (s.dataMonthlyNewLoansHhVal[i] || 0).toFixed(2),
                (s.dataMonthlyNewLoansMeVal[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueHh[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueMe[i] || 0).toFixed(2),
                (s.dataMonthlyFundPrincipal[i] || 0).toFixed(2),
                (s.dataMonthlyOps[i] || 0).toFixed(2),
                ((s.dataMonthlyDefaultsHh[i] || 0) + (s.dataMonthlyDefaultsMe[i] || 0)).toFixed(2),
                (s.dataMonthlyFundInt[i] || 0).toFixed(2),
                (s.dataMonthlyNet[i] || 0).toFixed(2),
                (s.dataMonthlyPortfolioHh[i] || 0).toFixed(2),
                (s.dataMonthlyPortfolioMe[i] || 0).toFixed(2),
                (s.dataMonthlyCashBalance[i] || 0).toFixed(2),
                (s.dataMonthlyPerToiletPrincipal?.[i] || 0).toFixed(2),
                (s.dataMonthlyPerToiletGrant?.[i] || 0).toFixed(2),
                (s.dataMonthlyPerToiletOps?.[i] || 0).toFixed(2)
            ];
            rows.push(row.join(","));
        }

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "model_debug_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // --- Phase 37: Scenario & Report ---
    // saveScenario Removed

    // populateScenarioList Removed

    // loadScenario Removed

    // Corrected Copy Function
    copyAnalysisReport() {
        console.log("Copy Report Triggered");
        try {
            if (!UI.lastResults || !UI.lastResults.series) {
                alert("No data available. Run model first.");
                return;
            }

            const inputs = UI.getInputs();
            const s = UI.lastResults.series;

            // ROBUST DATA SOURCE
            // Use lastResults directly to avoid stale state.
            // ROBUST DATA SOURCE
            // Use lastResults directly to avoid stale state.
            const k = UI.lastResults.kpis;
            // Flatten KPIS for report compatibility
            // Flatten KPIS for report compatibility
            const stats = {
                totalLatrines: k.reach.toilets,
                loanToilets: k.reach.loanToilets,
                loanToiletsVal: k.portfolio.disbursed,
                grantToilets: k.reach.grantToilets,
                grantToiletsVal: k.financials.grantsDisbursed,
                households: k.reach.toilets,
                people: k.reach.people,
                mes: k.reach.mes,

                dalys: k.impact ? k.impact.dalys.toFixed(0) : "0",
                economicValue: k.impact ? k.impact.valDalys.toFixed(0) : "0",
                carbon: k.impact ? k.impact.carbon.toFixed(0) : "0",
                jobs: k.reach.jobs,

                ossRatio: k.sustainability.oss,
                fssRatio: k.sustainability.fss,
                depletionYear: k.sustainability.depletionYear,
                breakEvenRate: (UI.lastResults.breakEvenRate !== null) ? (UI.lastResults.breakEvenRate * 100).toFixed(1) + '%' : 'N/A',
                maxGrantPct: (UI.lastResults.maxGrantPct !== null) ? (UI.lastResults.maxGrantPct * 100).toFixed(1) + '%' : 'N/A',

                // Fix: Map new Capital Preservation fields
                capitalPreserved: k.financials.capitalPreservedPct, // Legacy 
                grantEquityMultiple: k.financials.grantEquityMultiple,
                investorRepaidPct: k.financials.investorRepaidPct,

                minCash: Math.min(...UI.lastResults.series.dataMonthlyCashBalance),
                insolvencyMonths: k.sustainability.monthsInsolvent,

                fundBalance: k.financials.cashEnd,
                principalRepaid: k.financials.investorRepaid,
                portfolio: k.portfolio,
                financials: k.financials,

                costPerLatrine: k.sustainability.costPerLatrine,
                effectiveCostPerLatrine: k.sustainability.effectiveCostPerLatrine,
                economicCostPerLatrine: k.value.economicCostPerLatrine,
                leverageRatio: k.financials.leverage,
                sroi: k.value.sroi
            };

            // --- 1. Parameters (Vertical List) ---
            const lines = [`Parameter,Value`];
            Object.keys(inputs).forEach(key => {
                let val = inputs[key];
                if (typeof val === 'number') val = val.toString();
                lines.push(`${key},${val}`);
            });
            lines.push(``);

            // --- 2. Data Table (Headers) ---
            const headers = [
                "Month",
                "Cumulative Toilets (Loan)", "Cumulative Toilets (Grant)", "Total Toilets (Cum)",
                "Monthly Toilets (Loan)", "Monthly Toilets (Grant)", "Monthly Total",
                "Base Cost", "Inflation Factor", "Inflated Cost", "Contingency Add", "Active MEs",
                "New Loans (HH)", "Rev Int (HH)", "Principal Repaid (HH)", "Defaults (HH)",
                "New Loans (ME)", "Rev Int (ME)", "Principal Repaid (ME)", "Defaults (ME)",
                "Variable Ops", "Fixed Ops",
                "Investor Repayment (Principal)", "Investor Interest (Int)", "Carbon Rev",
                "Net Cash Flow", "Cash Balance"
            ];
            lines.push(headers.join(","));

            // --- 3. Data Rows ---
            // --- 3. Data Rows ---
            const startupCost = s.startupCost || 0;
            const startupMEs = s.startMEs || 0;
            const initialCash = inputs.investGrant + inputs.investLoan;

            const m0Row = [
                "M0 (Startup)",
                "0", "0", "0", // Cummings
                "0", "0", "0", // Monthlys
                "0.00", "1.000", "0.00", "0.00", startupMEs, // Base, Inf, Inflated, Cont, MEs
                "0.00", "0.00", "0.00", "0.00", // HH Loan
                startupCost.toFixed(2), "0.00", "0.00", "0.00", // ME Loan
                "0.00", "0.00", // Ops
                "0.00", "0.00", "0.00", // Fund
                (-startupCost).toFixed(2), // NetCash
                (initialCash - startupCost).toFixed(2) // CashBalance
            ];
            lines.push(m0Row.join(","));

            const len = s.monthlyLabels.length;
            for (let i = 0; i < len; i++) {
                const row = [
                    s.monthlyLabels[i],
                    (s.dataToiletsMonthlyLoan[i] || 0).toFixed(0),
                    (s.dataToiletsMonthlyGrant[i] || 0).toFixed(0),
                    ((s.dataToiletsMonthlyLoan[i] || 0) + (s.dataToiletsMonthlyGrant[i] || 0)).toFixed(0),
                    ((s.dataToiletsMonthlyLoan[i] || 0) - (s.dataToiletsMonthlyLoan[i - 1] || 0)).toFixed(0),
                    ((s.dataToiletsMonthlyGrant[i] || 0) - (s.dataToiletsMonthlyGrant[i - 1] || 0)).toFixed(0),
                    (((s.dataToiletsMonthlyLoan[i] || 0) - (s.dataToiletsMonthlyLoan[i - 1] || 0)) + ((s.dataToiletsMonthlyGrant[i] || 0) - (s.dataToiletsMonthlyGrant[i - 1] || 0))).toFixed(0),
                    (s.dataMonthlyBaseCost?.[i] || 0).toFixed(2),
                    (s.dataMonthlyInflationFactor?.[i] || 0).toFixed(3),
                    (s.dataMonthlyInflatedCost?.[i] || 0).toFixed(2),
                    (s.dataMonthlyContingencyAdd?.[i] || 0).toFixed(2),
                    (s.dataMonthlyMes?.[i] || 0).toFixed(0),
                    (s.dataMonthlyNewLoansHhVal[i] || 0).toFixed(2),
                    (s.dataMonthlyRevenueHh[i] || 0).toFixed(2),
                    (s.dataMonthlyRepaymentHh[i] || 0).toFixed(2),
                    (s.dataMonthlyDefaultsHh[i] || 0).toFixed(2),
                    (s.dataMonthlyNewLoansMeVal[i] || 0).toFixed(2),
                    (s.dataMonthlyRevenueMe[i] || 0).toFixed(2),
                    (s.dataMonthlyRepaymentMe[i] || 0).toFixed(2),
                    (s.dataMonthlyDefaultsMe[i] || 0).toFixed(2),
                    (s.dataMonthlyFees[i] || 0).toFixed(2),
                    (s.dataMonthlyOps[i] || 0).toFixed(2),
                    (s.dataMonthlyFundPrincipal[i] || 0).toFixed(2),
                    (s.dataMonthlyFundInt[i] || 0).toFixed(2),
                    (s.dataMonthlyCarbonRevenue[i] || 0).toFixed(2),
                    (s.dataMonthlyNet[i] || 0).toFixed(2),
                    (s.dataMonthlyCashBalance[i] || 0).toFixed(2)
                ];
                lines.push(row.join(","));
            }

            // --- 4. Programme Summary ---
            // Helper to safe-string
            const fmt = (v) => (v !== undefined && v !== null) ? v : "0";
            const fmtM = (v) => (v !== undefined && v !== null) ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

            lines.push(``);
            lines.push(`Programme Summary (End of Project Estimation)`);
            lines.push(`Reach & Operations`);
            lines.push(`Total Latrines,${stats.totalLatrines}`);
            lines.push(`Loans (Count),${stats.loanToilets}`);
            lines.push(`Loans (Value),$${stats.loanToiletsVal?.toLocaleString() || 0}`);
            lines.push(`Grants (Count),${stats.grantToilets}`);
            lines.push(`Grants (Value),$${stats.grantToiletsVal?.toLocaleString() || 0}`);
            lines.push(`Households Reached,${stats.households}`);
            lines.push(`People Reached,${stats.people}`);
            lines.push(`MEs Supported,${stats.mes}`);
            lines.push(``);
            lines.push(`Health & Climate Impact`);
            lines.push(`DALYs Averted,${stats.dalys}`);
            lines.push(`Economic Value (Health),$${stats.economicValue}`);
            lines.push(`Carbon Mitigated,${stats.carbon} Tons`);
            lines.push(`Job Creation,${stats.jobs}`);
            lines.push(``);
            lines.push(`Sustainability Scorecard`);
            lines.push(`OSS Ratio,${((stats.ossRatio || 0) * 100).toFixed(1)}%`);
            lines.push(`FSS Ratio (Total),${((stats.fssRatio || 0) * 100).toFixed(1)}%`);
            lines.push(`Depletion Year,${stats.depletionYear}`);
            lines.push(`Break-even Interest,${stats.breakEvenRate}`);
            lines.push(`Max Sustainable Grant,${stats.maxGrantPct}`);

            lines.push(`Grant Equity Multiple,${(stats.grantEquityMultiple || 0).toFixed(2)}x`);
            lines.push(`Investor Repaid %,${((stats.investorRepaidPct || 0) * 100).toFixed(1)}%`);
            lines.push(`Min Cash Balance,$${stats.minCash || 0}`);
            lines.push(`Months Insolvent,${stats.insolvencyMonths || 0}`);
            lines.push(``);

            // --- 5. End-State Balance Sheet (New) ---
            lines.push(`End-State Balance Sheet (Estimation)`);
            lines.push(`Assets`);
            lines.push(`  Cash,$${(stats.fundBalance || 0).toLocaleString()}`);
            lines.push(`  Gross Portfolio (Loans),$${(stats.portfolio?.outstanding || 0).toLocaleString()}`);
            lines.push(`  Total Assets,$${((stats.fundBalance || 0) + (stats.portfolio?.outstanding || 0)).toLocaleString()}`);
            lines.push(`Liabilities`);
            lines.push(`  Investor Liability,$${((inputs.investLoan || 0) - (stats.principalRepaid || 0)).toLocaleString()}`);
            lines.push(`Net Equity`);
            lines.push(`  Net Assets,$${(stats.financials?.netAssets || 0).toLocaleString()}`);

            lines.push(``);
            lines.push(`Unit Economics`);
            lines.push(`Total Cash Deployed / Latrine,$${(stats.costPerLatrine || 0).toFixed(2)}`);
            lines.push(`Economic Cost / Latrine,$${(stats.economicCostPerLatrine || 0).toFixed(2)}`);
            lines.push(`Effective Cost / Latrine,$${(stats.effectiveCostPerLatrine || 0).toFixed(2)}`);
            lines.push(`Leverage Ratio,${(inputs.investGrant > 0 ? (((stats.loanToiletsVal || 0) + (stats.grantToiletsVal || 0)) / (inputs.investGrant + (inputs.investLoan || 0))).toFixed(1) : "Infinite")}x`);
            lines.push(`SROI Ratio,${(stats.sroi || 0).toFixed(1)}x`);

            // Copy
            const blob = new Blob([lines.join("\n")], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            // Clipboard API (Text)
            navigator.clipboard.writeText(lines.join("\n")).then(() => {
                alert("Data & Summary copied to clipboard!");
            }, (err) => {
                console.error('Could not copy text: ', err);
                alert("Could not copy to clipboard. Check console.");
            });

        } catch (e) {
            console.error("Copy Error:", e);
            alert("Error preparing report: " + e.message);
        }
    },

    // --- NEW: Programme Summary Logic ---
    updateProgrammeSummary(stats) {
        if (!stats) return;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        const fmt = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const fmtMoney = (n) => (n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        const fmtPct = (n) => ((n || 0) * 100).toFixed(1) + '%';

        // 1. Reach (Split Rows)
        setTxt('sum-toilets', fmt(stats.totalLatrines));

        setTxt('sum-toilets-loan-count', fmt(stats.loanToilets));
        setTxt('sum-toilets-loan-val', fmtMoney(stats.loanToiletsVal));

        setTxt('sum-toilets-grant-count', fmt(stats.grantToilets));
        setTxt('sum-toilets-grant-val', fmtMoney(stats.grantToiletsVal));

        // Assuming 'stats' object now contains 'fundRepaid' and 'totalPrinRepayPct'
        // And 'stats.impact' is available if needed, or these are directly on 'stats'
        // For consistency with existing code, using 'stats' directly.
        setTxt('sum-balance', fmtMoney(stats.fundBalance));
        setTxt('sum-capital-repaid', fmtMoney(stats.fundRepaid)); // Assuming stats.fundRepaid exists
        setTxt('sum-repaid-pct', fmtPct(stats.totalPrinRepayPct)); // New UI Field, assuming stats.totalPrinRepayPct exists
        setTxt('sum-preserved', (stats.grantEquityMultiple || 0).toFixed(2) + "x");

        // MISSING FIELDS RESTORED:
        setTxt('sum-households', fmt(stats.households));
        setTxt('sum-people', fmt(stats.people));
        setTxt('sum-mes', fmt(stats.mes));

        // 2. SDG6 Gap
        const inputs = UI.getInputs();
        let gapMsg = "N/A";
        let gapClass = "";

        if (inputs.popReqToilets > 0) {
            const peopleReached = stats.people;
            const goal = inputs.popReqToilets;
            const pct = (peopleReached / goal) * 100;

            if (pct >= 100) {
                gapMsg = "100% (Gap Closed!)";
                gapClass = "text-green";
            } else {
                gapMsg = `${pct.toFixed(1)}% Closed`;
            }
        }
        setTxt('sum-sdg6', gapMsg);

        // 3. Primary Constraint
        let constraint = "Demand Met (Success)";
        if (stats.insolvencyMonths > 0) constraint = "Capital Depleted (Insolvent)";
        else if (inputs.popReqToilets > stats.people && stats.minCash > 0) constraint = "Supply Chain (ME Capacity)";
        else if (inputs.popReqToilets > stats.people) constraint = "Capital Limited";

        setTxt('sum-constraint', constraint);

        // 4. Impact
        setTxt('sum-dalys', fmt(stats.dalys));
        setTxt('sum-val-dalys', fmtMoney(stats.economicValue));
        setTxt('sum-carbon', fmt(stats.carbon) + " tCO2e");
        setTxt('sum-val-carbon', fmtMoney(stats.carbon * (inputs.co2Value || 0)));
        setTxt('sum-jobs', fmt(stats.jobs));
        setTxt('sum-val-jobs', fmtMoney(stats.jobs * 3000));

        // 5. Sustainability Scorecard (Full Population)
        // 5. Sustainability Scorecard (Full Population)
        // 5. Sustainability Scorecard (Full Population)
        setTxt('sus-oss-ratio', ((stats.ossRatio || 0) * 100).toFixed(0) + "%");
        // FIX: Use explicit FSS and Depletion fields from Calc
        setTxt('sus-fss-ratio', ((stats.fssRatio || 0) * 100).toFixed(1) + "%"); // Assuming ID exists? Or creating it?
        // Note: The previous view showed 'sus-depletion' being used.
        // It did NOT show 'sus-fss-ratio'.
        // If the ID doesn't exist, this line is harmless (setTxt checks element).
        // For Depletion, I will update 'sus-depletion' to use stats.depletionYear.
        setTxt('sus-depletion', stats.depletionYear || "Sustainable");

        // Recalculate accurately from inputs/stats to match Report
        setTxt('sum-balance', fmtMoney(stats.fundBalance));
        setTxt('sum-capital-repaid', fmtMoney(stats.principalRepaid || 0));

        // Populate the NEW Rows
        setTxt('sum-min-cash', fmtMoney(stats.minCash));
        setTxt('sum-insolvency', stats.insolvencyMonths + " Mo");

        const opsCoverage = (inputs.annualFixedOpsCost > 0)
            ? ((stats.fundBalance || 0) / inputs.annualFixedOpsCost).toFixed(1) + " Years"
            : "0.0 Years";
        setTxt('sum-ops-coverage', opsCoverage);

        const levRatio = (inputs.investGrant > 0)
            ? (((stats.loanToiletsVal || 0) + (stats.grantToiletsVal || 0)) / (inputs.investGrant + (inputs.investLoan || 0)))
            : 0;
        setTxt('sum-leverage', levRatio.toFixed(1) + "x");

        // Cost Per Latrine
        const totalInv = (inputs.investGrant || 0) + (inputs.investLoan || 0);
        const costPer = stats.totalLatrines > 0 ? (totalInv / stats.totalLatrines) : 0;
        setTxt('sum-cost-per-latrine', fmtMoney(costPer));

        // Effective Cost (Grant Only)
        setTxt('sum-cost-per-latrine', fmtMoney(costPer));

        // Economic Cost (New Field)
        setTxt('sum-economic-cost', fmtMoney(stats.economicCostPerLatrine));

        // Effective Cost (Grant Only)
        setTxt('sum-effective-cost', fmtMoney(stats.effectiveCostPerLatrine));

        // SROI (Use calculated value)
        setTxt('sum-sroi', (stats.sroi || 0).toFixed(1) + "x");

        // Capital Preservation Section
        const capPreservedPct = (stats.capitalPreservedPct || 0) * 100;

        setTxt('sum-health', capPreservedPct.toFixed(1) + "%");
        setTxt('sum-sufficiency', stats.ossRatio > 1.2 ? "Excellent" : (stats.ossRatio > 1.0 ? "Good" : "Subsidized"));

        // Legacy/Duplicate mappings
        setTxt('sum-repaid', fmtMoney(stats.principalRepaid || 0));
        setTxt('sum-repaid-pct', (((stats.principalRepaid || 0) / (inputs.investLoan || 1)) * 100).toFixed(1) + "%");

        // Cost Per Latrine (use standardized Metric)
        setTxt('sum-cost-per-latrine', fmtMoney(stats.costPerLatrine));

        setTxt('sum-preserved', (stats.grantEquityMultiple || 0).toFixed(2) + "x");
    },

    // --- Export ---

    renderDataTable(results) {
        if (!results || !results.series) return;
        const inputs = UI.getInputs(); // Fix: Retrieve inputs for calculations
        const s = results.series;
        const tbody = document.getElementById('monthlyDataBody');
        const thead = document.querySelector('#monthlyDataTable thead'); // Fixed Selector
        if (!tbody) return;

        const fmtVal = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const fmtMoney = (n) => (n || 0).toLocaleString(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const tooltipMap = {
            "Month": "Simulation Month (M1, M2...)",
            "CumLoan": "Total toilets built via Loans to date",
            "CumGrant": "Total toilets built via Grants to date",
            "CumTotal": "Grand total of all toilets built to date",
            "MoLoan": "Toilets built via Loans THIS MONTH",
            "MoGrant": "Toilets built via Grants THIS MONTH",
            "MoTotal": "Total toilets built THIS MONTH",
            "NewLoanHH": "Value of new household loans issued this month",
            "RevIntHH": "Interest revenue collected from households",
            "PrinRepHH": "Principal repaid by households",
            "DefHH": "Value of household loans written off (defaulted)",
            "NewLoanME": "Value of new loans to Micro-Enterprises",
            "RevIntME": "Interest revenue from MEs",
            "PrinRepME": "Principal repaid by MEs",
            "DefME": "Value of ME loans written off",
            "MgmtFees": "Variable Management Fees paid",
            "MandE": "Variable M&E Costs paid",
            "FixOps": "Fixed Operating Expenses paid",
            "InvPrin": "Principal repaid to Investor/Funder",
            "InvInt": "Interest paid to Investor/Funder",
            "CarbRev": "Revenue from Carbon Credits",
            "NetCash": "Net Cash Flow (Inflow - Outflow) this month",
            "EndBal": "Cash Balance at end of month",
            "ActiveMEs": "Number of Micro-Enterprises currently operating"
        };

        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th title="${tooltipMap.Month}" style="width: 80px; min-width: 80px;">Month</th>
                    <th title="${tooltipMap.CumLoan}">Latrine Qty (Loan)</th>
                    <th title="${tooltipMap.CumGrant}">Latrine Qty (Grant)</th>
                    <th title="${tooltipMap.CumTotal}">Total Qty (Cum)</th>
                    
                    <th title="${tooltipMap.MoLoan}" style="background:#f0f9ff;">Mo Qty (Loan)</th>
                    <th title="${tooltipMap.MoGrant}" style="background:#f0f9ff;">Mo Qty (Grant)</th>
                    <th title="${tooltipMap.MoTotal}" style="background:#f0f9ff;">Mo Total</th>
                    
                    <th title="Cost per Toilet per Month (Inflation Adjusted)">Unit Cost</th>
                    <th title="${tooltipMap.ActiveMEs}">Active MEs</th>

                    <th title="${tooltipMap.NewLoanHH}">NewLoans(HH)</th>
                    <th title="${tooltipMap.RevIntHH}">RevInt(HH)</th>
                    <th title="${tooltipMap.PrinRepHH}">PrinRepaid(HH)</th>
                    <th title="${tooltipMap.DefHH}">Defaults(HH)</th>
                    
                    <th title="${tooltipMap.NewLoanME}">NewLoans(ME)</th>
                    <th title="${tooltipMap.RevIntME}">RevInt(ME)</th>
                    <th title="${tooltipMap.PrinRepME}">PrinRepaid(ME)</th>
                    <th title="${tooltipMap.DefME}">Defaults(ME)</th>
                    
                    <th title="${tooltipMap.MgmtFees}">Variable Ops</th>
                    <th title="${tooltipMap.FixOps}">Fixed Ops</th>
                    
                    <th title="${tooltipMap.InvPrin}">InvRepay(Prin)</th>
                    <th title="${tooltipMap.InvInt}">InvInt(Int)</th>
                    <th title="${tooltipMap.CarbRev}">CarbonRev</th>
                    
                    <th title="${tooltipMap.NetCash}">NetCashFlow</th>
                    <th title="${tooltipMap.EndBal}">CashBalance</th>
                </tr>
            `;
        }



        const len = s.monthlyLabels.length;

        let html = '';

        // P2: M0 Startup Row (UI Table)
        const startupCost = s.startupCost || 0;
        const initialCash = inputs.investGrant + inputs.investLoan;
        const startMEs = s.startMEs || 0;

        if (startupCost > 0 || startMEs > 0) {
            html += `<tr>
                <td style="color:#64748b; font-weight:bold;">M0 (Startup)</td>
                
                <!--Cumulative -->
                <td>0</td><td>0</td><td>0</td>

                <!--Monthly(Delta) -->
                <td style="background:#f0f9ff;">0</td>
                <td style="background:#f0f9ff;">0</td>
                <td style="background:#f0f9ff;">0</td>
                
                <td>$0</td>
                <td>${startMEs}</td>

                <!--HH Finances-->
                <td>$0</td><td>$0</td><td>$0</td><td>$0</td>
                
                <!--ME Finances-->
                <td>${startMEs}</td> <!-- Initial MEs counted as 'New Loans' context or just active? -->
                <td>${fmtMoney(startupCost)}</td> <!-- Value -->
                <td>$0</td><td>$0</td><td>$0</td>
                
                <!--Ops -->
                <td>$0</td><td>$0</td>
                
                <!--Fund -->
                <td>$0</td><td>$0</td><td>$0</td>
                
                <!--Summary -->
                <td class="text-red">${fmtMoney(-startupCost)}</td>
                <td>${fmtMoney(initialCash - startupCost)}</td>
            </tr>`;
        }

        for (let i = 0; i < len; i++) {
            // Delta Calculations
            const cumLoan = (s.dataToiletsMonthlyLoan[i] || 0);
            const prevLoan = (s.dataToiletsMonthlyLoan[i - 1] || 0);
            const moLoan = cumLoan - prevLoan;

            const cumGrant = (s.dataToiletsMonthlyGrant[i] || 0);
            const prevGrant = (s.dataToiletsMonthlyGrant[i - 1] || 0);
            const moGrant = cumGrant - prevGrant;

            html += `<tr>
                <td style="color:#64748b;">${s.monthlyLabels[i]}</td>
                
                <!--Cumulative -->
                <td>${fmtVal(cumLoan)}</td>
                <td>${fmtVal(cumGrant)}</td>
                <td>${fmtVal(cumLoan + cumGrant)}</td>

                <!--Monthly(Delta) -->
                <td style="background:#f0f9ff;">${fmtVal(moLoan)}</td>
                <td style="background:#f0f9ff;">${fmtVal(moGrant)}</td>
                <td style="background:#f0f9ff;">${fmtVal(moLoan + moGrant)}</td>
                
                <td>${fmtMoney(s.dataMonthlyUnitCost?.[i])}</td>
                <td>${fmtVal(s.dataMonthlyMes?.[i])}</td>

                <!--HH Finances-->
                <td>${fmtMoney(s.dataMonthlyNewLoansHhVal[i])}</td>
                <td>${fmtMoney(s.dataMonthlyRevenueHh[i])}</td>
                <td>${fmtMoney(s.dataMonthlyRepaymentHh[i])}</td>
                <td>${fmtMoney(s.dataMonthlyDefaultsHh[i])}</td>
                
                <!--ME Finances-->
                <td>${(s.dataMonthlyNewLoansMeVal[i] / inputs.meSetupCost).toFixed(0)}</td> <!-- Count -->
                <td>${fmtMoney(s.dataMonthlyNewLoansMeVal[i])}</td> <!-- Value -->
                <td>${fmtMoney(s.dataMonthlyRevenueMe[i])}</td>
                <td>${fmtMoney(s.dataMonthlyRepaymentMe[i])}</td>
                <td>${fmtMoney(s.dataMonthlyDefaultsMe[i])}</td>
                
                <!--Ops -->
                <td>${fmtMoney(s.dataMonthlyFees[i])}</td>
                <td>${fmtMoney(s.dataMonthlyOps[i])}</td>
                
                <!--Fund -->
                <td>${fmtMoney(s.dataMonthlyFundPrincipal[i])}</td>
                <td>${fmtMoney(s.dataMonthlyFundInt[i])}</td>
                <td>${fmtMoney(s.dataMonthlyCarbonRevenue[i])}</td>
                
                <!--Summary -->
                <td class="${(s.dataMonthlyNet[i] < 0) ? 'text-red' : 'text-green'}">${fmtMoney(s.dataMonthlyNet[i])}</td>
                <td>${fmtMoney(s.dataMonthlyCashBalance[i])}</td>
            </tr>`;
        }
        tbody.innerHTML = html;
    },

    // Phase 47: AI Advisor
    // Phase 48: Enhanced AI Advisor
    generateSuggestions: function () {
        if (!this.lastResults || !this.lastResults.kpis || !this.lastResults.series) {
            alert("Please run the model first.");
            return;
        }

        const kpis = this.lastResults.kpis;
        const s = this.lastResults.series;
        const inputs = this.getInputs();
        let suggestions = [];
        let warnings = [];

        // Formatting Helper
        const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

        // --- 1. Deep Insolvency Analysis ---
        if (kpis.sustainability.monthsInsolvent > 0) {

            // Ops Cost Monthly
            const fixedOps = (inputs.annualFixedOpsCost || 0) / 12;

            // Peak metrics
            const peakRevenue = Math.max(...s.dataMonthlyRevenueHh) + Math.max(...s.dataMonthlyRevenueMe);
            const peakDebtService = Math.max(...s.dataMonthlyFundPrincipal) + Math.max(...s.dataMonthlyFundInt);

            // Find crash month
            let crashIndex = -1;
            for (let i = 0; i < s.dataMonthlyCashBalance.length; i++) {
                if (s.dataMonthlyCashBalance[i] < 0) { crashIndex = i + 1; break; }
            }

            // A. Structural Deficit? (Revenue never covers Ops)
            if (peakRevenue < fixedOps) {
                warnings.push(`🔴 ** Structural Deficit **\nYour monthly fixed costs(${fmt(fixedOps)}) are higher than your BEST monthly revenue(${fmt(peakRevenue)}).\n👉 ** Fix **: Reducing lending will NOT help.You must reduce 'Annual Fixed Ops Cost' or significantly increase 'Interest Rate'.`);
            }
            // B. Debt Trap? (Debt Service > Revenue)
            else if (peakDebtService > peakRevenue * 0.95) {
                warnings.push(`🔴 ** Debt Trap **\nInvestor repayments are eating > 95 % of your income.You are working for the bank.\n👉 ** Fix **: Extend 'Fund Repayment Term'(Current: ${inputs.fundRepaymentTerm} years) or negotiate a lower 'Fund Cost of Capital'.`);
            }
            // D. Negative Real Yield (Inflation Trap)
            else if (inputs.loanInterestRate < (inputs.inflationRate + inputs.hhDefaultRate)) {
                warnings.push(`🔴 ** Negative Real Yield **\nYour Interest Rate (${(inputs.loanInterestRate * 100).toFixed(1)}%) is lower than Inflation + Defaults (${((inputs.inflationRate + inputs.hhDefaultRate) * 100).toFixed(1)}%).\nYou are losing purchasing power on every loan.\n👉 ** Fix **: Increase Interest Rate to at least ${((inputs.inflationRate + inputs.hhDefaultRate + 0.1) * 100).toFixed(0)}%.`);
            }
            // C. Aggressive Growth? (High spending before crash)
            else if (crashIndex > -1 && crashIndex < 15) {
                // Check recent ME loans
                const recentMeLoans = s.dataMonthlyNewLoansMeVal.slice(0, crashIndex).reduce((a, b) => a + b, 0);
                warnings.push(`🟠 ** Growing Too Fast **\nYou ran out of cash in Month ${crashIndex}. You spent ${fmt(recentMeLoans)} on ME Loans before crashing.\n👉 ** Fix **: The fund cannot sustain this growth rate.Reduce 'Micro-enterprises / Unit'(Current: ${inputs.mePerDistrict}) or 'ME Setup Cost'.`);
            }
            else {
                warnings.push(`🔴 ** Insolvency **\nThe fund runs out of cash.Try increasing 'Initial Loan Capital' or 'Grant Fund' to cover the gap.`);
            }
        } else {
            // NEW: Check if Principal was actually repaid! (Solvent but Defaulting?)
            const repaid = kpis.financials.investorRepaid || 0;
            const owed = inputs.investLoan || 0;

            if (owed > 0 && (owed - repaid) > 1000) {
                warnings.push(`🔴 ** Repayment Failure **\nThe fund stayed solvent(cash > 0), BUT failed to repay the investor.\nShortfall: ${fmt(owed - repaid)}.\n👉 ** Fix **: The fund did not generate enough cash to pay back the loan on time. Reduce 'Grant Support %' (subsidy is too high) or Increase 'Fund Repayment Term'.`);
            } else {
                suggestions.push(`🟢 ** Solvency **: Excellent.The fund remains liquid and repaid investors.`);
            }

            // Check Capital Efficiency (Too much cash?)
            // Minimum cash balance throughout the project
            // s.minCash is not directly available, calc it or use pre-calc
            const minCash = s.dataMonthlyCashBalance.reduce((min, val) => Math.min(min, val), s.dataMonthlyCashBalance[0]);

            // If we have > 20% of Initial Loan Capital sitting idle forever?
            if (minCash > inputs.investLoan * 0.2) {
                suggestions.push(`🔵 ** High Idle Cash **\nYou have at least ${fmt(minCash)} sitting idle that was never used.\n👉 ** Optimization **: Reduce 'Initial Loan Capital' to save on interest payments, or Increase 'Grant Support %' to reach more people.`);
            }
        }

        // --- 2. Operational Self-Sufficiency (OSS) ---
        const oss = kpis.sustainability.oss;
        if (oss < 1.0) {
            warnings.push(`🟠 ** Unsustainable(OSS ${(oss * 100).toFixed(0)}%) **\nRevenue does not cover operating costs.Grants are subsidizing the difference.\n👉 ** Fix **: Increase 'HH Loan Interest Rate'(Current: ${inputs.loanInterestRate} %) or 'Mgmt Fee Ratio'.`);
        }

        // --- 3. Reach / Impact ---
        if (inputs.popReqToilets > 0) {
            const peopleReached = kpis.reach.people;
            const goal = inputs.popReqToilets;
            const reach = peopleReached / goal;

            if (reach < 0.2) {
                suggestions.push(`🔵 ** Low Impact **\nYou are only reaching ${(reach * 100).toFixed(1)}% of the target population.\n👉 ** Scale Up **: If you have cash, increase 'Initial Grant Capital' for subsidies or 'Grant Support %'.`);
            } else if (reach > 0.8) {
                suggestions.push(`🟢 ** High Impact **: You are reaching a significant portion of the population!`);
            }
        }

        // Combine
        const finalMsg = [...warnings, ...suggestions];
        if (finalMsg.length === 0) finalMsg.push("✅ Model is perfectly balanced!");

        alert(finalMsg.join("\n\n"));
    },

    // Phase 55: Smart Rate Updater (Reactive)
    // NUCLEAR OPTION: Simplified, Robust, No Locks
    updateSmartRates: function () {
        console.log("updateSmartRates: STARTING");

        // Every rate field holds a percentage (R-2.3). No normalisation, no guessing.
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el) return 0;
            return parseFloat(el.value) || 0;
        };

        // Retrieve Benchmarks (stored in dataset)
        // RE-ADDING DELETED VARIABLES
        const inflation = getVal('inflationRate');
        const hhDefault = getVal('hhDefaultRate');

        const loanInput = document.getElementById('loanInterestRate_v2'); // ID ROTATION
        let lendingRate = 0;
        if (loanInput && loanInput.dataset.benchmark) {
            lendingRate = parseFloat(loanInput.dataset.benchmark) || 0;
        }

        // Logic
        // HH = Max(Inflation + 20% Spread, LendingRate + 5%)
        const hhRate = Math.max(inflation + 20, lendingRate + 5);

        // ME = HH - 5% (Subsidized)
        // Ensure ME > Inflation to avoid loss
        const meRate = Math.max(hhRate - 5, inflation + 2);

        // Apply — but only where the user has not taken ownership of the field.
        //
        // This used to overwrite both rate fields unconditionally, on page load, on
        // every country fetch, and on every edit to inflation or the default rates,
        // then dispatch a synthetic input event that scheduled yet another recalc. The
        // dataset.manual flag set by trackManualInterest was read nowhere (F-05). A
        // user could type a rate, watch it change a second later, and have no idea why.
        const apply = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;

            if (el.dataset.manual === 'true') {
                // The user owns this field now. Suggest, do not impose.
                el.dataset.suggested = val.toFixed(2);
                return;
            }

            el.value = val.toFixed(2);
            el.classList.add('auto-filled');
        };

        apply('loanInterestRate_v2', hhRate);
        apply('meLoanInterestRate_v2', meRate);

        console.log(`updateSmartRates: UPDATED HH=${hhRate}, ME=${meRate}`);

        // Feedback
        const helpEl = document.getElementById('interest-help');
        if (helpEl) {
            helpEl.innerText = `Smart Link: HH Rate (${hhRate.toFixed(1)}%) > Inflation (${inflation}%) & Lending Rate (${lendingRate}%).`;
            helpEl.style.color = "#d5ac00";
        }
    },

};


const LDC_COUNTRIES = [
    { name: "Afghanistan", code: "AFG", iso2: "AF" },
    { name: "Angola", code: "AGO", iso2: "AO" },
    { name: "Bangladesh", code: "BGD", iso2: "BD" },
    { name: "Benin", code: "BEN", iso2: "BJ" },
    { name: "Burkina Faso", code: "BFA", iso2: "BF" },
    { name: "Burundi", code: "BDI", iso2: "BI" },
    { name: "Cambodia", code: "KHM", iso2: "KH" },
    { name: "Central African Republic", code: "CAF", iso2: "CF" },
    { name: "Chad", code: "TCD", iso2: "TD" },
    { name: "Comoros", code: "COM", iso2: "KM" },
    { name: "Congo, Dem. Rep.", code: "COD", iso2: "CD" },
    { name: "Djibouti", code: "DJI", iso2: "DJ" },
    { name: "Eritrea", code: "ERI", iso2: "ER" },
    { name: "Ethiopia", code: "ETH", iso2: "ET" },
    { name: "Gambia, The", code: "GMB", iso2: "GM" },
    { name: "Guinea", code: "GIN", iso2: "GN" },
    { name: "Guinea-Bissau", code: "GNB", iso2: "GW" },
    { name: "Haiti", code: "HTI", iso2: "HT" },
    { name: "Kiribati", code: "KIR", iso2: "KI" },
    { name: "Lao PDR", code: "LAO", iso2: "LA" },
    { name: "Lesotho", code: "LSO", iso2: "LS" },
    { name: "Liberia", code: "LBR", iso2: "LR" },
    { name: "Madagascar", code: "MDG", iso2: "MG" },
    { name: "Malawi", code: "MWI", iso2: "MW" },
    { name: "Mali", code: "MLI", iso2: "ML" },
    { name: "Mauritania", code: "MRT", iso2: "MR" },
    { name: "Mozambique", code: "MOZ", iso2: "MZ" },
    { name: "Myanmar", code: "MMR", iso2: "MM" },
    { name: "Nepal", code: "NPL", iso2: "NP" },
    { name: "Niger", code: "NER", iso2: "NE" },
    { name: "Rwanda", code: "RWA", iso2: "RW" },
    { name: "Senegal", code: "SEN", iso2: "SN" },
    { name: "Sierra Leone", code: "SLE", iso2: "SL" },
    { name: "Solomon Islands", code: "SLB", iso2: "SB" },
    { name: "Somalia", code: "SOM", iso2: "SO" },
    { name: "South Sudan", code: "SSD", iso2: "SS" },
    { name: "Sudan", code: "SDN", iso2: "SD" },
    { name: "Timor-Leste", code: "TLS", iso2: "TL" },
    { name: "Togo", code: "TGO", iso2: "TG" },
    { name: "Tuvalu", code: "TUV", iso2: "TV" },
    { name: "Uganda", code: "UGA", iso2: "UG" },
    { name: "Tanzania", code: "TZA", iso2: "TZ" },
    { name: "Yemen, Rep.", code: "YEM", iso2: "YE" },
    { name: "Zambia", code: "ZMB", iso2: "ZM" }
];

// --- App Controller ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial UI Setup
    UI.setupFormatting();

    // Force Smart Rates Update on Load (Ensures Defaults are Overwritten)
    setTimeout(() => {
        if (typeof UI.updateSmartRates === 'function') {
            UI.updateSmartRates();
        }
    }, 1000); // 1s Delay to allow DOM/Data to settle

    // Populate the country selector.
    //
    // This used to fill a <datalist> behind an <input> that was pre-filled with
    // "Malawi". Browsers filter a datalist against whatever is already in the field,
    // so the dropdown showed one entry and the tool read as single-country. A <select>
    // shows all 44 on one click.
    const countrySelect = document.getElementById('countryInput');
    if (countrySelect && countrySelect.tagName === 'SELECT') {
        LDC_COUNTRIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = `${c.name} (${c.code})`;
            countrySelect.appendChild(opt);
        });
        countrySelect.value = 'Malawi';

        // Selecting a country does not fetch on its own — the fetch overwrites a dozen
        // form fields, and that should follow an explicit click, not a dropdown change.
        // Prompt instead, so the pending action is obvious.
        countrySelect.addEventListener('change', () => {
            const help = document.getElementById('country-help');
            const btn = document.getElementById('fetchDataBtn');
            if (help) {
                help.innerText = `Click "Load Country Data" to pull ${countrySelect.value}'s figures ` +
                    `into the form. Nothing has changed yet.`;
                help.style.color = '#b45309';
            }
            if (btn) btn.classList.add('needs-attention');
        });
    }

    // Manual Override Tracking
    const grantInput = document.getElementById('grantSupportPct');
    if (grantInput) {
        grantInput.addEventListener('input', () => {
            grantInput.dataset.manual = "true";
            const help = document.getElementById('affordability-help');
            if (help) help.innerText = "Manual override active. API updates will be ignored.";
        });
    }

    // Phase 55: Reactive Interest Rate Logic (User Request: "Link rates to inflation")
    const trackManualInterest = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                // Fix: Only lock if user physically types (trusted event)
                if (!e.isTrusted) return;

                el.dataset.manual = "true";
                el.style.backgroundColor = "#fff"; // Remove auto-color
                // Debounce simple recalc
                if (window.recalcTimer) clearTimeout(window.recalcTimer);
                window.recalcTimer = setTimeout(runCalculation, 500);
            });
        }
    };
    trackManualInterest('loanInterestRate_v2'); // UPDATED ID
    trackManualInterest('meLoanInterestRate_v2'); // UPDATED ID

    // Trigger Update on Dependency Change
    const triggerSmartRates = () => {
        if (typeof UI.updateSmartRates === 'function') {
            UI.updateSmartRates();
            // Also run calculation to show impact immediately
            if (window.recalcTimer) clearTimeout(window.recalcTimer);
            window.recalcTimer = setTimeout(runCalculation, 500);
        }
    };

    ['inflationRate', 'hhDefaultRate', 'meDefaultRate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', triggerSmartRates);
    });

    // Auto-Adjust Grant on Toilet Cost Change
    const toiletCostInput = document.getElementById('avgToiletCost');
    if (toiletCostInput) {
        toiletCostInput.addEventListener('input', () => {
            if (UI.lastApiData) {
                const val = parseFloat(toiletCostInput.value.replace(/,/g, '')) || 0;
                UI.calculateAffordability(UI.lastApiData, val);
            }
        });
    }
    // Event Listeners - Splash Screen
    const startBtn = document.getElementById('startAppBtn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            document.getElementById('splashScreen').style.display = 'none';
        });
    }

    // Phase 55: Realistic Carbon Defaults
    // Pit Latrines often have 0 or negative carbon benefit unless CBS/Biogas.
    // We set default to 0 to be conservative.
    const setCarbonDefault = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setCarbonDefault('co2PerToilet', 0.0);
    setCarbonDefault('co2Value', 15);
    setCarbonDefault('carbonCreditShare', 50); // 50% Share (Broker fees + Verification costs)

    // Auto-Load Data for Malawi on Startup
    setTimeout(() => {
        const fetchBtn = document.getElementById('fetchDataBtn');
        if (fetchBtn) {
            console.log("Auto-Fetching Data for Malawi...");
            fetchBtn.click();
        }
    }, 500);



    // Sync Duration -> Fund Repayment Term
    const durationInput = document.getElementById('wiz-duration-sidebar');
    const repaymentInput = document.getElementById('fundRepaymentTerm');
    if (durationInput && repaymentInput) {
        durationInput.addEventListener('input', (e) => {
            // Only sync on USER interaction (to avoid overwriting Scenarios on load)
            if (e.isTrusted) {
                repaymentInput.value = durationInput.value;
                repaymentInput.classList.add('auto-filled');
            }
        });
    }

    // Main App Listeners
    // FIX: Pass 'true' to enable Auto-Solver only on user click
    document.getElementById('recalcBtn').addEventListener('click', () => runCalculation(true));

    // Phase 37: Scenario & Report Listeners
    // Scenarios Removed.

    const copyBtn = document.getElementById('copyReportBtn');
    if (copyBtn) copyBtn.addEventListener('click', () => UI.copyAnalysisReport());

    // Defer population to ensure UI is ready
    // setTimeout(() => UI.populateScenarioList(), 500); // Removed

    // Export Listener
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => UI.downloadCSV());
    }



    document.getElementById('fetchDataBtn').addEventListener('click', async () => {
        const btn = document.getElementById('fetchDataBtn');
        const inputVal = document.getElementById('countryInput').value;

        // Lookup Code
        const countryObj = LDC_COUNTRIES.find(c => c.name === inputVal || c.code === inputVal);

        if (!countryObj) {
            alert("Please select a valid LDC country from the list.");
            return;
        }

        const country = countryObj.code;
        const originalText = btn.innerText;
        btn.innerText = "Loading...";



        // 1. Reset all inputs to Defaults (Clean Slate)
        if (UI.defaultValues) {
            Object.keys(UI.defaultValues).forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = UI.defaultValues[id];
                    el.classList.remove('auto-filled');
                    el.style.backgroundColor = ""; // Reset styling
                    el.title = "";
                }
            });
        }

        const data = await ApiModule.fetchData(country);
        btn.innerText = originalText;
        // The pending-load prompt is satisfied; clear it.
        btn.classList.remove('needs-attention');
        const cHelp = document.getElementById('country-help');
        if (cHelp) {
            cHelp.innerText = `Loaded ${countryObj.name}. Change the country and click Load again to switch context.`;
            cHelp.style.color = '';
        }

        // Helper for Flag Image (Windows friendly)
        const getFlagImg = (iso2) => {
            if (!iso2) return '🏳️';
            return `<img src="https://flagcdn.com/24x18/${iso2.toLowerCase()}.png" alt="${iso2}" style="vertical-align: middle; margin-right: 8px;">`;
        };

        if (data) {
            // Update Title
            const flag = getFlagImg(countryObj.iso2);
            const titleEl = document.getElementById('dashboardTitle');
            if (titleEl) {
                // Use innerHTML instead of innerText to render the <img> tag
                titleEl.innerHTML = `${flag} ${countryObj.name} Rural Sanitation Fund Model`;
            }

            const wbDiv = document.getElementById('wbIndicators');
            // Enhanced Stats Header
            const popM = (data.pop / 1e6).toFixed(2);
            let access = data.basicSan ? data.basicSan.toFixed(1) + '%' : 'N/A';
            let unserved = 'N/A';
            if (data.pop && data.basicSan) {
                const gap = (100 - data.basicSan) / 100;
                unserved = ((data.pop * gap) / 1e6).toFixed(2) + 'M';
            }

            // Use GNI if available, else GDP
            const incomeMetric = data.gni || data.gdp;
            const incomeLabel = data.gni ? 'GNI/c' : 'GDP/c';
            const incomeCode = data.gni ? 'NY.GNP.PCAP.CD' : 'NY.GDP.PCAP.CD';

            wbDiv.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <a href="https://data.worldbank.org/indicator/SP.RUR.TOTL?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Rural Pop:</strong> ${popM}M &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/${incomeCode}?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>${incomeLabel}:</strong> $${incomeMetric ? Math.round(incomeMetric) : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/SH.STA.BASS.RU.ZS?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Rural Sanitation Access:</strong> ${access} &#8599;
                    </a>
                    <span class="tag highlight"><strong>Unserved (Rural):</strong> ${unserved}</span>
                    <a href="https://data.worldbank.org/indicator/SI.POV.GINI?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Gini:</strong> ${data.gini ? data.gini.toFixed(1) : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Infl:</strong> ${data.inflation ? data.inflation.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/SI.POV.DDAY?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Poverty ($2.15):</strong> ${data.poverty ? data.poverty.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/IQ.CPA.TASP.XQ?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Gov Score:</strong> ${data.governance ? data.governance.toFixed(1) : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/FR.INR.LEND?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Lend Rate:</strong> ${data.lendingRate ? data.lendingRate.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                </div>
    `;

            const fillParam = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== null && val !== undefined && !isNaN(val)) {
                    // Fix: Formatting for Population and Grant
                    if (id === 'popReqToilets' || id === 'wiz-invest-grant-sidebar') {
                        el.value = parseInt(val).toLocaleString();
                    } else {
                        el.value = val;
                    }

                    // Fix: Do NOT add 'auto-filled' to manual grant input
                    if (id !== 'wiz-invest-grant-sidebar') {
                        el.classList.add('auto-filled');
                        el.style.backgroundColor = "#fef3c7"; // Amber-100 (Consistent with Smart Rates)
                    }

                    // Format if number
                    if (!isNaN(val) && val.toString().length > 3) {
                        // We can't put commas in type="number", so we just set value.
                        // But user asked for separators. If inputs are type="number", visual only works via CSS or type text.
                        // Assuming type="number", we leave as is but Color indicates it.
                        // Actually, let's try to set title for readability
                        el.title = val.toLocaleString();
                    }
                    el.dispatchEvent(new Event('input'));
                }
            };

            // 1. Demand & Transparency
            if (data.pop && data.basicSan) {
                const gap = (100 - data.basicSan) / 100;
                const req = Math.floor(data.pop * gap); // Unserved People
                fillParam('popReqToilets', req);

                // Update Transparency UI
                const setText = (id, txt) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = txt;
                };

                setText('transparency-pop', `Rural Pop: ${(data.pop / 1e6).toFixed(2)} M`);
                setText('transparency-access', `Access: ${data.basicSan.toFixed(1)}% `);
                setText('transparency-gap', `Unserved: ${(req / 1e6).toFixed(2)} M`);
            }

            // 2. Macro Variables
            let inflationVal = 5; // Default safe
            if (data.inflation) {
                inflationVal = data.inflation;
                inflationVal = data.inflation;
                fillParam('inflationRate', inflationVal.toFixed(2));
            }
            // Store Commercial Lending Rate for Benchmarking
            if (data.lendingRate) {
                const loanInput = document.getElementById('loanInterestRate_v2'); // UPDATED ID
                if (loanInput) loanInput.dataset.benchmark = data.lendingRate;

                // Fund Cost of Capital: BENCHMARK ONLY — do not overwrite the field.
                //
                // This used to be auto-filled from the commercial lending rate. In
                // Malawi that is 37%, so the tool opened on a blended-finance vehicle
                // borrowing at commercial rates, which contradicts the premise of the
                // instrument and made the demonstration scenario insolvent by month 28.
                //
                // The cost of capital is a negotiated term sheet, not a market
                // observable. Show the commercial rate for context and leave the
                // concessional default alone. See ADR-0018.
                const cocHelp = document.getElementById('coc-help');
                if (cocHelp) {
                    cocHelp.innerText = `Concessional senior debt. For context, commercial lending in this ` +
                        `country runs at about ${data.lendingRate.toFixed(1)}% — set this from your actual term sheet.`;
                }
            }
            if (data.popGrowth) fillParam('popGrowthRate', data.popGrowth.toFixed(2));
            // Fix: Use whole number for Percentage Input (e.g. 50 not 0.50)
            fillParam('grantSupportPct', (data.poverty !== null ? data.poverty.toFixed(2) : 50));

            // Default Rates (Conservative for Microfinance)
            fillParam('hhDefaultRate', 8); // 8% (was 0.08)
            fillParam('meDefaultRate', 10); // 10% (was 0.10)

            // Ops Costs (Lean for Solvency)
            fillParam('annualFixedOpsCost', 25000); // LOWERED to $25k to match LDC contexts & Inflation
            fillParam('mgmtFeeRatio', 2); // 2% 

            // Legacy Governance Logic Removed (Replaced by Political Stability below)

            // 3. Income & Affordability
            let gdpCapita = 500;
            if (incomeMetric) {
                gdpCapita = incomeMetric;
                fillParam('avgAnnualIncome', Math.round(incomeMetric));
            }

            // Phase 52: Smart Interest Rates (Using API Data)
            // Handled by Reactive Listener on 'inflationRate' -> UI.updateSmartRates()

            // Phase 55: Trigger Reactive Update Final Check
            // Reset Manual Locks so new country data applies freshly
            ['loanInterestRate_v2', 'meLoanInterestRate_v2'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    delete el.dataset.manual;
                    el.style.backgroundColor = ""; // Reset style
                }
            });

            if (typeof UI.updateSmartRates === 'function') {
                UI.updateSmartRates();
            }

            // Phase 52: Tiered Toilet Cost (GDP Adjusted)
            // 3 Tiers: <$1000 ($50), <$2500 ($75), >$2500 ($100)
            let smartCost = 100;
            if (gdpCapita < 1000) {
                smartCost = 50;
            } else if (gdpCapita < 2500) {
                smartCost = 75;
            }
            fillParam('avgToiletCost', smartCost);

            // 4. Update Affordability Calculation trigger (Grant Support)
            // If we have Income (GNI), checking toilets vs income might replace this logic?
            // CalculateAffordability function uses 'gdp' in 'UI.lastApiData'.
            // I should update UI.lastApiData to include 'gni'.
            UI.lastApiData = data;

            // Run Affordability Check (With new Smart Cost)
            UI.calculateAffordability(data, smartCost);

            // Phase 52: Poverty Override (Smart Grants)
            // If Poverty Data exists, it's a better proxy for subsidy need than GDP Estimate.
            if (data.poverty) {
                const povPct = Math.round(data.poverty);
                fillParam('grantSupportPct', povPct);

                const affHelp = document.getElementById('affordability-help');
                if (affHelp) {
                    affHelp.innerHTML += `<div style="margin-top:4px; border-top:1px dashed #ccc; padding-top:4px; color:#059669;">
    <strong>Smart Default:</strong> Set to ${data.poverty.toFixed(1)}% (Poverty Headcount &lt;$2.15 / day).
                    </div>`;
                }
            }

            // Phase 52: Political Stability Risk (Smart Contingency)
            // PV.EST is a Percentile Rank (0-100). Higher = More Stable.
            // Phase 52: Political Stability Risk (Smart Contingency)
            // PV.EST is a Percentile Rank (0-100). Higher = More Stable.
            if (data.politicalStability !== null && data.politicalStability !== undefined) {
                let riskRate = 5; // Base
                const score = data.politicalStability;
                let riskLabel = "Stable";

                if (score < 25) {
                    riskRate = 10;
                    riskLabel = `High Risk (Stability < 25th Pctl)`;
                } else if (score < 50) {
                    riskRate = 7;
                    riskLabel = `Elevated Risk (Stability < 50th Pctl)`;
                }

                fillParam('contingencyRate', riskRate);

                // Add a visual cue if risky
                if (riskRate > 5) {
                    const wbDiv = document.getElementById('wbIndicators');
                    if (wbDiv) {
                        wbDiv.innerHTML += `<div class="tag highlight" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca; margin-top:4px;">
    Risk Adjusted (Low Stability: ${score.toFixed(1)}): ${riskRate}% Reserve
                        </div>`;
                    }
                }
            }



            // Phase 51: Smart Scale (Districts)
            // Estimate administrative units based on population size
            // Heuristic: 1 District per 500k people
            if (data.pop) {
                const estDistricts = Math.max(1, Math.ceil(data.pop / 500000));
                fillParam('districts', estDistricts);
            }

            // --- NEW: ADM & Ops Logic ---
            const states = await ApiModule.fetchStates(countryObj.name);

            if (states.length > 0) {
                const admCount = states.length;
                fillParam('districts', admCount);

                // Dynamic Ops Cost: Base $10k + $500 per District (Lowered per user request)
                const opsCost = 10000 + (admCount * 500);
                fillParam('annualFixedOpsCost', opsCost);
            }

            // ME Capacity Recommendation
            if (data.pop && data.basicSan) {
                const gap = (100 - data.basicSan) / 100;
                const reqPeople = data.pop * gap;

                // Get current or just filled districts
                const districts = parseInt(document.getElementById('districts').value) || 1;

                // Assumptions for "Required Capacity"
                const hhSize = 5;
                const targetYears = 5; // Goal to unserved
                const unservedHH = reqPeople / hhSize;
                const hhPerDistrict = unservedHH / districts;
                const annualTargetPerDistrict = hhPerDistrict / targetYears;

                // ME Productivity
                const toiletsPerMeMonth = parseFloat(document.getElementById('toiletsPerMeMonth').value) || 5;
                const annualCapacityPerMe = toiletsPerMeMonth * 12;

                const recMes = Math.ceil(annualTargetPerDistrict / annualCapacityPerMe);

                fillParam('mePerDistrict', recMes);
            }

            // Override Removed: Model now relies on universal Solver logic for solvency.

            // Finally, Run Calculation (Enable Auto-Solver)
            runCalculation(true);
        }

    });

    // Chart Metric Toggle
    document.getElementById('chartMetricSelect').addEventListener('change', (e) => {
        if (UI.lastResults) {
            UI.renderCharts(UI.lastResults.series, e.target.value);
        }
    });

    // Phase 47: AI Advisor
    const aiBtn = document.getElementById('aiAdvisorBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            // Ensure stats are fresh
            if (UI.lastResults) UI.generateSuggestions();
            else {
                runCalculation();
                setTimeout(() => UI.generateSuggestions(), 100);
            }
        });
    }


    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
        });
    });
});

// Main Execution Wrapper (Smart Solvency Solver)
// FIX: Default isAutoAdjust to FALSE to prevent startup loops.
function runCalculation(isAutoAdjust = false, depth = 0) {
    if (depth > 5) {
        console.warn("[Solver] Max recursion depth reached. Stopping.");
        return;
    }
    try {
        let inputs = UI.getInputs();
        let results = ModelModule.calculate(inputs);

        // --- Execute Solvers (If Enabled) ---
        if (inputs.enableBreakEvenSolver) {
            results.breakEvenRate = ModelModule.solveBreakEven(inputs);
            results.maxGrantPct = ModelModule.solveMaxGrant(inputs);
        } else {
            results.breakEvenRate = null;
            results.maxGrantPct = null;
        }

        UI.lastResults = results;

        // --- Solvency advice (was: auto-adjustment) ---
        //
        // This block used to REWRITE the user's Grant Support % — up to five times per
        // click, in 200ms steps, recursing through the DOM — until the investor was
        // repaid. The scenario on screen was therefore not the scenario entered, and no
        // record was kept of what had been changed (F-04).
        //
        // Two reasons it is now advisory only:
        //   1. A financial model that edits its own assumptions to reach a desired
        //      conclusion cannot be audited.
        //   2. It did not work. Grant Support % is a pacing lever, not a volume lever —
        //      total subsidy is capped by the grant ledger, so sweeping it from 5% to
        //      90% moves output by 3.6% (F-30). The shortfall sits in the loan ledger,
        //      which grant spending barely touches.
        //
        // We compute what WOULD close the gap and offer it. We do not apply it.
        results.advice = null;
        if (isAutoAdjust && inputs.investLoan > 0) {
            const repaid = results.kpis.financials.investorRepaid || 0;
            const shortfall = inputs.investLoan - repaid;
            if (shortfall > 1000) {
                results.advice = ModelModule.suggestSolvencyFix(inputs, shortfall);
            }
        }

        if (UI.lastApiData) {
            UI.calculateAffordability(UI.lastApiData, inputs.avgToiletCost);
        }

        // Update UI
        if (UI.showAdvice) UI.showAdvice(results.advice);
        if (UI.updateKPIs) {
            UI.updateKPIs(results);
        }

        UI.renderCharts(results.series);
        if (UI.renderDataTable) {
            UI.renderDataTable(results); // This might fail if renderDataTable needs fixing? No, we saw it line 3380.
        }

    } catch (e) {
        console.error("Model Runtime Error:", e);
        alert("Error: " + e.message);
    }
}
// Format Number Inputs on Blur
document.querySelectorAll('.formatted-number, #popReqToilets').forEach(input => {
    input.addEventListener('blur', (e) => {
        const val = e.target.value.replace(/,/g, '');
        if (!isNaN(val) && val !== '') {
            e.target.value = parseInt(val).toLocaleString();
        }
    });
    // Initial format if value exists
    if (input.value) {
        const val = input.value.replace(/,/g, '');
        if (!isNaN(val)) input.value = parseInt(val).toLocaleString();
    }
});


window.runCalculation = runCalculation;

// Fix: Remove Yellow Tint from Manual Grant Input on Load
window.addEventListener('load', () => {
    const grantInput = document.getElementById('wiz-invest-grant-sidebar');
    if (grantInput) grantInput.classList.remove('auto-filled');

    // Ensure commas are applied if data loaded
    const popInput = document.getElementById('popReqToilets');
    if (popInput && popInput.value && !popInput.value.includes(',')) {
        popInput.value = parseInt(popInput.value).toLocaleString();
    }

    // Fix: Sync Duration and Fund Repayment (User Request)
    const durInput = document.getElementById('wiz-duration-sidebar');
    const repayInput = document.getElementById('fundRepaymentTerm');
    if (durInput && repayInput) {
        durInput.addEventListener('input', (e) => repayInput.value = e.target.value);
        repayInput.addEventListener('input', (e) => durInput.value = e.target.value);
    }
});
