/**
 * app.js — part of the S5 structural split (ADR-0033). Controller and wiring only — the DOMContentLoaded handler, runCalculation, and final event wiring. Depends on every module above.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 1 violation in this file (`riskLabel`). Recorded, not fixed, per docs/ROADMAP.md's
 * S0 task. Run `npx eslint src/` before committing; if this file's count goes up,
 * that is a new defect, not baseline noise.
 */
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
