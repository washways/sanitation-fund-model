/**
 * inputs.js — part of the S5 structural split (ADR-0033). Reads the form into the inputs object UI/ModelModule share; one-time setup.
 */

// --- UI Module ---
const UI = {
    getInputs() {
        // No fallback defaults (F-72, AGENTS.md §4). A control missing from the page
        // reads as NaN so validateInputs rejects it by name. The old per-field
        // defaults disagreed with index.html, so a dropped id ran on a number nobody
        // chose.
        const getRaw = id => {
            const el = document.getElementById(id);
            if (!el) return Number.NaN;
            // Strip commas and currency symbols
            const val = el.value.replace(/,/g, '').replace(/\$/g, '').trim();
            // Blank or malformed user input is not permission to restore a hidden
            // assumption. Preserve invalidity for ModelModule.validateInputs (F-46).
            if (val === '') return Number.NaN;
            return Number(val);
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
         */
        const getPercent = id => getRaw(id) / 100;

        return {
            country: document.getElementById('countryInput').value || 'Unknown',
            investGrant: getRaw('wiz-invest-grant-sidebar'),
            investLoan: getRaw('wiz-invest-loan-sidebar'),
            popReqToilets: getRaw('popReqToilets'),
            popGrowthRate: getPercent('popGrowthRate'),
            avgHHSize: getRaw('avgHHSize'),
            grantSupportPct: getPercent('grantSupportPct'),
            avgToiletCost: getRaw('avgToiletCost'),
            districts: getRaw('districts'),
            mePerDistrict: getRaw('mePerDistrict'),
            jobsPerMe: getRaw('jobsPerMe'),
            toiletsPerMeMonth: getRaw('toiletsPerMeMonth'),
            meSetupCost: getRaw('meSetupCost'),
            meWorkingCapitalMonths: getRaw('meWorkingCapitalMonths'),
            loanInterestRate: getPercent('loanInterestRate_v2'),
            meLoanInterestRate: getPercent('meLoanInterestRate_v2'),
            hhDefaultRate: getPercent('hhDefaultRate'),
            meDefaultRate: getPercent('meDefaultRate'),
            // Business closure, distinct from loan write-down — see R-6.3.
            meExitRate: getPercent('meExitRate'),
            // In-loop ME expansion pacing (R-6.2). Both were hardcoded 0.1 until
            // ADR-0019.
            meExpansionBudgetShare: getPercent('meExpansionBudgetShare'),
            meMaxMonthlyGrowthRate: getPercent('meMaxMonthlyGrowthRate'),
            mgmtFeeRatio: getPercent('mgmtFeeRatio'),
            inflationRate: getPercent('inflationRate'),
            contingencyRate: getPercent('contingencyRate'),
            initialMeNetworkShare: getPercent('initialMeNetworkShare'),
            annualFixedOpsCost: getRaw('annualFixedOpsCost'),
            meCostRate: getPercent('meCostRate'),
            fundCostOfCapital: getPercent('fundCostOfCapital'),
            fundRepaymentTerm: getRaw('fundRepaymentTerm'),
            termHh: getRaw('termHh'),
            termMe: getRaw('termMe'),
            // Impact
            dalyPerPerson: getRaw('dalyPerPerson'),
            dalyImpactRealisation: getPercent('dalyImpactRealisation'),
            dalyValue: getRaw('dalyValue'),
            avgAnnualIncome: getRaw('avgAnnualIncome'),
            co2PerToilet: getRaw('co2PerToilet'),
            co2Value: getRaw('co2Value'),
            carbonCreditShare: getPercent('carbonCreditShare'),
            // Optimization Flags
            enableBreakEvenSolver: true,
            verify: true,
            investorGracePeriod: getRaw('investorGracePeriod'),
            duration: getRaw('wiz-duration-sidebar'),
            // Hours saved per person per day (R-8.2). Was a hardcoded 0.25 buried in
            // two conflicting formulas; now a single named assumption.
            hoursPerPersonPerDay: getRaw('hoursPerPersonPerDay'),
            // Share of the market wage at which saved household time is valued (R-8.6).
            timeValueFactor: getPercent('timeValueFactor'),
            // Service life; carbon crediting stops after this (R-8.5).
            toiletLifespanYears: getRaw('toiletLifespanYears')
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

            // Remove legacy programmatic highlighting only on a genuine user edit.
            // Country-observation provenance owns its own listener in the controller.
            input.addEventListener('input', (e) => {
                if (e.isTrusted) e.target.classList.remove('auto-filled');
            });
        });
    },

    calculateAffordability(data, toiletCost) {
        const income = Number.isFinite(data?.gni) ? data.gni : data?.gdp;
        if (!Number.isFinite(income) || income <= 0) return;

        const costRatio = toiletCost / income;

        const helpEl = document.getElementById('affordability-help');
        if (helpEl) {
            helpEl.innerHTML = `
                 <div style="background:#f0f9ff; padding:8px; border-radius:4px; border:1px solid #bae6fd; font-size:0.9em;">
                     <strong>Affordability context (does not change subsidy policy)</strong>
                     <ul style="list-style:disc; margin-left:1rem; margin-top:4px; margin-bottom:4px;">
                         <li><strong>Toilet Cost:</strong> $${toiletCost}</li>
                         <li><strong>GNI/GDP per capita:</strong> $${income.toFixed(0)}</li>
                         <li><strong>Cost Burden:</strong> ${(costRatio * 100).toFixed(1)}% of annual income.</li>
                         <li><strong>Gini Index:</strong> ${Number.isFinite(data.gini) ? data.gini.toFixed(1) : 'N/A'}</li>
                         <li><strong>Poverty:</strong> ${Number.isFinite(data.poverty) ? data.poverty.toFixed(1) + '%' : 'N/A'}</li>
                     </ul>
                     <div style="margin-top:6px; border-top:1px solid #bae6fd; padding-top:4px;">
                         Set grant pacing from the programme's approved subsidy policy and affordability study.
                     </div>
                 </div>`;
        }
    },
});
