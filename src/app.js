/**
 * app.js — part of the S5 structural split (ADR-0033). Controller and wiring only — the DOMContentLoaded handler, runCalculation, and final event wiring. Depends on every module above.
 */

// --- App Controller ---
document.addEventListener('DOMContentLoaded', () => {
    // Initial UI Setup
    UI.setupFormatting();

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



    let countryLoadSequence = 0;
    document.getElementById('fetchDataBtn').addEventListener('click', async () => {
        const btn = document.getElementById('fetchDataBtn');
        const inputVal = document.getElementById('countryInput').value;
        const requestId = ++countryLoadSequence;

        // Lookup Code
        const countryObj = LDC_COUNTRIES.find(c => c.name === inputVal || c.code === inputVal);

        if (!countryObj) {
            alert("Please select a valid LDC country from the list.");
            return;
        }

        const country = countryObj.code;
        const originalText = btn.innerText;
        btn.innerText = "Loading...";



        const [data, healthBurden] = await Promise.all([
            ApiModule.fetchData(country),
            WhoApiModule.fetchSanitationDalys(country),
        ]);
        let healthEstimate = null;
        if (healthBurden) {
            const exposure = await ApiModule.fetchSanitationExposure(country, healthBurden.year);
            const population = Number(exposure?.population?.value);
            const basicSanitationPct = Number(exposure?.basicSanitation?.value);
            const lowerBoundDalys = Number(healthBurden.low);
            const exposedPopulation = population * (1 - basicSanitationPct / 100);
            if (Number.isFinite(population) && population > 0
                && Number.isFinite(basicSanitationPct) && basicSanitationPct >= 0 && basicSanitationPct < 100
                && Number.isFinite(lowerBoundDalys) && lowerBoundDalys >= 0
                && Number.isFinite(exposedPopulation) && exposedPopulation > 0) {
                healthEstimate = {
                    rate: lowerBoundDalys / exposedPopulation,
                    lowerBoundDalys,
                    exposedPopulation,
                    year: healthBurden.year,
                };
            }
        }
        // A slower earlier request must never overwrite a country selected later.
        if (requestId !== countryLoadSequence) return;
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
            const hasNumber = value => Number.isFinite(value);
            const yearOf = key => data.meta?.[key]?.year || 'year unavailable';
            // Update Title
            const flag = getFlagImg(countryObj.iso2);
            const titleEl = document.getElementById('dashboardTitle');
            if (titleEl) {
                // Use innerHTML instead of innerText to render the <img> tag
                titleEl.innerHTML = `${flag} ${countryObj.name} Rural Sanitation Fund Model`;
            }

            const wbDiv = document.getElementById('wbIndicators');
            // Enhanced Stats Header
            const popM = hasNumber(data.pop) ? (data.pop / 1e6).toFixed(2) : 'N/A';
            let access = hasNumber(data.basicSan) ? data.basicSan.toFixed(1) + '%' : 'N/A';
            let unserved = 'N/A';
            if (hasNumber(data.pop) && hasNumber(data.basicSan)) {
                const gap = (100 - data.basicSan) / 100;
                unserved = ((data.pop * gap) / 1e6).toFixed(2) + 'M';
            }

            // Use GNI if available, else GDP
            const incomeMetric = hasNumber(data.gni) ? data.gni : data.gdp;
            const incomeLabel = hasNumber(data.gni) ? 'GNI/c' : 'GDP/c';
            const incomeCode = hasNumber(data.gni) ? 'NY.GNP.PCAP.CD' : 'NY.GDP.PCAP.CD';

            const healthTag = healthEstimate
                ? `<a href="https://www.who.int/data/gho/data/indicators/indicator-details/GHO/number-of-diarrhoea-dalys-from-inadequate-sanitation" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Conservative sanitation burden (${healthEstimate.year}):</strong> ${healthEstimate.rate.toFixed(5)} DALY/person-year &#8599;
                    </a>`
                : `<span class="tag"><strong>Sanitation DALY burden:</strong> Not estimated</span>`;

            wbDiv.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                    <a href="https://data.worldbank.org/indicator/SP.RUR.TOTL?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Rural Pop (${yearOf('pop')}):</strong> ${popM}${popM === 'N/A' ? '' : 'M'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/${incomeCode}?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>${incomeLabel} (${yearOf(hasNumber(data.gni) ? 'gni' : 'gdp')}):</strong> $${hasNumber(incomeMetric) ? Math.round(incomeMetric) : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/SH.STA.BASS.RU.ZS?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Rural Sanitation Access (${yearOf('basicSan')}):</strong> ${access} &#8599;
                    </a>
                    <span class="tag highlight"><strong>Unserved (Rural):</strong> ${unserved}</span>
                    <a href="https://data.worldbank.org/indicator/SI.POV.GINI?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Gini (${yearOf('gini')}):</strong> ${hasNumber(data.gini) ? data.gini.toFixed(1) : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Observed CPI (${yearOf('inflation')}):</strong> ${hasNumber(data.inflation) ? data.inflation.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/SI.POV.DDAY?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>${data.meta?.poverty?.label || 'Poverty'} (${yearOf('poverty')}):</strong> ${hasNumber(data.poverty) ? data.poverty.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                    <a href="https://data.worldbank.org/indicator/FR.INR.LEND?locations=${country}" target="_blank" class="tag" style="text-decoration:none; color:inherit; border-bottom:1px dotted #ccc;">
                        <strong>Commercial Lending (${yearOf('lendingRate')}):</strong> ${hasNumber(data.lendingRate) ? data.lendingRate.toFixed(1) + '%' : 'N/A'} &#8599;
                    </a>
                    ${healthTag}
                </div>
    `;

            const fillParam = (id, val, sourceDescription, sourceType = 'world-bank', sourceLabel = 'World Bank') => {
                const el = document.getElementById(id);
                if (el && val !== null && val !== undefined && !isNaN(val)) {
                    if (id === 'popReqToilets') {
                        el.value = parseInt(val).toLocaleString();
                    } else {
                        el.value = val;
                    }

                    // ADR-0046/0049: this state belongs only to inputs populated from
                    // authoritative country observations or transparent derivations.
                    el.classList.remove('auto-filled');
                    el.classList.add('country-observation');
                    el.dataset.sourceType = sourceType;
                    el.dataset.sourceDescription = sourceDescription;
                    el.title = `${sourceLabel} country data: ${sourceDescription}`;

                    if (!el.dataset.hasProvenanceListener) {
                        el.dataset.hasProvenanceListener = 'true';
                        el.addEventListener('input', event => {
                            if (!event.isTrusted) return;
                            el.classList.remove('country-observation');
                            el.dataset.sourceType = 'user';
                            el.dataset.sourceDescription = 'User-entered value';
                            el.title = 'User-entered value; country API provenance removed.';
                        });
                    }
                    el.dispatchEvent(new Event('input'));
                }
            };
            const clearParam = id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = '';
                    el.classList.remove('auto-filled');
                    el.classList.remove('country-observation');
                    delete el.dataset.sourceType;
                    delete el.dataset.sourceDescription;
                    el.title = 'No country observation available; enter a cited value before recalculating.';
                }
            };
            const resetOptionalEstimate = (id, value, description) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = String(value);
                    el.classList.remove('auto-filled');
                    el.classList.remove('country-observation');
                    el.dataset.sourceType = 'default';
                    el.dataset.sourceDescription = description;
                    el.title = description;
                    el.dispatchEvent(new Event('input'));
                }
            };
            const missing = [];

            // 1. Demand & Transparency
            if (hasNumber(data.pop) && hasNumber(data.basicSan)) {
                const gap = (100 - data.basicSan) / 100;
                const req = Math.floor(data.pop * gap); // Unserved People
                fillParam(
                    'popReqToilets',
                    req,
                    `derived from rural population (${yearOf('pop')}) and rural basic sanitation access (${yearOf('basicSan')})`
                );

                // Update Transparency UI
                const setText = (id, txt) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = txt;
                };

                setText('transparency-pop', `Rural Pop: ${(data.pop / 1e6).toFixed(2)} M`);
                setText('transparency-access', `Access: ${data.basicSan.toFixed(1)}% `);
                setText('transparency-gap', `Unserved: ${(req / 1e6).toFixed(2)} M`);
            } else {
                clearParam('popReqToilets');
                missing.push('rural population/basic sanitation');
            }

            // Macro observations are context. Local CPI is not a USD cost-escalation
            // forecast, so it must not be written into the model (ADR-0034).
            // Store Commercial Lending Rate for Benchmarking
            if (hasNumber(data.lendingRate)) {
                const loanInput = document.getElementById('loanInterestRate_v2'); // UPDATED ID
                if (loanInput) loanInput.dataset.benchmark = data.lendingRate;

                const lendingContext = `Commercial lending context (${yearOf('lendingRate')}): ` +
                    `${data.lendingRate.toFixed(1)}%. This is not a programme APR; set the field from ` +
                    `cost of funds, servicing cost, expected losses, affordability, subsidy, and margin.`;
                const hhRateHelp = document.getElementById('hh-rate-help');
                const meRateHelp = document.getElementById('me-rate-help');
                if (hhRateHelp) hhRateHelp.innerText = lendingContext;
                if (meRateHelp) meRateHelp.innerText = lendingContext;

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
            } else {
                const noLendingContext = 'Commercial lending context is unavailable for this country. ' +
                    'Set the programme APR from the actual product pricing model.';
                const hhRateHelp = document.getElementById('hh-rate-help');
                const meRateHelp = document.getElementById('me-rate-help');
                if (hhRateHelp) hhRateHelp.innerText = noLendingContext;
                if (meRateHelp) meRateHelp.innerText = noLendingContext;
            }

            const opsCostHelp = document.getElementById('ops-cost-help');
            if (opsCostHelp) {
                opsCostHelp.innerText = 'Cannot be derived from a country macro API; enter the programme budget ' +
                    'for staff, offices, vehicles, systems, audit, and field service.';
            }
            const costEscalationHelp = document.getElementById('cost-escalation-help');
            if (costEscalationHelp) {
                costEscalationHelp.innerText = hasNumber(data.inflation)
                    ? `Local-currency CPI context (${yearOf('inflation')}): ${data.inflation.toFixed(1)}%. ` +
                      `Do not use it as USD cost escalation without an exchange-rate and programme cost-basket forecast.`
                    : 'Local-currency CPI context is unavailable. Set forward USD escalation from the programme cost basket and exchange-rate assumptions.';
            }
            if (hasNumber(data.popGrowth)) {
                fillParam(
                    'popGrowthRate',
                    data.popGrowth.toFixed(2),
                    `population growth observation (${yearOf('popGrowth')})`
                );
            } else {
                clearParam('popGrowthRate');
                missing.push('population growth');
            }

            // Income is an observed input used to value saved time.
            if (hasNumber(incomeMetric)) {
                fillParam(
                    'avgAnnualIncome',
                    Math.round(incomeMetric),
                    `${hasNumber(data.gni) ? 'GNI' : 'GDP'} per capita observation ` +
                        `(${yearOf(hasNumber(data.gni) ? 'gni' : 'gdp')})`
                );
            } else {
                clearParam('avgAnnualIncome');
                missing.push('GNI/GDP per capita');
            }

            // The physical health burden proxy is optional: use the conservative WHO lower
            // uncertainty bound with matching-year World Bank exposure, or reset to
            // zero so a previous country's estimate can never leak into this one.
            if (healthEstimate && Number.isFinite(healthEstimate.rate)) {
                fillParam(
                    'dalyPerPerson',
                    healthEstimate.rate.toFixed(7),
                    `WHO lower-bound sanitation-attributable diarrhoeal DALYs (${healthEstimate.year}) ` +
                        `divided by ${Math.round(healthEstimate.exposedPopulation).toLocaleString()} people ` +
                        `without basic sanitation in matching World Bank data`,
                    'who-world-bank',
                    'WHO / World Bank'
                );
            } else {
                resetOptionalEstimate(
                    'dalyPerPerson',
                    0,
                    'Not estimated: matching WHO sanitation DALYs and World Bank exposure data were unavailable.'
                );
            }

            // 4. Update Affordability Calculation trigger (Grant Support)
            // If we have Income (GNI), checking toilets vs income might replace this logic?
            // CalculateAffordability function uses 'gdp' in 'UI.lastApiData'.
            // I should update UI.lastApiData to include 'gni'.
            UI.lastApiData = { ...data, healthEstimate };

            // Affordability is advice only; it never writes policy inputs.
            const toiletCost = parseFloat(document.getElementById('avgToiletCost').value) || 0;
            UI.calculateAffordability(data, toiletCost);

            if (missing.length > 0) {
                wbDiv.innerHTML += `<div class="tag highlight" style="margin-top:4px;">` +
                    `<strong>Country data incomplete:</strong> ${missing.join(', ')}. ` +
                    `No calculation was run; enter cited values in the blank fields and recalculate.</div>`;
                return;
            }

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

    // One advice path only (F-48, ADR-0039). A click recalculates the current
    // scenario and renders only options that ModelModule has actually simulated.
    const aiBtn = document.getElementById('aiAdvisorBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => runCalculation(true));
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

        // Bind reporting to the scenario that actually ran. Export code must not
        // reread a form that may have been edited since this calculation (F-47).
        results.inputs = { ...inputs };

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
        // A failed recalculation is no result. Do not leave a previous scenario
        // exportable under the user's newly entered assumptions (F-46).
        UI.lastResults = null;
        console.error("Model Runtime Error:", e);
        if (e && e.code === 'INVALID_INPUTS' && Array.isArray(e.validationErrors)) {
            alert("Please correct these inputs before running the model:\n\n- " +
                e.validationErrors.join("\n- "));
        } else {
            alert("Error: " + e.message);
        }
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
