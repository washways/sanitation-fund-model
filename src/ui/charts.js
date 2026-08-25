/**
 * charts.js — part of the S5 structural split (ADR-0033). Chart.js rendering. chartInstances lives here — nothing else touches it.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 1 violation in this file (`meDef`). Recorded, not fixed, per docs/ROADMAP.md's S0
 * task. Run `npx eslint src/` before committing; if this file's count goes up, that
 * is a new defect, not baseline noise.
 */
let chartInstances = {};

Object.assign(UI, {
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
});
