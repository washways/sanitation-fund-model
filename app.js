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
    calculate(inputs) {
        // --- Configuration & Conversion to Monthly ---
        // Extend simulation by 30% to show post-project sustainability
        const projectMonths = inputs.duration * 12;
        const totalMonths = Math.ceil(projectMonths * 1.3);

        // Rates (Monthly)
        const monthlyInterestRateHh = inputs.loanInterestRate / 12;
        const monthlyInterestRateMe = (inputs.meLoanInterestRate !== undefined ? inputs.meLoanInterestRate : inputs.loanInterestRate) / 12;
        const monthlyInflationRate = Math.pow(1 + inputs.inflationRate, 1 / 12) - 1;
        const monthlyFundCostOfCapital = inputs.fundCostOfCapital / 12;

        // Terms (Months)
        const termHh = inputs.termHh || 6;
        const termMe = inputs.termMe || 12;

        // Fund Init
        let grantFundBalance = inputs.investGrant;
        let loanFundBalance = inputs.investLoan;

        // Fund Liability (Start Calculation)
        const fundPrincipal = inputs.investLoan;
        let loanFundLiability = fundPrincipal;

        // Fund Debt Service (PMT to Lender)
        let monthlyFundDebtPayment = 0;
        if (inputs.fundRepaymentTerm > 0 && inputs.fundCostOfCapital >= 0) {
            const nFund = inputs.fundRepaymentTerm * 12;
            const rFund = monthlyFundCostOfCapital;
            if (rFund === 0) {
                monthlyFundDebtPayment = fundPrincipal / nFund;
            } else {
                monthlyFundDebtPayment = (fundPrincipal * rFund) / (1 - Math.pow(1 + rFund, -nFund));
            }
        }

        // --- Reserve & Fee Logic (Refactored Phase 9) ---
        const totalCapital = inputs.investGrant + inputs.investLoan;

        // 1. Calculate Reserves
        // Contingency: General Risk Buffer (Held until end)
        // Note: contingencyRate is already a decimal (e.g. 0.05) from getInputs
        // 1. Calculate Reserves
        // Contingency: Risk Buffer based on OUTSTANDING PORTFOLIO (Dynamic)
        // See Loop for calculation. initialized at 0.
        // const totalContingency = totalCapital * inputs.contingencyRate; // Disabled Static

        // Ops Reserve: Max subsidy for Mgmt/M&E (Budget Cap)
        // Default to 15% if not present
        // opsReserveCap is returned as RAW VALUE (e.g. 15) by getVal, so / 100 is needed.
        const opsReserveRate = inputs.opsReserveCap !== undefined ? inputs.opsReserveCap : 15;
        const totalOpsReserve = totalCapital * (opsReserveRate / 100);

        // 2. Initialize Reserve Trackers
        let currentContingency = 0; // Starts at 0, grows with Portfolio
        let currentOpsReserve = totalOpsReserve;
        let currentReserve = currentContingency + currentOpsReserve; // Liability Tracker

        // Cohort Initialization (Phase 60)
        let hhCohorts = []; // { balance, monthlyPayment, termRemaining }
        let meCohorts = [];

        // Sim State
        let currentMEs = 0;
        let backlogToilets = inputs.popReqToilets / inputs.avgHHSize;
        let toiletsBuiltCumulative = 0;

        // Accumulators
        let cumulativeLoansHh = 0;
        let cumulativeGrants = 0;
        let meDefaultCostTotal = 0;
        let hhDefaultCostTotal = 0;
        let mgmtFeeTotal = 0;

        // Co-Benefits Accumulators
        let cumulativeCarbon = 0;

        // Constraint Trackers
        let constraints = { capital: 0, capacity: 0, demand: 0 };

        // Repayment Schedule
        let repaymentInflows = new Array(totalMonths + 24).fill(0);
        let repaymentInflowsHh = new Array(totalMonths + 24).fill(0); // Granular
        const repaymentInflowsMe = new Array(totalMonths + 60).fill(0); // Granular
        // Reset Global Schedule for ME Cap (Hack for loop persistence)
        window.mePrincipalSchedule = new Array(360).fill(0);

        // --- Annual Aggregation Buckets ---
        let labels = [];
        let dataToilets = [];
        let dataCost = [];
        let dataFund = [];

        let dataLoansHh = [];
        let dataLoansMe = [];
        let dataGrants = [];
        let dataRepayments = [];
        let dataMgmtFees = [];
        let dataDefaultsHh = [];
        let dataDefaultsMe = [];
        let dataFundDebtService = [];

        let dataPeople = [];
        let dataCarbon = [];
        let dataDalys = [];
        let dataJobs = [];

        // Monthly Granular Data
        let dataToiletsMonthlyGrant = [];
        let dataToiletsMonthlyLoan = [];
        let monthlyLabels = [];
        // Phase 26 Refined Arrays
        let dataMonthlyRevenueHh = [];
        let dataMonthlyRevenueMe = [];
        let dataMonthlyFundPrincipal = [];

        let dataMonthlyFees = [];
        let dataMonthlyExpenses = [];
        let dataMonthlyNet = [];
        let dataMonthlyOps = [];
        let dataMonthlyBadDebt = [];
        let dataMonthlyFundInt = [];

        // Phase 28 Debug Arrays
        let dataMonthlyPortfolioHh = [];
        let dataMonthlyPortfolioMe = [];
        let dataMonthlyCashBalance = [];
        let dataMonthlyNewLoansHhVal = [];
        let dataMonthlyNewLoansMeVal = [];

        // Granular Financials (Phase 41)
        let dataMonthlyRepaymentHh = [];
        let dataMonthlyRepaymentMe = [];
        let dataMonthlyDefaultsHh = [];
        let dataMonthlyDefaultsMe = [];
        let dataMonthlyMgmtFees = [];
        let dataMonthlyMandECosts = [];
        let dataMonthlyFixedOps = [];
        // Phase 49: Carbon Revenue Data
        let dataMonthlyCarbonRevenue = [];

        // Debug Arrays (Capacity Check)
        let dataMonthlyCapacity = [];
        let dataMonthlyAffordable = [];
        let dataMonthlyTargetMEs = [];

        // Impact State
        let peopleReached = 0; // Fix: Scope for Return
        let jobValuation = 0; // Fix: Scope for Return
        let finalToiletsLoan = 0; // Fix
        let finalToiletsGrant = 0; // Fix
        let finalMEs = 0; // Fix
        let finalToilets = 0; // Fix

        // Temporary annual sums
        let yearToilets = 0;
        let yearLoansHh = 0;
        let yearLoansMe = 0;
        let yearGrants = 0;
        let yearRepayments = 0;
        let yearMgmtFees = 0;
        let yearDefaultsHh = 0;
        let yearDefaultsMe = 0;
        let yearDebtService = 0;
        let yearLoansHhCount = 0; // Added for Termination Check
        let yearLoansMeCount = 0; // Added for Termination Check

        // Portfolio State for Interest Calc (Phase 23)
        let portfolioHh = 0;
        let portfolioMe = 0;

        // Initial Startup (Day 0)
        // 'mePerDistrict' is now the Starting Density
        const startTargetMEs = inputs.districts * inputs.mePerDistrict;

        // CHECK: Startup costs come from LENDABLE capital
        // We must apply the FULLY BURDENED logic here too, or we bankrupt the fund on Day 0.
        let lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;

        const reserveMonthsStart = Math.max(6, inputs.termHh || 6);
        const oneMeWorkingCapitalStart = inputs.toiletsPerMeMonth * inputs.avgToiletCost * reserveMonthsStart;
        const fullyBurdenedStartCost = inputs.meSetupCost + oneMeWorkingCapitalStart;

        const affordableStartMEs = Math.floor(Math.max(0, lendableBalance) / fullyBurdenedStartCost);

        // Pilot Phase: Start with only 1 ME per District (Realistic Ramp-up)
        // User Feedback: "Huge number first month is unrealistic."
        // Pilot Phase: Start with only 1 ME per District (Realistic Ramp-up)
        // User Feedback: "Huge number first month is unrealistic."
        const startMEs = Math.min(inputs.districts, affordableStartMEs); // Cap at 1 per district initially
        let dormantMonths = 0; // Track stagnation for Hibernation Mode

        // Phase 62: Track Active ME Exposure for Cap
        let activeMeLoanBalance = 0; // Total Outstanding Principal on ME Loans

        // Actual Cash Outflow is only Setup Cost (Buffer stays in bank)
        let startCost = startMEs * inputs.meSetupCost;
        if (grantFundBalance >= startCost) {
            grantFundBalance -= startCost;
        } else {
            let rem = startCost - grantFundBalance;
            grantFundBalance = 0;
            loanFundBalance -= rem; // Borrow from loan fund
        }
        currentMEs += startMEs;
        // Schedule Repayments for Initial ME Loans? 
        // Logic assumes these are loans too?
        if (startCost > 0) {
            meDefaultCostTotal += startCost * inputs.meDefaultRate;

            // Scheduling logic for start loans was missing! Added it.
            const pmtMeCalc = (startCost * monthlyInterestRateMe) / (1 - Math.pow(1 + monthlyInterestRateMe, -termMe));
            const effectivePmt = pmtMeCalc * (1 - inputs.meDefaultRate);
            for (let k = 1; k <= termMe; k++) {
                if (k < repaymentInflows.length) { // Start Month 0, First payment Month 1
                    repaymentInflows[k] += effectivePmt;
                }
            }
        }

        // Update Lendable (Cash dropped)
        lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;


        // Phase 65: Winding Down Period (User Request: "Pay off up to 1 year after programme finished")
        const activeMonths = totalMonths;
        const totalSimMonths = activeMonths + 12;

        // --- Pre-Calculation: Investor Repayment Schedule (Generalised) ---
        // Dynamically calculate the Principal Due based on Inputs (Term & Amount).
        // This ensures the logic works for ANY country/loan scenario.
        const fundTermMonths = (inputs.fundRepaymentTerm || 5) * 12;
        const graceMonths = inputs.investorGracePeriod || 0;
        const monthlyPrincipalDue = fundTermMonths > 0 ? (inputs.investLoan / fundTermMonths) : 0;

        // Schedule Store: Index matches Simulation Month (1-based)
        const investorSchedule = new Array(totalSimMonths + 1).fill(0);

        for (let t = 1; t <= totalSimMonths; t++) {
            // Repayment starts AFTER Grace Period, lasts for Term.
            if (t > graceMonths && t <= (graceMonths + fundTermMonths)) {
                investorSchedule[t] = monthlyPrincipalDue;
            }
        }

        // Localize ME Principle Schedule (Fixes Global Leak)
        const mePrincipalSchedule = new Array(360).fill(0);

        // --- Simulation Loop (Monthly) ---
        for (let m = 1; m <= totalSimMonths; m++) {
            const isWindingDown = m > activeMonths;
            const currentYear = Math.ceil(m / 12);
            monthlyLabels.push(`M${m}`);

            let monthlyMeLoans = 0;
            // Phase 45: Calculate Fixed Ops Early for Liquidity Constraint
            // Apply Inflation to Ops Cost (Salaries/Rent go up)
            // Apply Inflation to Ops Cost (Salaries/Rent go up)
            let baseFixedOps = (inputs.annualFixedOpsCost || 0) / 12;
            let fullMonthlyFixedOps = baseFixedOps * Math.pow(1 + monthlyInflationRate, m); // Used for Buffers (War Chest logic)
            let monthlyFixedOps = fullMonthlyFixedOps;

            // --- Phase 45+56: Inflows First (Revenue) ---
            // Fix: Add Revenue BEFORE Debt Service
            const inflow = repaymentInflows[m] || 0;
            loanFundBalance += inflow;
            yearRepayments += inflow;

            // Phase 58: Adaptive Operational Rightsizing (Hibernation Mode)
            // If the fund has stopped growing (Zero Production) for > 3 months, 
            // we assume it downsizes staff significantly to "Harvest Mode" (Collections Only).
            if (dormantMonths > 3) {
                // 1. Standard Reduction (70% cut)
                let reducedOps = monthlyFixedOps * 0.3;

                // 2. Solvency Cap (Phase 60: Revenue-Based Compensation)
                // Ensure we don't spend more than we earn.
                // Estimate Monthly Interest Income (approximate based on portfolio)
                const estInterestHH = (portfolioHh || 0) * monthlyInterestRateHh;
                const estInterestME = (portfolioMe || 0) * monthlyInterestRateMe;
                const projectedRevenue = estInterestHH + estInterestME;

                // Cap Ops at 90% of Revenue (Ensure 10% Profit Margin even in hibernation)
                // This simulates "Commission-Only" staff or extreme austere measures.
                // Floor at 0.
                const revenueCap = Math.max(0, projectedRevenue * 0.9);

                // Use the LOWER of the two.
                monthlyFixedOps = Math.min(reducedOps, revenueCap);
            }

            // --- Phase 50: Adaptive Solvency Guardrails ---
            // 0. Calculate Burn Rate (Ops + Debt Service)
            let prevDebtService = 0;
            if (m > 1) {
                // Arrays are 0-indexed. M-2 is index of previous month (M-1).
                const idx = m - 2;
                if (dataMonthlyFundInt[idx] !== undefined) {
                    prevDebtService = dataMonthlyFundInt[idx] + dataMonthlyFundPrincipal[idx];
                }
            }
            // Phase 61: Dynamic Debt Reserve (3 Months Lookup)
            // Fix: Use Pre-Calculated Schedule instead of undefined log
            // Check next 3 months
            let futurePrincipalNeeded = 0;
            for (let k = 1; k <= 3; k++) {
                if (m + k <= totalSimMonths) futurePrincipalNeeded += investorSchedule[m + k];
            }
            // Estimate Interest (Current Interest * 3) - Assumes flat balance
            const estFutureInt = (dataMonthlyFundInt[m - 1] || 0) * 3;

            const debtReserve = futurePrincipalNeeded + estFutureInt;

            // Phase 63: Ops Buffer (3 Months Fixed Ops)
            const opsBuffer = fullMonthlyFixedOps * 3;
            const monthlyBurn = monthlyFixedOps + ((dataMonthlyFundInt[m - 1] || 0) + (dataMonthlyFundPrincipal[m - 1] || 0));

            // Flags
            // Flags
            // Growth Freeze: If Cash < 1.2x Burn Rate. (Aggressive Scale: Only stop if nearly empty)
            const growthFreeze = loanFundBalance < (monthlyBurn * 1.2);
            // Survival Mode: If Cash < 0.5x Burn Rate.
            const survivalMode = loanFundBalance < (monthlyBurn * 0.5);



            // 2. Variable Op Costs (Waterfall: Revenue -> Ops Reserve)
            // Calculate Disbursements for this month (We need to estimate or do it after?
            // Problem: We haven't calculated disbursements yet.
            // Solution: We must move this block AFTER "Financial Execution" or Estimate it.
            // Ideally, fees are charged on ACTUAL disbursements.
            // Let's Move the Fee Calculation to the END of the loop logic, but we need to pay it.
            // Wait, if we pay it at the end, it doesn't reduce lendable balance for THIS month.
            // That's fine. Next month's lendable balance will be lower.

            // NOTE: To be accurate, we'll initialize expensePaid here as 0 and do the calculation after disbursements.
            // But we need to declare variables.
            let expensePaid = 0;

            // Phase 53/54: Dynamic Reserve Release & Risk Calculation
            // Fix: Don't hold 15% Capital Reserve ($1.2M) when only 10 months ($40k) of Ops remain.
            const projectEndM = inputs.duration * 12;
            const monthsRemaining = Math.max(0, projectEndM - m);
            // 1. Ops Reserve: Cap at Lesser of (Remaining Months) OR (6 Months Rolling Buffer).
            // We assume Revenue covers Ops, so we only need a liquidity buffer, not full pre-payment.
            const bufferMonths = Math.min(monthsRemaining, 6);
            const neededOpsReserve = bufferMonths * monthlyFixedOps;

            if (currentOpsReserve > neededOpsReserve) {
                currentOpsReserve = Math.max(0, neededOpsReserve);
            }

            // 2. Contingency: Based on Active Risk (Portfolio)
            // "Reasonable % of loans that are out"
            const totalRiskyAssets = (portfolioHh || 0) + (portfolioMe || 0);
            currentContingency = totalRiskyAssets * inputs.contingencyRate;

            // Calculate Lendable (Cash - Reserve Liability)
            // Cash includes Revenue (repaymentInflows added above)
            // Reserve includes OpsReserve and Contingency
            currentReserve = currentOpsReserve + currentContingency;
            lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;

            // Phase 56: Senior Debt Priority
            // Reserve cash for Investor Repayment BEFORE calculating lendable funds for new toilets.
            if (loanFundLiability > 0 && monthlyFundDebtPayment > 0 && m <= inputs.fundRepaymentTerm * 12) {
                lendableBalance -= monthlyFundDebtPayment;
            }


            // 3. Outflows (Fund Debt Service)
            // FIXED: Removed Double Payment Logic here. 
            // Phase 23/45 Logic at end of loop handles capped repayment correctly.
            /* 
            if (loanFundLiability > 0 && monthlyFundDebtPayment > 0) {
                if (m <= inputs.fundRepaymentTerm * 12) {
                    loanFundBalance -= monthlyFundDebtPayment;
                    yearDebtService += monthlyFundDebtPayment;
                    const interestPart = loanFundLiability * monthlyFundCostOfCapital;
                    const principalPart = monthlyFundDebtPayment - interestPart;
                    loanFundLiability -= principalPart;
                }
            }
            */

            // Update Lendable Again
            lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;


            // 4. Expansion (Monthly Evaluation)
            // MOVED: Senior Debt Service Execution (Priority)

            // --- Phase 56: Senior Debt Service (Repayment to Investor) ---
            // Moved to TOP of Waterfall (Seniority)
            // Fix: Re-calculate Target PMT locally
            let fundPaymentPrincipal = 0;
            let fundPaymentInterest = 0;

            // Phase 64: "Financing Expert" Flexible Repayment (Cash Sweep)
            // Instead of rigid PMT, we target 100% repayment by Year X + 1.
            // We set a "Target" to keep us on track, but actual payment will be flexible based on cash.
            // But actually, the user said "1st priority is to pay off principle... with flexibility".
            // So we will prioritize Debt Service in the waterfall, but allow variance.

            // To ensure we don't just hoard cash, we need to KNOW how much we OUGHT to pay.
            // Let's keep the target calculation as a "Soft Target" for planning, 
            // but the actual deduction will be "Sweep Logic".
            let targetMonthlyPmt = 0;
            const gracePeriod = inputs.investorGracePeriod || 0;

            if (inputs.fundRepaymentTerm > 0) {
                const totalMonthsTerm = inputs.fundRepaymentTerm * 12;
                const paymentMonths = Math.max(1, totalMonthsTerm - gracePeriod);
                if (inputs.fundCostOfCapital > 0) {
                    const r = (inputs.fundCostOfCapital / 12);
                    targetMonthlyPmt = (inputs.investLoan * r) / (1 - Math.pow(1 + r, -paymentMonths));
                } else {
                    targetMonthlyPmt = inputs.investLoan / paymentMonths;
                }
            }

            // Only pay if liability exists and Grace Period passed
            // Only pay if liability exists and Grace Period passed
            if (targetMonthlyPmt > 0 && loanFundLiability > 0 && m > gracePeriod) {
                // 1. Calculate Allowable Cash Drain
                // Phase 57: Liquidity Buffer (Senior to Debt?)
                // NO. Debt is Senior. But we need to keep lights on?
                // Compromise: Keep 3 Months of Ops Buffer.
                // If we are winding down (End of Term), Taper buffer to 0.

                const monthsUntilDue = (inputs.fundRepaymentTerm * 12) - m;
                // Fix: Relax Buffer to 3 months (User Feedback: "Incomplete Repayment")
                let requiredBufferMonths = 3;
                if (monthsUntilDue < 3) {
                    requiredBufferMonths = Math.max(0, monthsUntilDue);
                }

                // Check fullMonthlyFixedOps availability. If not defined, use monthlyFixedOps?
                // Assuming monthlyFixedOps is available as per Phase 9.
                // FIX: User requested Principal Priority. Pay Debt BEFORE Buffer.
                const liquidityBuffer = 0; // Removing Buffer constraint for debt service.

                // Allow using Repayments (inflow) AND Balance
                const availableForDebt = Math.max(0, loanFundBalance - liquidityBuffer);
                const maxPayable = availableForDebt;

                // 2. Interest
                const monthlyFundRate = (inputs.fundCostOfCapital || 0) / 12;
                const interestDue = loanFundLiability * monthlyFundRate;

                // 3. Components
                let actualTotalPayment = Math.min(targetMonthlyPmt, maxPayable);

                // Allocation
                if (actualTotalPayment >= interestDue) {
                    fundPaymentInterest = interestDue;
                    fundPaymentPrincipal = actualTotalPayment - interestDue;
                } else {
                    fundPaymentInterest = actualTotalPayment;
                    fundPaymentPrincipal = 0;
                }

                // Cap Principal
                if (fundPaymentPrincipal > loanFundLiability) {
                    fundPaymentPrincipal = loanFundLiability;
                    actualTotalPayment = fundPaymentInterest + fundPaymentPrincipal;
                }

                // 4. Execution
                // Note: If we use Inflow, we are spending 'future' cash? No, Inflow is added to Balance at start of loop.
                loanFundBalance -= actualTotalPayment;
                loanFundLiability -= fundPaymentPrincipal;

                // 5. Stats
                yearDebtService += actualTotalPayment;
            }

            // Log Values Arrays
            dataMonthlyFundPrincipal.push(fundPaymentPrincipal);
            dataMonthlyFundInt.push(fundPaymentInterest);

            // Re-update Lendable Balance after Debt Service deduction
            lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;

            // 4. Expansion (Monthly Evaluation)
            // Dynamic Target: How many MEs do we need to finish backlog?
            // CONSTRAINTS: 
            // 1. Density Limit (Pop / 2000)
            // 2. Speed Limit (Max 5% growth)

            let targetMEs = currentMEs;
            if (backlogToilets > 0) {
                const densityLimit = Math.ceil(inputs.popReqToilets / 2000); // Saturation Point

                const monthsRem = Math.max(1, totalMonths - m);
                const requiredRate = backlogToilets / monthsRem;
                const neededMEs = Math.ceil(requiredRate / inputs.toiletsPerMeMonth);

                // Target is lesser of Need and Density Cap
                // But never lower than current (no firing)
                // Target is lesser of Need and Density Cap
                // But never lower than current (no firing)
                // Phase 50: Cap Growth if Insolvency Risk
                const rationalTarget = Math.min(neededMEs, densityLimit);

                if (growthFreeze || isWindingDown) {
                    targetMEs = currentMEs; // Freeze (or natural attrition if we added that)
                } else {
                    targetMEs = Math.max(currentMEs, rationalTarget);
                }
            }

            // Phase 60: Define Debt Reserve (Using shared scope definition from Line 404)
            // const debtReserve = ... (Removed Duplicate)

            if (currentMEs < targetMEs && !isWindingDown) {
                const deficit = targetMEs - currentMEs;

                // --- Production First Logic ---
                // Phase 60: Solvency Guard logic moved to outer scope

                // Reserve cash to fund existing capacity (prevent cannibalization)
                const inflationFactorExp = Math.pow(1 + monthlyInflationRate, m);
                const unitCostExp = inputs.avgToiletCost * inflationFactorExp;

                // Reserve full loan term (e.g. 6 months) to ensure rotation
                // Aggressive Scaling: Only reserve 1 month of working capital (User Request)
                const reserveMonths = 1; // Was 6. Reduced to unlock capital for expansion.

                const maxMonthlyProductionCost = currentMEs * inputs.toiletsPerMeMonth * unitCostExp;
                const productionReserve = maxMonthlyProductionCost * reserveMonths;

                // Phase 45+50: Deduct Fixed Ops (Using shared scope definition from Line 407)
                // const opsBuffer = ... (Removed Duplicate)

                // FIX: Decouple ME Expansion from strict Debt Reserve.
                // We want to scale Capacity (MEs) early (Phase 1), even if we are saving for Debt.
                // Only apply a minimal reserve for MEs (e.g. 1 month debt) to avoid total recklessness,
                // but do NOT block them with the full 12-month war chest.
                const expansionDebtReserve = (targetMonthlyPmt || 0) * 1;

                // CRITICAL FIX: Prioritize Production over Expansion.
                // Deduct the cost of running EXISTING capacity (Toilets) from the expansion budget.
                const projectedToiletCost = currentMEs * inputs.toiletsPerMeMonth * unitCostExp;

                // Phase 63: Strategic "Sprint" during Grace Period (User Request: "Focus on ME at start")
                // During the Grace Period, we relax the 'Projected Cost' constraint to allow aggressive capacity building.
                // We assume we can fund the toilets later with the remaining large war chest.
                let effectiveProjectedCost = projectedToiletCost;
                if (m < (inputs.investorGracePeriod || 0)) {
                    effectiveProjectedCost = 0; // Ignore future production liability during Setup Phase
                }

                // Phase 62: Capital Allocation Cap
                // Limit ME exposure to 25% of Total Fund Size (Raised from 15% for "Rapid Scale").
                // This ensures we have enough capacity but still reserve majority for Toilets.
                const totalFundSize = (inputs.investGrant || 0) + (inputs.investLoan || 0);
                const meCapLimit = totalFundSize * 0.25;
                const meCapRoom = Math.max(0, meCapLimit - activeMeLoanBalance);

                // Reduce available expansion funds if we are hitting the ME Cap
                const availableForExpansion = Math.min(
                    Math.max(0, lendableBalance - productionReserve - opsBuffer - expansionDebtReserve - effectiveProjectedCost),
                    meCapRoom
                );


                // COST TO ADD ONE ME: Setup + Working Capital for its Toilets
                // If we don't reserve the working capital, the new ME will sit idle.
                const oneMeWorkingCapital = inputs.toiletsPerMeMonth * unitCostExp * reserveMonths;
                const fullyBurdenedMeCost = inputs.meSetupCost + oneMeWorkingCapital;

                const affordable = Math.floor(availableForExpansion / fullyBurdenedMeCost);

                // Growth Speed Cap (Tuned to 10% to smooth "excessive loans")
                const maxGrowth = Math.max(1, Math.ceil(currentMEs * 0.10));

                const toAdd = Math.min(deficit, affordable, maxGrowth);

                if (toAdd > 0) {
                    const cost = toAdd * inputs.meSetupCost;
                    monthlyMeLoans = cost;
                    loanFundBalance -= cost;
                    activeMeLoanBalance += cost; // Track Exposure
                    currentMEs += toAdd;
                    yearLoansMe += cost;
                    yearLoansMeCount += toAdd; // Fix: Count Number of Loans (1 per ME), not Number of Batch Events
                    meDefaultCostTotal += cost * inputs.meDefaultRate;

                    const pmtMeCalc = (cost * monthlyInterestRateMe) / (1 - Math.pow(1 + monthlyInterestRateMe, -termMe));
                    const effectivePmt = pmtMeCalc * (1 - inputs.meDefaultRate);
                    for (let k = 1; k <= termMe; k++) {
                        if (m + k < repaymentInflows.length) {
                            repaymentInflows[m + k] += effectivePmt;
                            repaymentInflowsMe[m + k] += effectivePmt; // Granular Track

                            // Amortization tracking for exposure cap (Simplified linear runoff or just reduce by principal portion)
                            // For simplicity/conservatism, we won't reduce 'activeMeLoanBalance' monthly in this loop,
                            // but ideally we should.
                            // Let's reduce it by the principal portion of the payment *when* the payment happens?
                            // No, simpler: Reduces by principal portion linearly?
                            // Let's just create a repayment event array for exposure reduction
                        }
                    }
                    // Schedule Principal Reduction for Exposure Tracking
                    // Using simple reduction: We assume principal is repaid evenly or we don't reduce it?
                    // If we don't reduce it, the cap locks forever. We MUST reduce it.
                    // Let's assume linear principal repayment for tracking simplicity
                    const principalPerMonth = cost / termMe;
                    for (let k = 1; k <= termMe; k++) {
                        if (m + k < 360) { // Limit array size check
                            // We need a way to reduce 'activeMeLoanBalance' in the future months.
                            // We can't edit future variables.
                            // We need an array 'scheduledMePrincipalRepayments'
                            // if (!window.mePrincipalSchedule) window.mePrincipalSchedule = new Array(360).fill(0);
                            if (m + k < mePrincipalSchedule.length) {
                                mePrincipalSchedule[m + k] = (mePrincipalSchedule[m + k] || 0) + principalPerMonth;
                            }
                        }
                    }
                }
            }

            // Execute Scheduled Exposure Reduction
            if (mePrincipalSchedule[m]) {
                activeMeLoanBalance -= mePrincipalSchedule[m];
            }

            // Update Lendable (Post-ME Loan)
            lendableBalance = (grantFundBalance + loanFundBalance) - currentReserve;

            // 5. Toilet Prod Capacity
            const capacity = currentMEs * inputs.toiletsPerMeMonth;

            // 6. Demand
            if (backlogToilets <= 0) backlogToilets = 0;

            // 7. Affordability
            const inflationFactor = Math.pow(1 + monthlyInflationRate, m);
            const unitCost = inputs.avgToiletCost * inflationFactor;

            // USE LENDABLE FUNDS for production check!
            // Phase 45: Strict Liquidity Constraint
            // 1. Reserve Cash for Fixed Ops
            // USE LENDABLE FUNDS for production check!
            // Phase 45: Strict Liquidity Constraint
            // 1. Reserve Cash for Fixed Ops (Phase 50: 12 Months Buffer for Lending)
            // Increased to 12 Months to prevent insolvency variance.
            // 1. Reserve Cash for Fixed Ops (Phase 50: 12 Months Buffer for Lending)
            // Increased to 12 Months to prevent insolvency variance.
            // Use FULL OPS COST for Buffer (War Chest), not Hibernation Cost.
            // 5. Toilet Prod Capacity
            // ...

            // Phase 65: Halt Production/Lending in Winding Down Phase
            let totalFunds = 0;
            if (!isWindingDown) {
                // Standard Solvency Logic
                // FIX: Apply DEBT RESERVE to Housing Loans too.
                totalFunds = Math.max(0, lendableBalance - (fullMonthlyFixedOps * 12) - debtReserve);
            } else {
                // Winding Down: Stop lending. Funds only used for Ops and Debt Repayment.
                totalFunds = 0;
            }

            // Phase 50: Survival Mode (Absolute Halt)
            // if (survivalMode) { totalFunds = 0; } // Disabled for testing/fix// Hard Stop

            // 2. Account for Variable Fees (Mgmt + ME Support) in Unit Cost
            const variableFeeRate = (inputs.mgmtFeeRatio || 0) + (inputs.meCostRate || 0);
            const burdenedUnitCost = unitCost * (1 + variableFeeRate);

            // Phase 59: Hibernation Restart Threshold
            // If dormant > 3 (Low Ops Mode), prevent waking up for tiny loans.
            // Require 12 months of Full Ops Capital before resuming (War Chest).
            if (dormantMonths > 3) {
                const restartThreshold = fullMonthlyFixedOps * 12;
                if (lendableBalance < restartThreshold) {
                    totalFunds = 0; // Block new construction
                }
            }

            const affordableUnits = Math.floor(totalFunds / burdenedUnitCost);


            // 8. Production
            let production = Math.min(capacity, backlogToilets, affordableUnits);
            if (production < 0) production = 0;

            // --- Bottleneck Analysis ---
            // Determine which factor was the limiting one (ignoring 0 vs 0 ties, prioritized order)
            // Priority: Demand (Success) > Capacity (Execution) > Capital (Funding)
            // Actually, if affordableUnits is limiting, it's Capital.

            if (production === affordableUnits && affordableUnits < capacity && affordableUnits < backlogToilets) {
                constraints.capital++;
            } else if (production === capacity && capacity < backlogToilets) {
                constraints.capacity++;
            } else if (production === backlogToilets) {
                constraints.demand++;
            }

            // Phase 9: Funding Sources (Split Loan vs Grant based on Poverty/Strategy)
            // If Capacity limiting, it's MEs.
            // If Backlog limiting, it's Demand.

            if (production === backlogToilets && backlogToilets <= capacity && backlogToilets <= affordableUnits) {
                constraints.demand++;
            } else if (production === affordableUnits && affordableUnits < capacity) {
                constraints.capital++;
            } else {
                constraints.capacity++;
            }

            let countGrant = 0;

            // Track Debug Data (Phase Debug)
            dataMonthlyCapacity.push(capacity);
            dataMonthlyAffordable.push(affordableUnits);
            dataMonthlyTargetMEs.push(targetMEs);
            let countLoan = 0;

            // 9. Financial Execution
            if (production > 0) {
                // Determine Grant Portion (Target)
                let targetGrant = production * inputs.grantSupportPct;

                // FIX: Cap Grant at Available Funds (Prevent Deficit)
                let maxGrantUnits = 0;
                if (grantFundBalance > 0) {
                    // Using floor to be safe with currency
                    maxGrantUnits = Math.floor(grantFundBalance / unitCost);
                    if (grantFundBalance < unitCost) maxGrantUnits = 0; // Absolute safety
                }

                countGrant = Math.min(targetGrant, maxGrantUnits);
                countLoan = production - countGrant; // Remainder shifts to Loan (since we have capital there)

                const costGrant = countGrant * unitCost;
                const costLoan = countLoan * unitCost;

                // Deduct
                grantFundBalance -= costGrant;
                // Clamp to 0 just in case of rounding
                if (grantFundBalance < 0) grantFundBalance = 0;

                loanFundBalance -= costLoan;

                // Track
                toiletsBuiltCumulative += production;
                backlogToilets -= production;

                yearToilets += production;
                yearGrants += costGrant;
                yearLoansHh += costLoan;

                // Track Count for Termination
                yearLoansHhCount += countLoan;

                cumulativeGrants += costGrant; // Fix tracking
                cumulativeLoansHh += costLoan; // Fix tracking (Missing Line)

                // Schedule HH Loan Repayments
                let pmtHh = 0;
                if (monthlyInterestRateHh === 0) {
                    pmtHh = costLoan / termHh;
                } else {
                    pmtHh = (costLoan * monthlyInterestRateHh) / (1 - Math.pow(1 + monthlyInterestRateHh, -termHh));
                }

                const effectivePmtHh = pmtHh * (1 - inputs.hhDefaultRate);
                const lostPmtHh = pmtHh * inputs.hhDefaultRate;
                yearDefaultsHh += lostPmtHh * termHh;

                for (let k = 1; k <= termHh; k++) {
                    if (m + k < repaymentInflows.length) {
                        repaymentInflows[m + k] += effectivePmtHh;
                        repaymentInflowsHh[m + k] += effectivePmtHh; // Granular Track
                    }
                }
            }


            // --- Phase 9: Waterfall Op Costs ---
            // 1. Calculate Variable Fees on Disbursement
            const disbursementGrant = (production > 0) ? (countGrant * unitCost) : 0;
            const disbursementLoan = (production > 0) ? (countLoan * unitCost) : 0;
            const totalDisbursed = monthlyMeLoans + disbursementGrant + disbursementLoan;

            // Track Cumulative Splits
            // Note: toiletsBuiltCumulative tracks Total. We need split.
            // We assume previous balance.
            const prevGrant = (dataToiletsMonthlyGrant.length > 0) ? dataToiletsMonthlyGrant[dataToiletsMonthlyGrant.length - 1] : 0;
            const prevLoan = (dataToiletsMonthlyLoan.length > 0) ? dataToiletsMonthlyLoan[dataToiletsMonthlyLoan.length - 1] : 0;

            // Note: mgmtFeeRatio and meCostRate are percentages (0.02, 0.05) from getInputs
            const varMgmtFee = totalDisbursed * inputs.mgmtFeeRatio;
            const varMeCost = totalDisbursed * inputs.meCostRate;

            // Fixed Ops (Calculated Early in Phase 45)
            // const montlyFixedOps = ... (Removed duplicate)

            const totalOpCost = varMgmtFee + varMeCost + monthlyFixedOps;


            if (totalOpCost > 0) {
                // 2. Pay from Revenue First (Proxy: Inflow)
                // Fix: Revenue is only available if it wasn't spent on Senior Debt.
                const revenueAvailable = Math.min(inflow, Math.max(0, loanFundBalance));
                let coveredByRevenue = Math.min(totalOpCost, revenueAvailable);
                let deficit = totalOpCost - coveredByRevenue;

                // 3. Pay Deficit from Ops Reserve
                let coveredByReserve = Math.min(deficit, currentOpsReserve);

                // If Deficit still remains, it eats into Capital (Uncovered Ops)
                let uncoveredOps = deficit - coveredByReserve; // This reduces Loan Fund directly without Revenue offset

                const totalPaid = coveredByRevenue + coveredByReserve + uncoveredOps;

                // Deduct Reserve Liability
                currentOpsReserve -= coveredByReserve;

                // Deduct Cash (Implementation)
                // 1. Revenue Part (Already in LoanFundBalance via 'inflow')
                if (coveredByRevenue > 0) {
                    loanFundBalance -= coveredByRevenue;
                }

                // 2. Reserve Part (From GrantFund typically, checking balance)
                if (coveredByReserve > 0) {
                    if (grantFundBalance >= coveredByReserve) {
                        grantFundBalance -= coveredByReserve;
                    } else {
                        let rem = coveredByReserve - grantFundBalance;
                        grantFundBalance = 0;
                        loanFundBalance -= rem;
                    }
                }

                // 3. Uncovered Part (Direct Capital Drain)
                if (uncoveredOps > 0) {
                    loanFundBalance -= uncoveredOps;
                }

                // Track
                yearMgmtFees += totalPaid;
                mgmtFeeTotal += totalPaid;
            }

            // --- Fund Debt Service (Repayment to Investor) ---
            // MOVED TO TOP OF WATERFALL (See Phase 56)


            // --- Phase 23: Monthly Financial Tracking ---
            // 1. Portfolio Updates (HH)
            // 1. Portfolio Updates (HH)
            const newLoansHh = (production > 0) ? countLoan * unitCost : 0;
            const newLoansMe = monthlyMeLoans;

            // Phase 55: Realistic Defaults (Portfolio Method)
            // Fix: Defaults should occur on OUTSTANDING Portfolio, not just new loans.
            // This ensures risk persists even if lending stops.
            portfolioHh += newLoansHh;
            // Calibrate WriteOff to Loan Term to match effectivePmt reduction
            // If we lose 8% of payments over 6 months, we must write off 8% of Principal over 6 months.
            // --- 3. Repayment Logic (Cohort-Based) ---
            // Phase 60: Precision Repayment to eliminate "Infinite Tail"

            // [FIX] Inject New Loans into Cohorts (Missing Logic Restored)
            if (newLoansHh > 0) {
                let pmt = 0;
                if (monthlyInterestRateHh === 0) {
                    pmt = newLoansHh / termHh;
                } else {
                    pmt = (newLoansHh * monthlyInterestRateHh) / (1 - Math.pow(1 + monthlyInterestRateHh, -termHh));
                }
                hhCohorts.push({
                    balance: newLoansHh,
                    monthlyPayment: pmt,
                    termRemaining: termHh
                });
            }

            if (newLoansMe > 0) {
                let pmt = 0;
                if (monthlyInterestRateMe === 0) {
                    pmt = newLoansMe / termMe;
                } else {
                    pmt = (newLoansMe * monthlyInterestRateMe) / (1 - Math.pow(1 + monthlyInterestRateMe, -termMe));
                }
                meCohorts.push({
                    balance: newLoansMe,
                    monthlyPayment: pmt,
                    termRemaining: termMe
                });
            }

            let interestRevHh = 0;
            let principalRepaidHh = 0;
            let writeOffHh = 0; // Track Defaults from Cohorts

            let interestRevMe = 0;
            let principalRepaidMe = 0;
            let writeOffMe = 0;

            // Pre-calc Monthly Default Rates
            const monthlyDefaultRateHh = (inputs.hhDefaultRate || 0.05) / 12;
            const monthlyDefaultRateMe = (inputs.meDefaultRate || 0.10) / 12;

            // Process HH Cohorts
            hhCohorts = hhCohorts.filter(c => c.termRemaining > 0);
            hhCohorts.forEach(c => {
                // 1. Calculate Interest
                const interest = c.balance * monthlyInterestRateHh;
                interestRevHh += interest;

                // 2. Process Defaults (Reduce Balance)
                const defaultAmt = c.balance * monthlyDefaultRateHh;
                writeOffHh += defaultAmt;
                c.balance -= defaultAmt;

                // 3. Amortization (Principal Payment)
                let principal = 0;
                if (c.termRemaining === 1) {
                    principal = c.balance; // Pay off remainder
                } else {
                    // Standard PMT minus Interest
                    principal = c.monthlyPayment - interest;
                }

                // Safety Checks
                if (principal > c.balance) principal = c.balance;
                if (principal < 0) principal = 0; // In case Interest > PMT (Negative Amortization)

                principalRepaidHh += principal;
                c.balance -= principal;
                c.termRemaining--;
            });

            // Process ME Cohorts
            meCohorts = meCohorts.filter(c => c.termRemaining > 0);
            meCohorts.forEach(c => {
                const interest = c.balance * monthlyInterestRateMe;
                interestRevMe += interest;

                // Defaults
                const defaultAmt = c.balance * monthlyDefaultRateMe;
                writeOffMe += defaultAmt;
                c.balance -= defaultAmt;

                // Principal
                let principal = 0;
                if (c.termRemaining === 1) {
                    principal = c.balance;
                } else {
                    principal = c.monthlyPayment - interest;
                }
                if (principal > c.balance) principal = c.balance;
                if (principal < 0) principal = 0;

                principalRepaidMe += principal;
                c.balance -= principal;
                c.termRemaining--;
            });

            const totalInterestRev = interestRevHh + interestRevMe;
            const principalRepaid = principalRepaidHh + principalRepaidMe;

            // Update Aggregate Portfolios (Master Source of Truth is now Cohorts)
            portfolioHh = hhCohorts.reduce((sum, c) => sum + c.balance, 0);
            portfolioMe = meCohorts.reduce((sum, c) => sum + c.balance, 0);

            // 4. Fund Metrics
            const fundDebtInterest = loanFundLiability * (inputs.fundCostOfCapital / 12);

            // 5. Aggregates
            // Revenue
            // Note: Inflow is Cash. Revenue is Interest + Fees.
            // Fees: varMgmtFee (assumed paid by borrower?) -> In this model, they are Expenses paid BY Fund. 
            // So Revenue = Interest Only.
            // Wait, does the fund CHARGE fees? usually yes. 
            // Let's assume `mgmtFeeRatio` is passed through.
            // For now, Net Profit = InterestRevenue - (OpsCost + BadDebt + FundInterst).

            // Phase 41: Granular Breakdown Logic
            const monthRevHh = interestRevHh;
            const monthRevMe = interestRevMe;

            // Granular Principal Repayment
            // Granular Principal Repayment
            // Use calculated values from upstream (Pro-Rata Fix)
            let monthPrincipalHh = principalRepaidHh;
            if (monthPrincipalHh > portfolioHh) monthPrincipalHh = portfolioHh; // Safety check if portfolio is small

            let monthPrincipalMe = principalRepaidMe;
            if (monthPrincipalMe > portfolioMe) monthPrincipalMe = portfolioMe;

            const monthBadDebt = writeOffHh + writeOffMe;
            const monthOps = totalOpCost;

            // Use new calculated values directly
            const paidFundInt = fundPaymentInterest;
            const paidFundPrincipal = fundPaymentPrincipal;

            const monthTotalOutflow = monthOps + monthBadDebt + paidFundInt + paidFundPrincipal;


            // Phase 49: Carbon Revenue Calculation (Annualized Verification)
            // Realism: Carbon credits are verified and issued ex-post, typically annually or bi-annually.
            // We simulate this by only paying out every 12 months.
            const carbonShare = (inputs.carbonCreditShare !== undefined ? inputs.carbonCreditShare : 100) / 100;
            // Pay out Monthly (Smoothed) to avoid chart spikes
            // We assume Carbon Credits are accrued and recognized continuously for simulation purposes.
            monthlyCarbonRev = (toiletsBuiltCumulative * inputs.co2PerToilet * inputs.co2Value * carbonShare) / 12;

            // Add to Cash Balance (Real Inflow)
            loanFundBalance += monthlyCarbonRev;

            // Add to Net Profit
            const monthNet = (monthRevHh + monthRevMe + monthlyCarbonRev) - monthTotalOutflow;

            dataMonthlyRevenueHh.push(monthRevHh);
            dataMonthlyRevenueMe.push(monthRevMe);
            dataMonthlyCarbonRevenue.push(monthlyCarbonRev);
            // dataMonthlyFundPrincipal.push(paidFundPrincipal); // Already pushed above

            dataMonthlyNet.push(monthNet);
            dataMonthlyOps.push(monthOps);
            dataMonthlyBadDebt.push(monthBadDebt);
            // dataMonthlyFundInt.push(paidFundInt); // Already pushed above


            // Phase 41: Granular Push
            dataMonthlyRepaymentHh.push(monthPrincipalHh);
            dataMonthlyRepaymentMe.push(monthPrincipalMe);
            dataMonthlyDefaultsHh.push(writeOffHh);
            dataMonthlyDefaultsMe.push(writeOffMe);
            dataMonthlyMgmtFees.push(varMgmtFee);

            dataMonthlyMandECosts.push(varMeCost);
            dataMonthlyFixedOps.push(monthlyFixedOps);

            // Phase 28 Debug Push
            dataMonthlyPortfolioHh.push(portfolioHh);
            dataMonthlyPortfolioMe.push(portfolioMe);
            dataMonthlyCashBalance.push(loanFundBalance + grantFundBalance);

            dataMonthlyNewLoansHhVal.push(newLoansHh);
            dataMonthlyNewLoansMeVal.push(newLoansMe);
            // Monthly Data (TRACK CUMULATIVE)
            // Use 'countGrant' (monthly flow) + prevGrant
            dataToiletsMonthlyGrant.push(prevGrant + countGrant);
            dataToiletsMonthlyLoan.push(prevLoan + countLoan);

            // Phase 55: "Robin Hood" Profit Recycling
            // Maximizing Grants: If the Lending business is profitable (Net > 0),
            // we immediately transfer 90% of that surplus to the Grant Fund.
            // This ensures high-interest loans cross-subsidize the poor continuously.
            if (monthNet > 0) {
                // Safety: Only recycle if Loan Fund is healthy (e.g. above 90% of initial to handle fluctuating working capital)
                // Actually, MonthNet > 0 means we added cash. We can safely move it.
                // We keep 10% for growth/inflation buffers.
                const recycleAmount = monthNet * 0.90;

                if (loanFundBalance >= recycleAmount) {
                    loanFundBalance -= recycleAmount;
                    grantFundBalance += recycleAmount;
                }
            }

            // Track Dormancy for Next Month's Ops Calculation
            if (production === 0) {
                dormantMonths++;
            } else {
                dormantMonths = 0;
            }

            // Update Reserve for Next Month
            // Legacy Logic Removed (Phase 35).  
            // We now calculate Dynamic Reserves at the START of the loop.
            // currentReserve = requiredReserveHh + requiredReserveMe; // Removed


            // End of Year Aggregation
            if (m % 12 === 0) {
                const totalBal = grantFundBalance + loanFundBalance;

                labels.push(`Year ${currentYear}`);
                dataToilets.push(toiletsBuiltCumulative);
                dataCost.push(inputs.investGrant + inputs.investLoan - totalBal);
                dataFund.push(totalBal);

                dataLoansHh.push(yearLoansHh);
                dataLoansMe.push(yearLoansMe);
                dataRepayments.push(yearRepayments);
                dataMgmtFees.push(yearMgmtFees);
                dataDefaultsHh.push(yearDefaultsHh);
                dataDefaultsMe.push(yearDefaultsMe);
                dataFundDebtService.push(yearDebtService);
                dataGrants.push(yearGrants);

                peopleReached = toiletsBuiltCumulative * inputs.avgHHSize;
                cumulativeCarbon += toiletsBuiltCumulative * inputs.co2PerToilet;

                dataPeople.push(peopleReached);
                dataCarbon.push(cumulativeCarbon);
                dataDalys.push(peopleReached * inputs.dalyPerPerson);
                dataJobs.push(currentMEs * inputs.mePerDistrict * 3);
                yearToilets = 0;
                yearGrants = 0;
                yearLoansHh = 0;
                yearDefaultsHh = 0;

                yearLoansMe = 0; // Fix: Reset ME Loans tracker
                yearMgmtFees = 0;
                yearRepayments = 0;
                yearDefaultsMe = 0;
                yearDebtService = 0;

                // --- Early Termination Check (Phase 20) ---
                // If NO loans were made this entire year (and we are past Year 1), terminate.
                const annualLoansCount = yearLoansHhCount + yearLoansMeCount; // Need to track counts
                if (currentYear > 1 && annualLoansCount === 0) {
                    constraints.capital = 0; // Force constraint update
                    constraintStr = "Terminated: No Activity"; // Override
                    break; // Stop Simulation
                }

                // Reset Counts for next year
                yearLoansHhCount = 0;
                yearLoansMeCount = 0;
            }
        } // End Monthly Loop

        // --- Final Calculations & Return ---
        let finalFundBalance = grantFundBalance + loanFundBalance;
        if (finalFundBalance < 0) finalFundBalance = 0;

        peopleReached = toiletsBuiltCumulative * inputs.avgHHSize;
        const totalHoursSaved = toiletsBuiltCumulative * 0.25 * 365;
        const totalSocialValue = (totalHoursSaved * 0.5) + (cumulativeCarbon * inputs.co2Value);
        const sroi = (totalSocialValue + finalFundBalance) / (inputs.investGrant + inputs.investLoan);

        // Advanced Metrics Calculation
        const totalInvest = inputs.investGrant + inputs.investLoan; // Total Initial Capital
        const totalLoansMe = dataLoansMe.reduce((a, b) => a + b, 0);

        // Phase 25: Net Equity Logic (Fix for Capital Preserved)
        const portfolioAssets = portfolioHh + portfolioMe; // Outstanding Loans
        const totalAssets = finalFundBalance + portfolioAssets;
        const netEquity = totalAssets - loanFundLiability;

        // Leverage: (Total Loans Disbursed / Net Equity)? Or Total Invest?
        // Traditionally Leverage = Total Assets / Equity.
        // Here: (Cumulative Loans / Grant)?
        // Stick to simple: Multiplier effect (loans disbursed / initial grant).
        const leverage = (cumulativeLoansHh + totalLoansMe) / (inputs.investGrant || 1);

        // Fund Health (Capital Preservation)
        // Ratio of Current Net Equity to Initial Grant (since Loan is external)
        // If Grant Only: Equity / Grant.
        // If Mixed: Equity / Grant.
        const fundHealth = (netEquity / (inputs.investGrant || 1));

        // --- Sustainability Analysis (New Phase 17) ---
        // 1. Total Expenses
        // Defaults are "Realized Losses"
        const totalDefaults = hhDefaultCostTotal + meDefaultCostTotal;
        // Ops & Fees
        const totalOpsExpenses = mgmtFeeTotal;
        // Grants (Subsidy Expense - Excluded from OSS to measure Revolving Sustainability)
        // const totalGrantExpense = cumulativeGrants; 

        // Financial Expense (Interest paid to Funders)
        const totalFundInterest = dataMonthlyFundInt.reduce((a, b) => a + b, 0);

        // OSS Denominator: Defaults + Ops + Cost of Capital
        const totalExpenses = totalDefaults + totalOpsExpenses + totalFundInterest;

        // 2. Total Revenue (Financial)
        // Fix: Use explicit Interest Revenue tracking (more accurate than Inflow approximation)
        const totalRevHh = dataMonthlyRevenueHh.reduce((a, b) => a + b, 0);
        const totalRevMe = dataMonthlyRevenueMe.reduce((a, b) => a + b, 0);
        const totalCarbonRev = dataMonthlyCarbonRevenue.reduce((a, b) => a + b, 0);

        // OSS = (Interest Revenue + Fees) / (Ops + Financial Expense + Defaults)
        // Do we include Carbon in OSS? Usually "Operational Sustainability" focuses on Core Business (Lending).
        // Carbon is "Other Income". 
        // Standard Microfinance OSS excludes Grants. Includes Fees & Interest.
        // Let's exclude Carbon for strict OSS, but mention it in "Profitability".

        const totalRevenue = totalRevHh + totalRevMe; // Interest Revenue Only

        // 3. OSS Ratio
        const ossRatio = totalExpenses > 0 ? (totalRevenue / totalExpenses) : 0;

        // 4. Depletion & Burn (Phase 25 Fix)
        // Check if Net Equity is eroding
        const netChange = netEquity - (inputs.investGrant || 1);
        let depletionYear = "Infinity";

        // If we lost equity
        if (netChange < 0) {
            // Annual Burn Rate
            const annualBurn = Math.abs(netChange) / inputs.duration;
            // Years remaining from Current Equity (not Fund Balance, as Portfolio ensures inflow)
            // But Portfolio is illiquid. Cash is liquid.
            // If Cash is 0, we can't pay ops.
            // So Depletion of CASH is relevant for "Liquidity Crisis".
            // But Depletion of EQUITY is relevant for "Solvency".
            // Users usually ask "When does the fund die?".
            // If Cash=0, fund is stuck (Liquidity Crisis).
            // Let's report LIQUIDITY runway if Cash < 0.1 * Assets.
            // But strict "Depletion Year" usually means Capital Consumption.

            // Hybrid: If Net Equity > 0 but Cash = 0, we are Illiquid.
            // Let's stick to Equity Burn for "Sustainability" metric.
            const yearsLeft = netEquity / annualBurn;
            const totalLife = inputs.duration + yearsLeft;
            depletionYear = totalLife.toFixed(1) + " Years";
            if (yearsLeft < 1) depletionYear = "< 1 Year";
        }

        // If we are strictly ILLIQUID (Cash=0) but Solvent (Equity>0)
        if (finalFundBalance <= 0 && netEquity > 0) {
            depletionYear = "Illiquid (Assets Only)";
        }

        // 5. Break-even & Max Grant Solvers
        // Required Revenue = Total Expenses
        // Current Revenue = totalRevenue (driven by inputs.loanInterestRate)
        // Gap = Total Expenses - Total Revenue
        // If Gap > 0, we need more interest.
        // Approx: NewRate = OldRate * (TargetRevenue / CurrentRevenue)?
        // Only if Revenue scales linearly with Rate. (It roughly does).
        // If CurrentRevenue is 0 (0% interest), this fails.
        let breakEvenRate = 0;
        if (totalRevenue > 0) {
            breakEvenRate = inputs.loanInterestRate * (totalExpenses / totalRevenue);
        } else if (inputs.loanInterestRate === 0 && totalExpenses > 0) {
            // Need a fallback solver or just say "Increase Rate"
            breakEvenRate = 0; // Cannot solve
        }

        // Max Sustainable Grant
        // Surplus (Pre-Grant) = Revenue - Ops - Defaults
        // If Surplus > 0, that's our Grant Budget.
        const surplusPreGrant = totalRevenue - (totalDefaults + totalOpsExpenses);
        let maxGrantPct = 0;
        if (surplusPreGrant > 0 && toiletsBuiltCumulative > 0) {
            // Surplus = MaxGrantTotal
            // MaxGrantTotal = Toilets * Cost * MaxPct
            // MaxPct = Surplus / (Toilets * Cost)
            // Use avgToiletCost
            const totalToiletValue = toiletsBuiltCumulative * inputs.avgToiletCost;
            maxGrantPct = (surplusPreGrant / totalToiletValue) * 100; // As percentage
        }

        // Phase 28: End-of-Period OSS (Steady State Sustainability)
        const lastM = dataMonthlyNet.length - 1;
        const endRev = (dataMonthlyRevenueHh[lastM] || 0) + (dataMonthlyRevenueMe[lastM] || 0);
        const endExp = (dataMonthlyOps[lastM] || 0) + (dataMonthlyFundInt[lastM] || 0) + (dataMonthlyBadDebt[lastM] || 0);
        const ossEnd = (endExp > 0) ? (endRev / endExp) : (endRev > 0 ? 999 : 0);

        // Final Counts (Explicitly captured)
        finalToilets = toiletsBuiltCumulative || 0;
        finalMEs = currentMEs || 0;

        // Fix: Use Actual LAST Value from Cumulative Array (Phase 44 Correction)
        // Previously used .reduce which SUMMED the cumulative series (Total Error).
        if (dataToiletsMonthlyGrant.length > 0) {
            finalToiletsGrant = dataToiletsMonthlyGrant[dataToiletsMonthlyGrant.length - 1];
        }
        if (dataToiletsMonthlyLoan.length > 0) {
            finalToiletsLoan = dataToiletsMonthlyLoan[dataToiletsMonthlyLoan.length - 1];
        }

        // Sanity Check: If totals mismatch slightly due to rounding, adjust Loan to fit Total
        // finalToilets (cumulative) should match sum(grant) + sum(loan)
        // If discrepancy, we trust the Cumulative Counter as the master 'Total'.
        // But for split, we trust the arrays.

        // Job Valuation
        jobValuation = finalMEs * 3 * (inputs.avgAnnualIncome || 1500);

        // Constraint String
        const totalMonthsSim = constraints.capital + constraints.capacity + constraints.demand || 1;
        let domConstraint = "Balanced";
        if (constraints.capital > constraints.capacity && constraints.capital > constraints.demand) domConstraint = "Funding";
        if (constraints.capacity > constraints.capital && constraints.capacity > constraints.demand) domConstraint = "Supply Chain";
        if (constraints.demand > constraints.capital && constraints.demand > constraints.capacity) domConstraint = "Demand";

        const series = {
            labels,
            dataToilets,
            dataCost,
            dataFund,
            dataLoansHh,
            dataLoansMe,
            dataRepayments,
            dataMgmtFees,
            dataDefaultsHh,
            dataDefaultsMe,
            dataFundDebtService,
            dataGrants,

            // Impact
            dataPeople,
            dataCarbon,
            dataDalys,
            dataJobs,

            // Monthly Arrays (Granular)
            monthlyLabels,
            dataToiletsMonthlyGrant,
            dataToiletsMonthlyLoan,

            dataMonthlyNewLoansHhVal,
            dataMonthlyRevenueHh,
            dataMonthlyRepaymentHh,
            dataMonthlyDefaultsHh,

            dataMonthlyNewLoansMeVal,
            dataMonthlyRevenueMe,
            dataMonthlyRepaymentMe,
            dataMonthlyDefaultsMe,

            dataMonthlyMgmtFees,
            dataMonthlyMandECosts,
            dataMonthlyFixedOps,

            dataMonthlyFundPrincipal,
            dataMonthlyFundInt,
            dataMonthlyCarbonRevenue,

            dataMonthlyBadDebt, // RESTORED FIX
            dataMonthlyNet,
            dataMonthlyCashBalance, // Renamed from Inflow for clarity

            // Debug
            dataMonthlyCapacity,
            dataMonthlyAffordable,

            // Debug 28
            dataMonthlyPortfolioHh,
            dataMonthlyPortfolioMe
        }; // Close series



        // --- Post-Calculation: Compute KPIs (Single Source of Truth) ---
        const kpis = ModelModule.computeKPIs(series, inputs);

        // --- Solver: Break-Even Rate (Binary Search) ---
        // Only run if not already efficiently solved or if explicitly needed?
        // User asked for it in the report. We'll run it here.
        // Optimization: Don't run if we are inside a recursion depth > 0 (to avoid stack overflow if used recursively).
        // But runCalculation default depth is 0.
        // We'll calculate it ONCE here.
        if (inputs.enableBreakEvenSolver !== false) {
            kpis.breakEvenRate = ModelModule.solveBreakEven(inputs);
        }

        return {
            series,
            kpis
        };
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
        const mes = s.dataJobs[s.dataJobs.length - 1] / 3; // Reverse calc or use param

        // 2. Portfolio & Financials (Aggregates)
        const totalLoansDisbursedHH = s.dataMonthlyNewLoansHhVal.reduce((a, b) => a + b, 0);
        const totalLoansDisbursedME = s.dataMonthlyNewLoansMeVal.reduce((a, b) => a + b, 0);
        const totalLoansDisbursed = totalLoansDisbursedHH + totalLoansDisbursedME;

        const totalGrantsVal = s.dataToiletsMonthlyGrant[last] * inputs.avgToiletCost * (inputs.grantSupportPct || 0); // Approx
        const totalOpsFixed = s.dataMonthlyFixedOps.reduce((a, b) => a + b, 0);
        const totalOpsVar = s.dataMonthlyMgmtFees.reduce((a, b) => a + b, 0) + s.dataMonthlyMandECosts.reduce((a, b) => a + b, 0);
        const totalOps = totalOpsFixed + totalOpsVar;

        const totalDefaults = s.dataMonthlyBadDebt.reduce((a, b) => a + b, 0);
        const totalFundInterest = s.dataMonthlyFundInt.reduce((a, b) => a + b, 0);

        const totalRevenueInt = s.dataMonthlyRevenueHh.reduce((a, b) => a + b, 0) + s.dataMonthlyRevenueMe.reduce((a, b) => a + b, 0);
        const totalCarbonRevenue = s.dataMonthlyCarbonRevenue.reduce((a, b) => a + b, 0);
        const totalInflows = totalRevenueInt + totalCarbonRevenue; // Excluding Principal Repayment

        // 3. Balance Sheet Metrics (End of Period)
        const cashEnd = s.dataMonthlyCashBalance[last] || 0;
        const portfolioHH_End = s.dataMonthlyPortfolioHh[last] || 0;
        const portfolioME_End = s.dataMonthlyPortfolioMe[last] || 0;
        const portfolioOutstanding = portfolioHH_End + portfolioME_End;

        // Investor Liability (We need to track this in series? Only cash flow is tracked)
        // We can reconstruct it: Initial - Sum(PrincipalRepaid).
        const totalRepaidPrincipal = s.dataMonthlyFundPrincipal.reduce((a, b) => a + b, 0);
        const investorLiabilityEnd = inputs.investLoan - totalRepaidPrincipal;

        const netAssetsEnd = cashEnd + portfolioOutstanding - investorLiabilityEnd;
        const initialCapital = inputs.investGrant + inputs.investLoan;
        const capitalPreservedPct = (netAssetsEnd / initialCapital) * 100;

        // 4. Sustainability Metrics
        // OSS = (Interest + Fees + Carbon) / (Fixed Ops + Variable Ops)
        // Note: Fees? We assumed Revenue is Interest only. If fees exist, they are in Revenue.
        const ossRatio = totalOps > 0 ? (totalInflows / totalOps) : 0;

        // FSS = (Inflows) / (Ops + Defaults + FundInterest + Inflation?)
        // Inflation is implicit in costs. Capital Cost is FundInterest.
        const fssDenominator = totalOps + totalDefaults + totalFundInterest;
        const fssRatio = fssDenominator > 0 ? (totalInflows / fssDenominator) : 0;

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
        const totalDalysAverted = (people * (inputs.dalyPerPerson || 0)); // Total for cumulative people?
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
                investorRepaidPct: inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0
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
                economicValue: totalSocialValue,
                sroi: sroi,
                carbon: totalCarbon,
                dalys: totalDalysAverted // Just the cumulative count?
            },
            // Flat props for easier UI Compat if needed, or update UI to use .value
            economicValue: totalSocialValue,
            sroi: sroi,
            carbon: totalCarbon.toFixed(1),
            // Explicit UI mappings required by updateProgrammeSummary
            totalLatrines: totalToilets,
            people: people,
            jobs: mes * 3,
            loanToilets: loanToilets,
            loanToiletsVal: totalLoansDisbursed,
            grantToilets: grantToilets,
            grantToiletsVal: totalGrantsVal,
            fundBalance: cashEnd,
            fundRepaid: totalRepaidPrincipal,
            totalPrinRepayPct: inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0,
            capitalPreserved: capitalPreservedPct,
            ossRatio: ossRatio,
            minCash: s.dataMonthlyCashBalance.reduce((min, val) => Math.min(min, val), s.dataMonthlyCashBalance[0]),
            insolvencyMonths: monthsInsolvent,
            // Explicit UI mappings required by updateProgrammeSummary
            totalLatrines: totalToilets,
            households: households,
            mes: mes,
            people: people,
            jobs: mes * 3,
            loanToilets: loanToilets,
            loanToiletsVal: totalLoansDisbursed,
            grantToilets: grantToilets,
            grantToiletsVal: totalGrantsVal,
            fundBalance: cashEnd,
            finalFundBalance: cashEnd,
            fundRepaid: totalRepaidPrincipal,
            principalRepaid: totalRepaidPrincipal,
            totalPrinRepayPct: inputs.investLoan > 0 ? (totalRepaidPrincipal / inputs.investLoan) : 0,
            capitalPreserved: capitalPreservedPct,
            ossRatio: ossRatio,
            minCash: s.dataMonthlyCashBalance.reduce((min, val) => Math.min(min, val), s.dataMonthlyCashBalance[0]),
            insolvencyMonths: monthsInsolvent,
            costPerLatrine: costPerLatrine,
            effectiveCostPerLatrine: effectiveCostPerLatrine,
            breakEvenRate: 0,
            maxGrantPct: 0,
            dalys: totalDalysAverted.toFixed(0),

            // Placeholders for Solver results (filled by solveBreakEven)
            breakEvenRate: 0,
            maxGrantPct: 0
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

        // Clone inputs to avoid mutating UI
        const simInputs = { ...inputs };
        // Disable Solvers in sub-sims to avoid recursion
        simInputs.enableBreakEvenSolver = false;

        for (let i = 0; i < iterations; i++) {
            const mid = (low + high) / 2;
            simInputs.loanInterestRate = mid * 100; // Convert to % if calculate expects %? 
            // Wait, calculate expects DECIMAL derived in calculate: `const monthlyInterestRateHh = inputs.loanInterestRate / 12;`
            // getInputs returns 0.10 for 10%.
            // So simulation expects DECIMAL (0.10).
            simInputs.loanInterestRate = mid;

            // Run Light Simulation (Maybe optimization possible? No, fast enough)
            const res = this.calculate(simInputs);
            const kpi = res.kpis;

            // Objective: Net Assets >= 0 AND Min Cash >= 0?
            // User said: "end-of-project net_assets_end >= target (often >= 0)"
            if (kpi.financials.netAssets >= targetNetAssets) {
                bestRate = mid;
                high = mid; // Try lower
            } else {
                low = mid; // Need higher
            }
        }
        return bestRate; // Decimal (e.g. 0.25)
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
            grantFund: getRaw('wiz-invest-grant-sidebar'),
            loanFund: getRaw('wiz-invest-loan-sidebar'),
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
        const ctxCost = document.getElementById('costChart').getContext('2d');
        if (chartInstances.cost) chartInstances.cost.destroy();

        // Need Annual Grants (series.dataGrants is Annual now)
        const annualGrants = series.dataGrants;

        chartInstances.cost = new Chart(ctxCost, {
            type: 'bar',
            data: {
                labels: series.labels,
                datasets: [
                    { label: 'HH Loans', data: series.dataLoansHh, backgroundColor: '#3b82f6', stack: 'Stack 0' },
                    { label: 'ME Setup Loans', data: series.dataLoansMe, backgroundColor: '#1e40af', stack: 'Stack 0' },
                    { label: 'Grants', data: annualGrants, backgroundColor: '#8b5cf6', stack: 'Stack 0' },
                    { label: 'Op. Costs (Variable)', data: series.dataMgmtFees, backgroundColor: '#f97316', stack: 'Stack 0' },
                    { label: 'Fund Cost (Interest)', data: annualFundInt, backgroundColor: '#f59e0b', stack: 'Stack 0' },
                    { label: 'Investor Repayment', data: series.dataFundDebtService, backgroundColor: '#64748b', stack: 'Stack 0' },
                    { label: 'Defaults', data: series.dataDefaultsHh, backgroundColor: '#ef4444', stack: 'Stack 0' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } }
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
                        label: 'MgmtFees(Var)',
                        data: series.dataMonthlyMgmtFees.map(v => -v),
                        backgroundColor: '#fca5a5', // Red 300
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'MandECosts(Var)',
                        data: series.dataMonthlyMandECosts.map(v => -v),
                        backgroundColor: '#ef4444', // Red 500
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'FixedOps',
                        data: series.dataMonthlyFixedOps.map(v => -v),
                        backgroundColor: '#b91c1c', // Red 700
                        stack: 'stack1',
                        order: 1
                    },
                    {
                        label: 'Defaults(Total)',
                        data: series.dataMonthlyBadDebt.map(v => -v),
                        backgroundColor: '#7f1d1d', // Dark Red
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
            const annualGrant = i === 0 ? series.dataGrants[i] : series.dataGrants[i] - series.dataGrants[i - 1];

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
            `CostPerLatrine,$${(document.getElementById('sum-cost-per-latrine')?.innerText || '0').replace('$', '')}` // Add Metric
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
                "New Loans (HH)", "Rev Int (HH)", "Principal Repaid (HH)", "Defaults (HH)",
                "New Loans (ME)", "Rev Int (ME)", "Principal Repaid (ME)", "Defaults (ME)",
                "Mgmt Fees (Var)", "M&E Costs (Var)", "Fixed Ops",
                "Investor Repayment (Principal)", "Investor Interest (Int)", "Carbon Rev",
                "Net Cash Flow", "Cash Balance"
            ];
            lines.push(headers.join(","));

            // --- 3. Data Rows ---
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
            lines.push(`Depletion Year,${(stats.depletionYear || (stats.minCash < 0 ? "< 1 Year" : "Sustainable"))}`);
            lines.push(`Break-even Interest,${(stats.breakEvenRate || 0).toFixed(1)}%`);
            lines.push(`Max Sustainable Grant,${(stats.maxGrantPct || 0).toFixed(1)}%`);
            lines.push(`Fund Balance (End),$${(stats.finalFundBalance || 0).toFixed(2)}`);
            lines.push(`Principal Repaid,$${(stats.principalRepaid || 0).toLocaleString()}`);
            lines.push(`Capital Preserved,${(((stats.finalFundBalance || 0) / (inputs.investLoan || 1) - 1) * 100).toFixed(1)}%`);
            lines.push(`Self-Sufficiency,${(((stats.finalFundBalance || 0) / (inputs.investLoan || 1)) * 100 + 100).toFixed(1)}%`);
            lines.push(`Min Cash Balance,$${stats.minCash || 0}`);
            lines.push(`Months Insolvent,${stats.insolvencyMonths || 0}`);
            lines.push(`Ops Coverage,${(inputs.annualFixedOpsCost > 0 ? ((stats.finalFundBalance || 0) / inputs.annualFixedOpsCost).toFixed(1) : "0")} Years`);
            lines.push(`Total Leverage,${(inputs.investGrant > 0 ? (((stats.loanToiletsVal || 0) + (stats.grantToiletsVal || 0)) / (inputs.investGrant + (inputs.investLoan || 0))).toFixed(1) : "Infinite")}x`);
            lines.push(`SROI Ratio,${stats.sroi || 0}x`);
            lines.push(`Cost / Latrine,$${(stats.costPerLatrine || 0).toFixed(2)}`);
            lines.push(`Effective Cost / Latrine,$${(stats.effectiveCostPerLatrine || 0).toFixed(2)}`);

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
        setTxt('sus-oss-ratio', ((stats.ossRatio || 0) * 100).toFixed(0) + "%");
        setTxt('sus-depletion', stats.minCash < 0 ? "< 1 Year" : "Sustainable");

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
        setTxt('sum-effective-cost', fmtMoney(stats.effectiveCostPerLatrine));

        // SROI (Use calculated value)
        setTxt('sum-sroi', (stats.sroi || 0).toFixed(1) + "x");

        // Capital Preservation Section
        const capPreservedPct = ((stats.fundBalance || 0) / (inputs.investLoan || 1) - 1) * 100;

        setTxt('sum-health', capPreservedPct.toFixed(1) + "%");
        setTxt('sum-sufficiency', stats.ossRatio > 1.2 ? "Excellent" : (stats.ossRatio > 1.0 ? "Good" : "Subsidized"));

        // Legacy/Duplicate mappings
        setTxt('sum-repaid', fmtMoney(stats.principalRepaid || 0));
        setTxt('sum-repaid-pct', (((stats.principalRepaid || 0) / (inputs.investLoan || 1)) * 100).toFixed(1) + "%");
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
            "FundPrincipalCfl", "OpsExp", "BadDebtExp", "FundIntExp",
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
                (s.dataMonthlyBadDebt[i] || 0).toFixed(2),
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
            "EndBal": "Cash Balance at end of month"
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
                    <th title="${tooltipMap.MoTotal}" style="background:#f0f9ff;">Total Qty (Mo)</th>

                    <th title="${tooltipMap.NewLoanHH}">NewLoans(HH)</th>
                    <th title="${tooltipMap.RevIntHH}">RevInt(HH)</th>
                    <th title="${tooltipMap.PrinRepHH}">PrinRepaid(HH)</th>
                    <th title="${tooltipMap.DefHH}">Defaults(HH)</th>
                    
                    <th title="${tooltipMap.NewLoanME}">NewLoans(ME)</th>
                    <th title="${tooltipMap.RevIntME}">RevInt(ME)</th>
                    <th title="${tooltipMap.PrinRepME}">PrinRepaid(ME)</th>
                    <th title="${tooltipMap.DefME}">Defaults(ME)</th>
                    
                    <th title="${tooltipMap.MgmtFees}">MgmtFees</th>
                    <th title="${tooltipMap.MandE}">M&E Costs</th>
                    <th title="${tooltipMap.FixOps}">FixedOps</th>
                    
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
                <td>${fmtMoney(s.dataMonthlyMgmtFees[i])}</td>
                <td>${fmtMoney(s.dataMonthlyMandECosts[i])}</td>
                <td>${fmtMoney(s.dataMonthlyFixedOps[i])}</td>
                
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
