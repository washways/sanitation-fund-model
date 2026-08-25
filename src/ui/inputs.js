/**
 * inputs.js — part of the S5 structural split (ADR-0033). Reads the form into the inputs object UI/ModelModule share; one-time setup.
 */

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
};

Object.assign(UI, {
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
});
