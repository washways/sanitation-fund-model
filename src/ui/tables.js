/**
 * tables.js — part of the S5 structural split (ADR-0033). The on-screen monthly data table.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 1 violation in this file (`hhDefault`). Recorded, not fixed, per docs/ROADMAP.md's
 * S0 task. Run `npx eslint src/` before committing; if this file's count goes up,
 * that is a new defect, not baseline noise.
 */
Object.assign(UI, {
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
});
