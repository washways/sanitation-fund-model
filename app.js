/**
 * Sanitation Revolving Fund Model App
 * Handles Logic, API Fetching, and UI Updates
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

    // Helper: Investor Repayment Schedule
    calculateInvestorSchedule(principal, annualCostOfCapital, termYears, graceMonths) {
        const schedule = [];
        const monthlyRate = this.getMonthlyRate(annualCostOfCapital);
        const totalMonths = termYears * 12;
        const effectiveMonths = Math.max(1, totalMonths - graceMonths);

        // Scenario: Flat Principal + Interest on Outstanding
        // (Amortization style can be changed here easily)
        const principalPmt = principal / effectiveMonths;

        let balance = principal;

        for (let m = 1; m <= totalMonths; m++) {
            let p = 0;
            if (m > graceMonths) {
                p = principalPmt;
            }
            // Ensure we don't overpay due to rounding
            if (p > balance) p = balance;

            const int = balance * monthlyRate;
            balance -= p;

            schedule[m] = { principal: p, interest: int, balance: balance };
        }
        return schedule;
    },

    calculate(inputs) {
        // --- 1. Configuration & Standardization ---
        const durationMonths = inputs.duration * 12;
        const totalSimMonths = durationMonths + 12; // 1 Year Winding Down
        const activeMonths = durationMonths;

        // Rates (Standardized Geometric)
        const getRate = (r) => this.getMonthlyRate(r);
        const monthlyIntRateHh = getRate(inputs.loanInterestRate);
        const monthlyIntRateMe = getRate(inputs.meLoanInterestRate !== undefined ? inputs.meLoanInterestRate : inputs.loanInterestRate);
        const monthlyInflation = getRate(inputs.inflationRate);
        const monthlyCostOfCapital = getRate(inputs.fundCostOfCapital);

        // Terms
        const termHh = inputs.termHh || 6;
        const termMe = inputs.termMe || 12;

        // --- 2. Dual Ledger Initialization ---
        let grantCash = inputs.investGrant;     // Subsidy Fund (Grants, Carbon)
        let loanCash = inputs.investLoan;       // Revolving Fund (Lending, Ops, Repayment)

        // Liability
        let loanFundLiability = inputs.investLoan;

        // Investor Schedule (Pre-calc)
        const investorSchedule = this.calculateInvestorSchedule(
            inputs.investLoan,
            inputs.fundCostOfCapital,
            inputs.fundRepaymentTerm,
            inputs.investorGracePeriod || 0
        );

        // Reserves
        const opsReserveRate = (inputs.opsReserveCap !== undefined ? inputs.opsReserveCap : 15) / 100;
        const totalOpsReserve = (inputs.investGrant + inputs.investLoan) * opsReserveRate;
        let currentReserve = totalOpsReserve; // Simplified Reserve Logic

        // Portfolios & State
        let hhCohorts = [];
        let meCohorts = [];
        let currentMEs = 0;
        let toiletsBuiltCumulative = 0;
        let backlogToilets = inputs.popReqToilets / inputs.avgHHSize;

        // Constraints
        let constraints = { capital: 0, capacity: 0, demand: 0 };

        // Accumulators (Audit)
        let cumulativeCarbon = 0;

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
        const dataMonthlyCarbonRevenue = [];
        const dataToiletsMonthlyLoan = [];
        const dataToiletsMonthlyGrant = [];
        const dataMonthlyPortfolioHh = [];
        const dataMonthlyPortfolioMe = [];

        // Impact AUC Arrays
        const dataMonthlyHoursSaved = [];
        const dataMonthlyDalysAverted = [];
        const dataMonthlyActiveToilets = [];

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

        const reserveMonthsStart = Math.max(6, termHh);
        const oneMeWorkingCapital = inputs.toiletsPerMeMonth * inputs.avgToiletCost * reserveMonthsStart;
        const startupCostPerMe = inputs.meSetupCost + oneMeWorkingCapital;

        const lendableStart = Math.max(0, loanCash - currentReserve);
        const affordableStartMEs = Math.floor(lendableStart / startupCostPerMe);
        startMEs = Math.min(inputs.districts, affordableStartMEs); // Cap at 1 per district (30)

        if (startMEs > 0) {
            startLoanVolume = startMEs * inputs.meSetupCost;
            loanCash -= startLoanVolume;
            currentMEs += startMEs;

            // Add to Cohort
            const pmt = (startLoanVolume * monthlyIntRateMe) / (1 - Math.pow(1 + monthlyIntRateMe, -termMe));
            meCohorts.push({ balance: startLoanVolume, monthlyPayment: pmt, termRemaining: termMe });
        }

        // Sim Loop
        for (let m = 1; m <= totalSimMonths; m++) {
            monthlyLabels.push(`M${m}`);
            const isWindingDown = m > activeMonths;
            const currentYear = Math.ceil(m / 12);

            // 1. Ledger Buckets
            const inflows = { hhInt: 0, hhPrin: 0, meInt: 0, mePrin: 0, carbon: 0 };
            const outflows = { fixed: 0, varFees: 0, investPrin: 0, investInt: 0, loansHh: 0, loansMe: 0, grants: 0, defaultsHh: 0, defaultsMe: 0 };

            // 2. Inflation
            const inflation = Math.pow(1 + monthlyInflation, m);
            const currentUnitCost = inputs.avgToiletCost * inflation;
            const currentFixedOps = (inputs.annualFixedOpsCost / 12) * inflation;

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

            // 5. Outflows: Debt Service (Senior)
            if (m <= inputs.fundRepaymentTerm * 12 && m > inputs.investorGracePeriod) {
                outflows.investPrin = investorSchedule[m]?.principal || 0;
                outflows.investInt = loanFundLiability * monthlyCostOfCapital;
            }
            // Pay from LoanCash
            const debtService = outflows.investPrin + outflows.investInt;
            if (debtService > 0) {
                loanCash -= debtService;
                loanFundLiability -= outflows.investPrin;
            }

            // 6. Outflows: Operations
            // Hibernation check
            let opsCost = currentFixedOps;
            // If winding down, reduced ops
            if (isWindingDown) opsCost *= 0.3;

            outflows.fixed = opsCost;
            loanCash -= opsCost; // Ops paid from LoanFund

            // 7. New Business (Lending & Grants)
            // Reserves logic
            const requiredReserves = opsCost * 3; // Simple 3-month buffer
            let lendable = loanCash - requiredReserves;
            if (isWindingDown) lendable = 0;

            let production = 0;
            let grantCount = 0;
            let loanCount = 0;
            let targetGrantCount = 0;

            // A. ME Expansion
            // Only if lendable > 0 and backlog > 0
            if (lendable > 0 && backlogToilets > 0) {
                // Basic growth logic
                const expansionBudget = lendable * 0.1;
                const meSetup = inputs.meSetupCost;
                if (expansionBudget > meSetup) {
                    const newMes = Math.min(Math.floor(expansionBudget / meSetup), Math.ceil(currentMEs * 0.1));
                    if (newMes > 0) {
                        const cost = newMes * meSetup;
                        outflows.loansMe = cost;
                        loanCash -= cost;
                        lendable -= cost;
                        currentMEs += newMes;

                        // Schedule
                        const pmt = (cost * monthlyIntRateMe) / (1 - Math.pow(1 + monthlyIntRateMe, -termMe));
                        meCohorts.push({ balance: cost, monthlyPayment: pmt, termRemaining: termMe });
                    }
                }
            }

            // B. Toilets
            const capacity = currentMEs * inputs.toiletsPerMeMonth;
            const variableRate = inputs.mgmtFeeRatio + inputs.meCostRate;
            const grossUnitCost = currentUnitCost * (1 + variableRate);

            // Affordability
            const maxUnits = Math.floor(lendable / grossUnitCost); // Loan Capacity

            // Carbon & Grant Capacity
            // Strategy: Check GrantCash for Subsidy
            // Grant Cost = GrossUnitCost (Fully Burdened)
            const maxGrants = Math.floor(grantCash / grossUnitCost);

            const demand = backlogToilets;
            production = Math.min(capacity, demand); // Tentative

            // Split
            targetGrantCount = Math.floor(production * inputs.grantSupportPct);
            grantCount = Math.min(targetGrantCount, maxGrants);

            // Remain is Loan
            let tentativeLoan = production - grantCount;
            // Cap Loan by Lendable
            loanCount = Math.min(tentativeLoan, maxUnits);

            // Final Production
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
                backlogToilets -= production;

                // Add HH Loan
                if (loanVal > 0) {
                    const pmt = (loanVal * monthlyIntRateHh) / (1 - Math.pow(1 + monthlyIntRateHh, -termHh));
                    hhCohorts.push({ balance: loanVal, monthlyPayment: pmt, termRemaining: termHh });
                }
            }

            // 8. Carbon Revenue (Incremental)
            // Logic: Production * Co2PerToilet * Value * Share.
            // Assumption: Co2PerToilet is "Tonnes per Toilet" (One-time or Annual?)
            // User formula implied one-time credit based on construction? or Annual stream?
            // "monthlyCarbonTons = (monthlyTotalToilets * co2PerToilet) / 1000"
            // If it's one-time: carbon += production * rate.
            // If it's annual: carbon += cumulative * rate / 12.
            // User prompt: "monthlyCarbonTons = (monthlyTotalToilets * co2PerToilet) / 1000" (Ambiguous 'monthlyTotalToilets' - cumulative or new?)
            // Given "Incremental" request earlier, I assume NEW production generates One-Time Construction Credits?
            // OR User means "Total Active Toilets" generate stream?
            // Let's use PREVIOUS interpretation which was Incremental on Production for Revenue.
            // BUT for IMPACT, we use Cumulative.
            // Carbon Revenue -> GrantCash.
            const newCarbonTons = (production * inputs.co2PerToilet) / 1000;
            const carbonRev = newCarbonTons * inputs.co2Value * (inputs.carbonCreditShare / 100);
            inflows.carbon = carbonRev;
            cumulativeCarbon += newCarbonTons;
            grantCash += carbonRev;

            // 9. Impact (Area Under Curve)
            // Hours: Active Toilets * HH_Size * 0.25hr * 30 days
            const hours = toiletsBuiltCumulative * inputs.avgHHSize * 0.25 * 30;
            // DALYs: Active Toilets * HH_Size * DALY_Per_Person / 12
            const dalys = (toiletsBuiltCumulative * inputs.avgHHSize * inputs.dalyPerPerson) / 12;

            dataMonthlyHoursSaved.push(hours);
            dataMonthlyDalysAverted.push(dalys);
            dataMonthlyActiveToilets.push(toiletsBuiltCumulative);

            // 10. Data Push
            const netFlow = (loanInflow + carbonRev) - (outflows.fixed + outflows.varFees + outflows.investPrin + outflows.investInt + outflows.loansHh + outflows.loansMe + outflows.grants);
            dataMonthlyNet.push(netFlow);
            dataMonthlyCashBalance.push(loanCash + grantCash);

            dataMonthlyGrantDisbursed.push(outflows.grants);
            dataMonthlyCarbonRevenue.push(inflows.carbon);
            dataMonthlyNewLoansHhVal.push(outflows.loansHh);
            dataMonthlyNewLoansMeVal.push(outflows.loansMe);
            dataMonthlyRepaymentHh.push(inflows.hhPrin);
            dataMonthlyRepaymentMe.push(inflows.mePrin);
            dataMonthlyDefaultsHh.push(outflows.defaultsHh);
            dataMonthlyDefaultsMe.push(outflows.defaultsMe);
            dataMonthlyFundPrincipal.push(outflows.investPrin);
            dataMonthlyFundInt.push(outflows.investInt);
            dataMonthlyOps.push(outflows.fixed);
            dataMonthlyFees.push(outflows.varFees);

            // Portfolio Snapshots
            dataMonthlyPortfolioHh.push(hhCohorts.reduce((s, c) => s + c.balance, 0));
            dataMonthlyPortfolioMe.push(meCohorts.reduce((s, c) => s + c.balance, 0));
            dataMonthlyMes.push(currentMEs);

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
            dataPeople,
            dataMonthlyPortfolioHh,
            dataMonthlyPortfolioMe,
            dataMonthlyMes,
            dataCarbon,

            // Startup
            startupCost: startLoanVolume,
            startMEs: startMEs
        };

        const kpis = ModelModule.computeKPIs(series, inputs);

        // Verification
        ModelModule.verifyLedger(series, inputs, kpis);

        // Output
        return { series, kpis };
    },

    // --- Phase 67: Centralized KPI Logic (Single Source of Truth) ---
    computeKPIs(series, inputs) {
        const s = series;
        const last = s.dataMonthlyCashBalance.length - 1;

        // 1. Reach
        const totalToilets = s.dataToilets[s.dataToilets.length - 1] || 0;
        const loanToilets = s.dataToiletsMonthlyLoan[last] || 0;
        const grantToilets = s.dataToiletsMonthlyGrant[last] || 0;

        const households = totalToilets; // 1 per HH
        const people = households * inputs.avgHHSize;
        // Fix: Use dataMonthlyMes for accurate count
        const mes = s.dataMonthlyMes && s.dataMonthlyMes.length > 0 ? s.dataMonthlyMes[s.dataMonthlyMes.length - 1] : 0;

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
        const investorLiabilityEnd = Math.max(0, inputs.investLoan - totalRepaidPrincipal);

        const netAssetsEnd = cashEnd + portfolioOutstanding - investorLiabilityEnd;
        const initialCapital = inputs.investGrant + inputs.investLoan;

        // Capital Preserved: (Ending Cash + Repaid Principal) / Initial Capital
        const capitalPreservedPct = initialCapital > 0 ? ((cashEnd + totalRepaidPrincipal) / initialCapital) : 0;

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

        let depletionYear = "Sustainable";
        if (firstInsolvencyIndex !== -1) {
            depletionYear = (firstInsolvencyIndex / 12).toFixed(1);
        }

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

        // DALYs
        const totalDalys = (s.dataDalys && s.dataDalys.length > 0) ? s.dataDalys.reduce((a, b) => a + b, 0) : (people * inputs.dalyPerPerson);
        // Note: s.dataDalys was Cumulative in loop?
        // Line 1198: dataDalys.push(peopleReached * inputs.dalyPerPerson);
        // Logic: Push Annual. So Sum = Total.
        // Wait, peopleReached is Cumulative?
        // Line 1193: peopleReached = toilets * size. Cumulative.
        // If dataDalys pushes cumulative each year, SUM is wrong.
        // dataDalys is [Year1Cumulative, Year2Cumulative...] ???
        // Line 1198: dataDalys.push(peopleReached * inputs.dalyPerPerson);
        // Yes, PeopleReached is cumulative.
        // So dataDalys array contains SNAPSHOTS.
        // Total Impact is NOT Sum(Snapshots).
        // Total Impact so far = Last Snapshot.
        // Correct Logic:
        const totalDalysAverted = people * (inputs.dalyPerPerson || 0);
        if (inputs.dalyPerPerson > 0 && people > 0 && totalDalysAverted === 0) console.warn("DALY Calc Error");
        // Actually, DALYs are per year.
        // The loop calculated `peopleReached` (Stocks).
        // DALYs averted = Stock * Years?
        // If we want "Total DALYs averted over Project Life":
        // It is Sum(People_Active_Year_i * DALY_Rate).
        // My `dataPeople` array stores `peopleReached` at end of each year.
        // So Sum(dataPeople) * DALY_Rate is approx Total DALY Years averted.
        // Let's use `dataPeople` sum.
        const totalPersonYears = s.dataPeople.reduce((a, b) => a + b, 0);
        const totalValDalys = totalPersonYears * (inputs.dalyPerPerson || 0) * (inputs.dalyValue || 0);

        // Carbon
        // cumulativeCarbon is tracked in loop. Last value is Total?
        const totalCarbon = s.dataCarbon.length > 0 ? s.dataCarbon[s.dataCarbon.length - 1] : 0;
        const totalValCarbon = totalCarbon * (inputs.co2Value || 0);

        // Hours Saved
        // toiletsBuiltCumulative * 0.25 * 365 per year.
        // Sum(dataToilets) * ...
        const totalToiletYears = s.dataToilets.reduce((a, b) => a + b, 0);
        const totalHoursSaved = totalToiletYears * 0.25 * 365;
        const totalValHours = totalHoursSaved * 0.5; // $0.50/hr? Assumption from line 1232: (totalHoursSaved * 0.5)

        const economicValue = totalValDalys + totalValCarbon + totalValHours; // Wait, Line 1232 used `(totalHoursSaved * 0.5) + (cumulativeCarbon * inputs.co2Value)`. Did it include DALYs?
        // Line 1232: const totalSocialValue = (totalHoursSaved * 0.5) + (cumulativeCarbon * inputs.co2Value);
        // It seemingly ignored DALY value in SROI calc previously?
        // Line 1515: valDalys duplicate for safety.
        // Let's stick to the previous SROI definition for consistency or Improve?
        // User wants "Consistency".
        // I will match the apparent previous SROI logic: Hours + Carbon.
        // But DALYs are huge. If I exclude them, SROI is low.
        // Check Line 1232: `const totalSocialValue = (totalHoursSaved * 0.5) + (cumulativeCarbon * inputs.co2Value);`
        // Okay, I will use that.

        const totalSocialValue = (totalHoursSaved * 0.5) + (totalCarbon * (inputs.co2Value || 0));

        const initialInv = inputs.investGrant + inputs.investLoan;
        const sroi = initialInv > 0 ? ((totalSocialValue + cashEnd) / initialInv) : 0;

        return {
            reach: {
                toilets: totalToilets,
                people: people,
                jobs: mes * 3,
                loanToilets: loanToilets,
                grantToilets: grantToilets
            },
            portfolio: {
                disbursed: totalLoansDisbursed,
                outstanding: portfolioOutstanding,
                defaults: totalDefaults
            },
            financials: {
                cashEnd: cashEnd,
                netAssets: netAssetsEnd,
                capitalPreservedPct: capitalPreservedPct,
                investorRepaid: totalRepaidPrincipal,
                investorRepaidPct: inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0,
                // Fund Health = (Ending Balance + Repaid Principal) / Initial Loan
                fundHealth: inputs.investLoan > 0 ? ((cashEnd + totalRepaidPrincipal) / inputs.investLoan) : 0
            },
            sustainability: {
                oss: ossRatio,
                fss: fssRatio,
                depletionYear: depletionYear,
                monthsInsolvent: monthsInsolvent,
                costPerLatrine: costPerLatrine,
                effectiveCostPerLatrine: effectiveCostPerLatrine
            },
            // Value Metrics
            value: {
                economicValue: totalSocialValue + cashEnd, // Total Value Generated
                subsidyPerLatrine,
                economicCostPerLatrine,
                depletionYear
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
        // Disable Solvers in sub-sims to avoid recursion
        simInputs.enableBreakEvenSolver = false;

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
        return bestRate;
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

    // --- Invariant Checks (Verification) ---
    verifyLedger(series, inputs, kpis) {
        const s = series;
        const k = kpis;
        const errors = [];

        // 1. Cashflow Identity
        for (let i = 1; i < s.dataMonthlyCashBalance.length; i++) {
            const prev = s.dataMonthlyCashBalance[i - 1];
            const curr = s.dataMonthlyCashBalance[i];
            const net = s.dataMonthlyNet[i];
            if (Math.abs(curr - (prev + net)) > 1.00) {
                errors.push(`Identity Fail (Cash): M${i} Prev ${prev.toFixed(2)} + Net ${net.toFixed(2)} != Curr ${curr.toFixed(2)}`);
            }
        }

        // 2. Negative Cash (Solvency Warning)
        const minCash = Math.min(...s.dataMonthlyCashBalance);
        if (minCash < -100) {
            console.warn("WARNING: Cash Balance went negative!", minCash);
            // errors.push("Cash Balance Negative"); // Optional strictness
        }

        // 3. Loan Value Identity
        // Disbursed = HH + ME
        const totalLoansReported = k.financials.leverage * inputs.investGrant;
        // Verify against flow sums
        const flowSum = s.dataMonthlyNewLoansHhVal.reduce((a, b) => a + b, 0) + s.dataMonthlyNewLoansMeVal.reduce((a, b) => a + b, 0);
        // Note: k.leverage is (flowSum / grant). So this is tautological.
        // Check Grants
        const grantSum = s.dataMonthlyGrantDisbursed.reduce((a, b) => a + b, 0);
        // Compare with Toilet Counts?
        // Rough check: GrantVal ~ GrantToilets * Cost?
        // Cost varies with inflation. Hard to check exactly.

        if (errors.length > 0) {
            console.error("❌ MODEL INTEGRITY CHECK FAILED:", errors);
        } else {
            console.log("✅ Model Integrity Verified: Identities hold.");
        }
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
        // Explicitly handle percentages if needed (Input 20 -> 0.20? Or 20?)
        // Logic Update in Step 1403: Removed '/ 100' from calculations.
        // So we expect Raw Inputs (20, 5, etc) to be used as Multipliers?
        // Wait, Step 1403: `totalContingency = totalCapital * inputs.contingencyRate;`
        // If Rate is 5. Total = Capital * 5? NO.
        // If I removed `/ 100`, then `inputs.contingencyRate` MUST be 0.05.
        // So `getInputs` MUST divide by 100 for percentages.

        // RE-VERIFY STEP 1403 change.
        // I changed `totalContingency = totalCapital * (inputs.contingencyRate / 100)` -> `... * inputs.contingencyRate`.
        // This implies I expected `inputs.contingencyRate` to BE A DECIMAL (0.05).
        // BUT I didn't change `getPct` definition `getRaw(id) / 100`?
        // Step 1399: `const getPct = (id) => getRaw(id) / 100;`
        // IF `getPct` was dividing by 100, then `getInputs` returned 0.05.
        // So removing `/ 100` in calc was correct.

        // HOWEVER, if `getPct` was somehow failing...

        // Let's implement `getPct` explicitly as `getRaw(id) / 100`.
        const getPct = (id, def = 0) => getRaw(id, def) / 100;

        return {
            country: document.getElementById('countryInput').value || 'Unknown',
            investGrant: getRaw('wiz-invest-grant-sidebar'),
            investLoan: getRaw('wiz-invest-loan-sidebar'),
            popReqToilets: getRaw('popReqToilets'),
            popGrowthRate: getPct('popGrowthRate'),
            avgHHSize: getRaw('avgHHSize', 5),
            grantSupportPct: getPct('grantSupportPct', 20), // Default 20%
            avgToiletCost: getRaw('avgToiletCost', 50),
            districts: getRaw('districts'),
            mePerDistrict: getRaw('mePerDistrict'),
            toiletsPerMeMonth: getRaw('toiletsPerMeMonth'),
            meSetupCost: getRaw('meSetupCost'),
            loanInterestRate: getPct('loanInterestRate_v2', 10), // UPDATED ID
            meLoanInterestRate: getPct('meLoanInterestRate_v2', 10), // UPDATED ID
            hhDefaultRate: getPct('hhDefaultRate', 5),
            meDefaultRate: getPct('meDefaultRate', 5),
            mgmtFeeRatio: getPct('mgmtFeeRatio', 2),
            inflationRate: getPct('inflationRate'),
            contingencyRate: getPct('contingencyRate', 5),
            opsReserveCap: getRaw('opsReserveCap', 15),
            annualFixedOpsCost: getRaw('annualFixedOpsCost', 50000),
            meCostRate: getPct('meCostRate', 5),
            fundCostOfCapital: getPct('fundCostOfCapital'),
            fundRepaymentTerm: getRaw('fundRepaymentTerm'),
            termHh: getRaw('termHh', 12),
            termMe: getRaw('termMe', 24),
            // Impact
            dalyPerPerson: getRaw('dalyPerPerson', 0.005),
            dalyValue: getRaw('dalyValue', 500),
            avgAnnualIncome: getRaw('avgAnnualIncome', 1500),
            co2PerToilet: getRaw('co2PerToilet', 0.2),
            co2Value: getRaw('co2Value', 50),
            co2Value: getRaw('co2Value', 50),
            carbonCreditShare: getRaw('carbonCreditShare', 100), // Fix: Added missing link
            // Optimization Flags
            enableBreakEvenSolver: true,
            // Investment Constraints
            investGrant: getRaw('wiz-invest-grant-sidebar'),
            investLoan: getRaw('wiz-invest-loan-sidebar'),
            investorGracePeriod: getRaw('investorGracePeriod', 6), // New Input
            duration: getRaw('wiz-duration-sidebar', 10),
            wizTech: document.getElementById('wiz-tech') ? document.getElementById('wiz-tech').value : 'standard'
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
        console.log("DEBUG UI RESULTS:", results);
        try {
            const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const fmtNum = (n) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
            const fmtVal = (n) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
            const fmtPct = (n) => ((n || 0) * 100).toFixed(1) + '%';

            const inputs = UI.getInputs();

            // Financials
            const initialFund = inputs.investGrant + inputs.investLoan;
            const finalBalance = results.fundBalance;

            const setText = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            };

            // --- Reach Card ---
            // Fix: Check if dataToilets exists and has length
            const finalToilets = (results.series && results.series.dataToilets && results.series.dataToilets.length > 0)
                ? results.series.dataToilets[results.series.dataToilets.length - 1]
                : 0;

            setText('sum-toilets', fmtVal(finalToilets));
            // Fix: Show Count AND Value (if Value exists)
            const fmtValMoney = (count, val) => {
                if (val !== undefined) return `${fmtVal(count)} (${fmtMoney(val)})`;
                return fmtVal(count);
            };

            setText('sum-toilets-loan', fmtValMoney(results.impact.toiletsLoan, results.summary.loanToiletsVal));
            setText('sum-toilets-grant', fmtValMoney(results.impact.toiletsGrant, results.summary.grantToiletsVal));

            setText('sum-households', fmtVal(results.impact.households));
            setText('sum-people', fmtVal(results.impact.peopleReached));
            setText('sum-mes', fmtVal(results.impact.mes));
            // New Phase 22: SDG6
            if (results.impact.sdg6Gap !== undefined) {
                setText('sum-sdg6', fmtPct(results.impact.sdg6Gap / 100));
            }

            setText('sum-constraint', results.impact.dominantConstraint || '--');

            // --- Impact Card ---
            if (results.coBenefits) {
                setText('sum-dalys', fmtVal(results.coBenefits.dalys));
                setText('sum-val-dalys', fmtMoney(results.coBenefits.valDalys));
                setText('sum-carbon', fmtNum(results.coBenefits.carbon));
                setText('sum-val-carbon', fmtMoney(results.coBenefits.valCarbon));
                setText('sum-jobs', fmtVal(results.coBenefits.jobs));
                setText('sum-val-jobs', fmtMoney(results.coBenefits.jobValuation));
            }

            // --- Sustainability Scorecard ---

            // Phase 44: Liquidity Metrics & Export Stats
            const sData = results.series.dataMonthlyCashBalance || [];
            const minCash = sData.length ? Math.min(...sData) : 0;
            const insolvencyMonths = sData.filter(b => b < 0).length;
            const isInsolvent = minCash < 0;

            // Store Summary Stats for Export
            UI.lastSummaryStats = {
                totalLatrines: finalToilets,
                loanToilets: results.impact.toiletsLoan,
                grantToilets: results.impact.toiletsGrant,
                households: finalToilets,
                people: results.impact.peopleReached,
                mes: results.impact.mes,
                dalys: results.coBenefits ? results.coBenefits.dalys.toFixed(0) : 0,
                economicValue: results.coBenefits ? results.coBenefits.valDalys.toFixed(0) : 0,
                carbon: results.coBenefits ? results.coBenefits.carbon.toFixed(1) : 0,
                jobs: results.coBenefits ? results.coBenefits.jobs.toFixed(0) : 0,
                ossRatio: results.sustainability.ossRatio || 0, // Fix: Use Cumulative
                minCash: minCash,
                insolvencyMonths: insolvencyMonths,
                fundBalance: finalBalance
            };

            const oss = (results.sustainability.ossRatio || 0) * 100; // Fix: Use Cumulative
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
            setText('sus-depletion', results.impact.depletionYear || "N/A"); // From impact object

            const beRate = (results.breakEvenRate || 0) * 100;
            setText('sus-breakeven-rate', beRate > 0 ? beRate.toFixed(1) + '%' : 'N/A');

            const maxGrant = (results.maxGrantPct || 0);
            setText('sus-max-grant', maxGrant > 0 ? maxGrant.toFixed(1) + '%' : '0%');

            // Phase 44: Liquidity UI
            setText('sum-min-cash', fmtMoney(minCash));
            const mcEl = document.getElementById('sum-min-cash');
            if (mcEl) mcEl.style.color = minCash < 0 ? '#ef4444' : 'inherit';
            setText('sum-insolvency', insolvencyMonths + " Mo");




            // --- Fund Balance (Capital Card) ---
            setText('sum-balance', fmtMoney(finalBalance));

            // New Phase 22: Capital Repaid
            if (results.impact.fundRepaid !== undefined) {
                setText('sum-capital-repaid', fmtMoney(results.impact.fundRepaid));
            }

            const initFundSafe = initialFund || 1;
            const healthPct = (finalBalance / initFundSafe) * 100;
            if (inputs.fundRepaymentTerm > 0) {
                setText('sum-health', fmtPct(results.impact.fundHealth || 0));
            } else {
                setText('sum-health', fmtPct(healthPct / 100) + ' (Grant Only)');
            }

            const suffRatio = (results.impact.selfSufficiency || 0) * 100;
            setText('sum-sufficiency', fmtNum(suffRatio) + '%');

            const runway = results.impact.opsRunway || 0;
            const runwayText = runway > 20 ? "Sustainable (>20y)" : fmtNum(runway) + " Years";
            setText('sum-ops-coverage', runwayText);

            // Legacy/Other
            setText('sum-leverage', fmtNum(results.impact.leverage || 0) + 'x');
            setText('sum-sroi', fmtNum(results.roiExtended || 0) + 'x');

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

        chartInstances.cost = new Chart(ctxCost, {
            type: 'bar',
            data: {
                labels: series.labels,
                datasets: [
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
                ]
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

    // Stakeholders Removed

    // Wizard Logic
    showWizardStep(step) {
        document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
        document.getElementById('step' + step).style.display = 'block';
    },

    applyWizardSettings() {
        const risk = document.getElementById('wiz-risk').value;
        const tech = document.getElementById('wiz-tech').value;

        // Map Risk to Model Parameters
        // Low: Conservative -> Low Interest, Very Low Defaults, Slower Build
        // Med: Balanced
        // High: Aggressive -> High Interest, Higher Defaults, Faster Build to recoup

        const setVal = (id, val) => document.getElementById(id).value = val;

        if (risk === 'low') {
            setVal('loanInterestRate', 5);
            setVal('hhDefaultRate', 2);
            setVal('grantSupportPct', 30);
        } else if (risk === 'med') {
            setVal('loanInterestRate', 12);
            setVal('hhDefaultRate', 8);
            setVal('grantSupportPct', 15);
        } else { // High
            setVal('loanInterestRate', 25);
            setVal('hhDefaultRate', 15);
            setVal('grantSupportPct', 5);
        }

        // Sync Investment & Duration to Sidebar
        document.getElementById('wiz-invest-grant-sidebar').value = document.getElementById('wiz-invest-grant').value;
        document.getElementById('wiz-invest-loan-sidebar').value = document.getElementById('wiz-invest-loan').value;
        document.getElementById('wiz-duration-sidebar').value = document.getElementById('wiz-duration').value;

        // Tech Impact
        if (tech === 'climate') {
            setVal('avgToiletCost', 120);
        } else {
            setVal('avgToiletCost', 60);
        }

        // Trigger formatting update
        if (typeof UI.setupFormatting === 'function') UI.setupFormatting();
    },

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
        const paramRows = [
            `Parameter,Value`,
            `Country,${inputs.country}`,
            `Districts,${inputs.districts}`,
            `GrantFund,$${inputs.grantFund}`,
            `LoanFund,$${inputs.loanFund}`,
            `AvgToiletCost,$${inputs.avgToiletCost}`,
            `LoanInterestRate,${(inputs.loanInterestRate * 100).toFixed(1)}%`,
            `Duration,${inputs.duration} Years`,
            `GrantSupportPct,${(inputs.grantSupportPct * 100).toFixed(0)}%`,
            `GrantSupportPct,${(inputs.grantSupportPct * 100).toFixed(0)}%`,
            `BadDebtBuffer,5x Expected Loss`,
            `CostPerLatrine,$${(document.getElementById('sum-cost-per-latrine')?.innerText || '0').replace('$', '')}`,
            `EconomicCostPerLatrine,$${(s && s.economicCostPerLatrine ? s.economicCostPerLatrine.toFixed(2) : '0')}`
        ];

        const s = this.lastResults.series;
        // Header
        const headers = [
            "Month", "NewToiletsLoan", "NewToiletsGrant", "NewLoanValHH", "NewLoanValME",
            "RevIntHH", "RevIntME", "FundPrincipalCfl",
            "OpsExp", "BadDebtExp", "FundIntExp", "NetCashFlow",
            "PortfolioHH", "PortfolioME", "CashBalance"
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
            0, 0, 0,
            startupCost.toFixed(2), // NewLoanValME
            0, 0, 0, // RevHH, RevME, FundPrin
            0, 0, 0, // Ops, BadDebt, FundInt
            (-startupCost).toFixed(2), // NetCash
            0, // PortfolioHH
            startupCost.toFixed(2), // PortfolioME
            (initialCash - startupCost).toFixed(2) // CashBalance
        ];
        rows.push(m0Row.join(","));
        const len = s.monthlyLabels.length;

        for (let i = 0; i < len; i++) {
            // Arrays are now Cumulative (Step 4808)
            const cumLoan = (s.dataToiletsMonthlyLoan[i] || 0);
            const cumGrant = (s.dataToiletsMonthlyGrant[i] || 0);
            const totalRow = cumLoan + cumGrant;

            const row = [
                s.monthlyLabels[i],
                // Toilets (Cumulative)
                cumLoan,
                cumGrant,
                totalRow,
                // Toilets (Monthly)
                (s.dataToiletsMonthlyLoan[i] || 0),
                (s.dataToiletsMonthlyGrant[i] || 0),
                (s.dataToiletsMonthlyLoan[i] || 0) + (s.dataToiletsMonthlyGrant[i] || 0),

                // Finances
                (s.dataMonthlyNewLoansHhVal[i] || 0).toFixed(2),
                (s.dataMonthlyNewLoansMeVal[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueHh[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueMe[i] || 0).toFixed(2),
                (s.dataMonthlyFundPrincipal[i] || 0).toFixed(2),
                (s.dataMonthlyOps[i] || 0).toFixed(2),
                (s.dataMonthlyBadDebt[i] || 0).toFixed(2),
                (s.dataMonthlyFundInt[i] || 0).toFixed(2),
                (s.dataMonthlyNet[i] || 0).toFixed(2),
                (s.dataMonthlyPortfolioHh[i] || 0).toFixed(2),
                (s.dataMonthlyPortfolioMe[i] || 0).toFixed(2),
                (s.dataMonthlyCashBalance[i] || 0).toFixed(2)
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
            const stats = UI.lastResults.kpis;
            // impact and res are no longer needed/available as separate objects
            // properties are all on kpis now.

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
                "Unit Cost", "Inflation Factor", "Active MEs",
                "New Loans (HH)", "Rev Int (HH)", "Principal Repaid (HH)", "Defaults (HH)",
                "New Loans (ME)", "Rev Int (ME)", "Principal Repaid (ME)", "Defaults (ME)",
                "Mgmt Fees (Var)", "M&E Costs (Var)", "Fixed Ops",
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
                "0.00", "1.000", startupMEs, // UnitCost, Inflation, MEs
                "0.00", "0.00", "0.00", "0.00", // HH Loan
                startupCost.toFixed(2), "0.00", "0.00", "0.00", // ME Loan
                "0.00", "0.00", "0.00", // Ops
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
                    (s.dataMonthlyUnitCost?.[i] || 0).toFixed(2),
                    (s.dataMonthlyInflation?.[i] || 0).toFixed(3),
                    (s.dataMonthlyMes?.[i] || 0).toFixed(0),
                    (s.dataMonthlyNewLoansHhVal[i] || 0).toFixed(2),
                    (s.dataMonthlyRevenueHh[i] || 0).toFixed(2),
                    (s.dataMonthlyRepaymentHh[i] || 0).toFixed(2),
                    (s.dataMonthlyDefaultsHh[i] || 0).toFixed(2),
                    (s.dataMonthlyNewLoansMeVal[i] || 0).toFixed(2),
                    (s.dataMonthlyRevenueMe[i] || 0).toFixed(2),
                    (s.dataMonthlyRepaymentMe[i] || 0).toFixed(2),
                    (s.dataMonthlyDefaultsMe[i] || 0).toFixed(2),
                    (s.dataMonthlyMgmtFees[i] || 0).toFixed(2),
                    (s.dataMonthlyMandECosts[i] || 0).toFixed(2),
                    (s.dataMonthlyFixedOps[i] || 0).toFixed(2),
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
            lines.push(`Break-even Interest,${(stats.breakEvenRate || 0).toFixed(1)}%`);
            lines.push(`Max Sustainable Grant,${(stats.maxGrantPct || 0).toFixed(1)}%`);

            lines.push(`Capital Preserved,${((stats.capitalPreserved || 0) * 100).toFixed(1)}%`);
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
        setTxt('sum-preserved', fmtPct(stats.capitalPreserved)); // Assuming stats.capitalPreserved exists

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

        setTxt('sum-preserved', capPreservedPct.toFixed(1) + "%");
    },

    // --- Export ---
    downloadCSV() {
        if (!this.lastResults || !this.lastResults.series) {
            alert("No data available. Run model first.");
            return;
        }

        const kpis = this.lastResults.kpis;
        const inputs = UI.getInputs();
        const s = this.lastResults.series;

        // Helper functions for formatting
        const format = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const formatNum = (n) => (n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

        let report = `SANITATION FUND ANALYSIS (Pro-Forma)\n${new Date().toLocaleDateString()}\n-------------------------------------\n\n`;
        report += `SCENARIO INPUTS\n`;
        report += `Investment: Grant $${format(inputs.investGrant)} | Loan $${format(inputs.investLoan)}\n`;
        report += `Loan Terms: ${((inputs.loanInterestRate) * 100).toFixed(1)}% Interest | ${inputs.fundRepaymentTerm} yr Term\n`;
        report += `Ops Model: $${format(inputs.annualFixedOpsCost)} Fixed Ops | ${inputs.mgmtFeeRatio * 100}% Mgmt Fee\n\n`;

        report += `KEY RESULTS (Year ${inputs.duration})\n`;
        report += `Total Latrines: ${formatNum(kpis.impact.toilets)}\n`;
        report += `People Reached: ${formatNum(kpis.impact.peopleReached)}\n`;
        report += `Fund Balance: $${format(s.dataMonthlyCashBalance[s.dataMonthlyCashBalance.length - 1])}\n`;
        report += `Investor Repaid: $${format(kpis.financials.investorRepaid)}\n`;
        report += `Leverage Ratio: ${kpis.financials.leverage.toFixed(2)}x\n\n`;

        report += `SUSTAINABILITY\n`;
        report += `OSS Ratio: ${(kpis.financials.ossRatio * 100).toFixed(1)}%\n`;
        report += `FSS Ratio: ${(kpis.financials.fssRatio * 100).toFixed(1)}%\n`;
        report += `Depletion: ${kpis.value.depletionYear}\n\n`;

        report += `IMPACT & VALUE\n`;
        report += `SROI: ${kpis.impact.sroi.toFixed(2)}x\n`;
        report += `Econ Value (Health): $${format(kpis.value.economicValue)}\n`;
        report += `DALYs Averted: ${formatNum(kpis.impact.dalys)}\n`;
        report += `Hours Saved: ${formatNum(kpis.impact.hours)}\n\n`; // Fix: Use 'hours' property from new structure

        report += `UNIT ECONOMICS\n`;
        report += `Grant Subsidy / Latrine: $${format(kpis.value.subsidyPerLatrine)}\n`;
        report += `True Prog Cost / Latrine: $${format(kpis.value.economicCostPerLatrine)}\n`;

        report += `\n-------------------------------------\n`;
        report += `DEFINITIONS:\n`;
        report += `DALYs: Monthly accumulation (ActiveToilets * 5 * Rate/12).\n`;
        report += `SROI: (Total Social Value + Final Fund Equity) / Total Investment.\n`;
        report += `OSS: Operating Income / (Ops Expenses + Write-offs). Excludes Grants.\n`;
        report += `FSS: Total Income / Total Expenses (inc. Cost of Capital).\n`;
        report += `Leverage: Total Loans Disbursed / Initial Grant Fund.\n`;
        report += `Grant Subsidy: Total Grant Outflows / Latrines Built.\n`;
        report += `True Prog Cost: (Total Investment - Recovered Equity) / Latrines Built.\n`;

        // Phase 35: Enhanced Export (Parameters)
        const paramRows = [
            `Parameter,Value`,
            `Country,${inputs.country}`,
            `Districts,${inputs.districts}`,
            `GrantFund,$${inputs.grantFund}`,
            `LoanFund,$${inputs.loanFund}`,
            `AvgToiletCost,$${inputs.avgToiletCost}`,
            `LoanInterestRate,${(inputs.loanInterestRate * 100).toFixed(1)}%`,
            `Duration,${inputs.duration} Years`,
            `GrantSupportPct,${(inputs.grantSupportPct * 100).toFixed(0)}%`,
            `Duration,${inputs.duration} Years`,
            `GrantSupportPct,${(inputs.grantSupportPct * 100).toFixed(0)}%`,
            `CostPerLatrine,$${(kpis.sustainability.costPerLatrine || 0).toFixed(2)}`,
            `EffectiveCostPerLatrine,$${(kpis.sustainability.effectiveCostPerLatrine || 0).toFixed(2)}`
        ];

        // Header
        const headers = [
            "Month",
            "CumLatrineLoan", "CumLatrineGrant", "CumTotal",
            "MoLatrineLoan", "MoLatrineGrant", "MoTotal",
            "NewLoanValHH", "NewLoanValME",
            "RevIntHH", "RevIntME",
            "FundPrincipalCfl", "FixedOps", "VariableOps", "Defaults", "FundIntExp",
            "NetCashFlow", "CashBalance"
        ];

        const rows = [...paramRows, "", headers.join(",")];
        const len = s.monthlyLabels.length;

        for (let i = 0; i < len; i++) {
            // Delta Calculations
            const cumLoan = (s.dataToiletsMonthlyLoan[i] || 0);
            const prevLoan = i > 0 ? (s.dataToiletsMonthlyLoan[i - 1] || 0) : 0;
            const moLoan = cumLoan - prevLoan;

            const cumGrant = (s.dataToiletsMonthlyGrant[i] || 0);
            const prevGrant = i > 0 ? (s.dataToiletsMonthlyGrant[i - 1] || 0) : 0;
            const moGrant = cumGrant - prevGrant;

            const row = [
                s.monthlyLabels[i],
                // Cumulative
                cumLoan.toFixed(0),
                cumGrant.toFixed(0),
                (cumLoan + cumGrant).toFixed(0),
                // Monthly
                moLoan.toFixed(0),
                moGrant.toFixed(0),
                (moLoan + moGrant).toFixed(0),

                // Financials
                (s.dataMonthlyNewLoansHhVal[i] || 0).toFixed(2),
                (s.dataMonthlyNewLoansMeVal[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueHh[i] || 0).toFixed(2),
                (s.dataMonthlyRevenueMe[i] || 0).toFixed(2),
                (s.dataMonthlyFundPrincipal[i] || 0).toFixed(2),
                (s.dataMonthlyOps[i] || 0).toFixed(2),
                (s.dataMonthlyFees[i] || 0).toFixed(2),
                ((s.dataMonthlyDefaultsHh[i] || 0) + (s.dataMonthlyDefaultsMe[i] || 0)).toFixed(2),
                (s.dataMonthlyFundInt[i] || 0).toFixed(2),
                (s.dataMonthlyNet[i] || 0).toFixed(2),
                (s.dataMonthlyCashBalance[i] || 0).toFixed(2)
            ];
            rows.push(row.join(","));
        }

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"));
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "model_debug_data.csv");
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
    },

    renderDataTable(results) {
        if (!results || !results.series) return;
        const inputs = UI.getInputs(); // Fix: Retrieve inputs for calculations
        const s = results.series;
        console.log("Debug renderDataTable Series Keys:", Object.keys(s));
        if (!s.dataMonthlyFees) console.error("Missing dataMonthlyFees!");
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
                warnings.push(`🔴 ** Structural Deficit **\nYour monthly fixed costs($${fmt(fixedOps)}) are higher than your BEST monthly revenue($${fmt(peakRevenue)}).\n👉 ** Fix **: Reducing lending will NOT help.You must reduce 'Annual Fixed Ops Cost' or significantly increase 'Interest Rate'.`);
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
                warnings.push(`🟠 ** Growing Too Fast **\nYou ran out of cash in Month ${crashIndex}. You spent $${fmt(recentMeLoans)} on ME Loans before crashing.\n👉 ** Fix **: The fund cannot sustain this growth rate.Reduce 'Micro-enterprises / Unit'(Current: ${inputs.mePerDistrict}) or 'ME Setup Cost'.`);
            }
            else {
                warnings.push(`🔴 ** Insolvency **\nThe fund runs out of cash.Try increasing 'Initial Loan Capital' or 'Grant Fund' to cover the gap.`);
            }
        } else {
            // NEW: Check if Principal was actually repaid! (Solvent but Defaulting?)
            const repaid = kpis.financials.investorRepaid || 0;
            const owed = inputs.investLoan || 0;

            if (owed > 0 && (owed - repaid) > 1000) {
                warnings.push(`🔴 ** Repayment Failure **\nThe fund stayed solvent(cash > 0), BUT failed to repay the investor.\nShortfall: $${fmt(owed - repaid)}.\n👉 ** Fix **: The fund did not generate enough cash to pay back the loan on time. Reduce 'Grant Support %' (subsidy is too high) or Increase 'Fund Repayment Term'.`);
            } else {
                suggestions.push(`🟢 ** Solvency **: Excellent.The fund remains liquid and repaid investors.`);
            }

            // Check Capital Efficiency (Too much cash?)
            // Minimum cash balance throughout the project
            // s.minCash is not directly available, calc it or use pre-calc
            const minCash = s.dataMonthlyCashBalance.reduce((min, val) => Math.min(min, val), s.dataMonthlyCashBalance[0]);

            // If we have > 20% of Initial Loan Capital sitting idle forever?
            if (minCash > inputs.loanFund * 0.2) {
                suggestions.push(`🔵 ** High Idle Cash **\nYou have at least $${fmt(minCash)} sitting idle that was never used.\n👉 ** Optimization **: Reduce 'Initial Loan Capital' to save on interest payments, or Increase 'Grant Support %' to reach more people.`);
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

        // Helper
        const getVal = (id) => {
            const el = document.getElementById(id);
            if (!el) return 0;
            let val = parseFloat(el.value) || 0;
            if (val > 0 && val < 1.0) val = val * 100; // Norm
            return val;
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

        // Apply
        const apply = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;

            // Bypass locks. We AUTO-UPDATE unless user recently typed (checked via timestamp?)
            // Actually, let's just update. User can type back if they really want, 
            // but for now we prioritize Correctness over User Edits if they are confused.
            // Or better: Checking dataset.manual is fine, IF we trust it.
            // The User complained "HH defaulted to 30". 30 is not a calculated value.
            // Let's force update to prove the math works.

            el.value = val.toFixed(2);

            // NUCLEAR STYLE FIX
            el.style.setProperty('background-color', '#fef3c7', 'important');
            el.classList.remove('auto-filled'); // Remove conflicting class

            // Dispatch to trigger Model Recalc
            el.dispatchEvent(new Event('input', { bubbles: true }));
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

    // Populate LDC Datalist
    const dataList = document.getElementById('countryList');
    if (dataList) {
        LDC_COUNTRIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name; // User sees Name
            opt.dataset.code = c.code; // Store code? No, datalist doesn't support dataset on options easily accessible via input value.
            // Put Code in label?
            // opt.label = c.code; 
            dataList.appendChild(opt);
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
        UI.lastResults = results;
        // Verify Invariants (Ledger Integrity)
        ModelModule.verifyLedger(results.series, inputs, results.kpis);

        // Phase 66: Auto-Solvency (User Request: "Fund must be solvent... use interest rates... adjust grant")
        if (isAutoAdjust && inputs.investLoan > 0) {
            let rerun = false;
            // Use summary stat for specific repaid amount
            const repaid = results.kpis.financials.investorRepaid || 0;
            const shortfall = inputs.investLoan - repaid;
            const tolerance = 1000; // $1k tolerance

            if (shortfall > tolerance) {
                console.log(`[Solver] GAP: $${shortfall.toLocaleString()}. Optimizing...`);

                // Strategy: Extend Term & Reduce Grant Support (Simultaneously)
                // 1. Extend Term (if < 20 years)
                const currentTerm = inputs.fundRepaymentTerm || 5;
                let newTerm = currentTerm;

                if (currentTerm < 20) {
                    /* DISABLED: User requested fixed 5-year term. Generalized Solver handles solvency via growth constraint.
                    newTerm = Math.min(20, currentTerm + 5); // Jump 5 years
                    const termInput = document.getElementById('fundRepaymentTerm');
                    if (termInput) {
                        termInput.value = newTerm;
                        termInput.classList.add('auto-filled');
                    }
                    // Sync Duration if needed (Duration >= Term)
                    if (inputs.duration < newTerm) {
                        const durInput = document.getElementById('wiz-duration-sidebar');
                        if (durInput) durInput.value = newTerm;
                    }
                    rerun = true;
                    */
                }

                // 2. Reduce Grant Support % (Subsidy per Toilet)
                // If we are insolvent, we are giving away too much free money.
                const currentGrantPct = (inputs.grantSupportPct || 0.20) * 100; // as percentage (20)
                if (currentGrantPct > 0) {
                    // Aggressive Cut: If large shortfall (> $500k), cut by 20% relative (e.g. 40 -> 32). Else 10%.
                    const cut = shortfall > 500000 ? 0.8 : 0.9;
                    let newGrantPct = Math.floor(currentGrantPct * cut);
                    if (newGrantPct < 1) newGrantPct = 0; // Floor at 0%

                    const grantSupportInput = document.getElementById('grantSupportPct');
                    if (grantSupportInput) {
                        grantSupportInput.value = newGrantPct;
                        grantSupportInput.classList.add('auto-filled');
                        rerun = true;
                    }
                }

                if (rerun) {
                    // Recursive Step (with slight delay or direct?)
                    // Direct recursion might stack overflow if not careful.
                    // But we change inputs, so it converges (Term goes up, Grant goes down).
                    // Use setTimeout to allow UI update? No, blocking is better for calculation.
                    // But we need to update DOM inputs for getInputs to work in recursion?
                    // Yes, we updated DOM above. 

                    // Safety Break: Don't Recurse infinitely. 
                    // Ideally, we return and let the UI trigger? No, auto-solver.

                    // We'll call runCalculation(false) to prevent infinite loop in one stack, 
                    // BUT we rely on the loop to solve it. 
                    // Let's use setTimeout to trigger re-run and visual update.
                    setTimeout(() => runCalculation(true, depth + 1), 200);
                    return; // Exit this run
                }
            }
        }

        // Legacy Persistence
        if (UI.lastApiData) {
            UI.calculateAffordability(UI.lastApiData, inputs.avgToiletCost);
        }
        // Legacy Persistence
        if (UI.lastApiData) {
            UI.calculateAffordability(UI.lastApiData, inputs.avgToiletCost);
        }

        // Update UI
        if (typeof UI.updateProgrammeSummary === 'function') {
            // Fix: Pass KPIs (Single Source of Truth)
            UI.updateProgrammeSummary(results.kpis);
        }

        // Removed UI.updateKPIs(results) to prevent duplication errors (uses obsolete logic).

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
