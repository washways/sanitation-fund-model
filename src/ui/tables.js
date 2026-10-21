/**
 * tables.js — part of the S5 structural split (ADR-0033). The on-screen monthly data table.
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
    }

});
