/**
 * export.js — part of the S5 structural split (ADR-0033). CSV export (F-36, ADR-0026) and the clipboard report.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 5 violations in this file (`cumLoan`, `cumGrant`, `fmt`, `fmtM`, `url`). Recorded,
 * not fixed, per docs/ROADMAP.md's S0 task. Run `npx eslint src/` before committing;
 * if this file's count goes up, that is a new defect, not baseline noise.
 */
Object.assign(UI, {
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
                // Solvers now return { ok, value, reason } (ADR-0032, F-27).
                breakEvenRate: (UI.lastResults.breakEvenRate && UI.lastResults.breakEvenRate.ok)
                    ? (UI.lastResults.breakEvenRate.value * 100).toFixed(1) + '%' : 'N/A',
                maxGrantPct: (UI.lastResults.maxGrantPct && UI.lastResults.maxGrantPct.ok)
                    ? (UI.lastResults.maxGrantPct.value * 100).toFixed(1) + '%' : 'N/A',

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
});
