/**
 * kpis.js — part of the S5 structural split (ADR-0033). Renders KPI numbers, the integrity/viability banners, and the programme summary card.
 */

/* eslint-disable no-unused-vars --
 * F-19 baseline (docs/ANALYSIS.md), carried over from the pre-S5 single-file count —
 * 2 violations in this file (`fmtValMoney`, `gapClass`). Recorded, not fixed, per
 * docs/ROADMAP.md's S0 task. Run `npx eslint src/` before committing; if this file's
 * count goes up, that is a new defect, not baseline noise.
 */
Object.assign(UI, {
    updateKPIs(results) {
        if (!results) return;

        const inputs = UI.getInputs();
        const k = results.kpis;
        if (!k) return;

        // kpis structure (F-14 / ADR-0028): { reach, impact, portfolio, financials,
        // sustainability, value } — six flat, documented groups. computeKPIs returns
        // this shape directly; nothing here mutates it any more.

        // Helpers
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };
        const fmtMoney = (n) => '$' + (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
        const fmtVal = (num) => (num || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
        const fmtValMoney = (count, val) => {
            if (val !== undefined) return `${fmtVal(count)} (${fmtMoney(val)})`;
            return fmtVal(count);
        };
        const fmtPct = (val) => ((val || 0) * 100).toFixed(1) + '%';
        const fmtNum = (val) => (val || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });

        // Show what the time-value factor actually resolves to, so the number in the
        // SROI is visible rather than implied (R-8.6).
        const hourHelp = document.getElementById('hour-value-help');
        if (hourHelp && k.impact && k.impact.hourValueUsd !== undefined) {
            hourHelp.innerText = `= $${k.impact.hourValueUsd.toFixed(3)}/hour, from ` +
                `$${(inputs.avgAnnualIncome || 0).toLocaleString('en-US')} income over a 2,080-hour year.`;
        }

        // Grant-fund runway (F-30). Grant Support % paces subsidy; it does not set the
        // total. This makes the actual constraint — how long the grant capital lasts —
        // visible next to the dial, instead of only discoverable by reading the code.
        const runwayHelp = document.getElementById('grant-runway-help');
        if (runwayHelp && k.sustainability) {
            const exhaustedMonth = k.sustainability.grantExhaustedMonth;
            runwayHelp.innerText = exhaustedMonth
                ? `Grant capital runs out around month ${exhaustedMonth} at this pace — total subsidy is set by ` +
                  `Initial Grant Capital, not by this %.`
                : `Grant capital lasts the full run at this pace.`;
        }

        try {
            // --- Reach Card ---
            setText('sum-toilets', fmtVal(k.reach.toilets));
            setText('sum-toilets-loan-count', fmtVal(k.reach.loanToilets));
            setText('sum-toilets-loan-val', fmtMoney(k.portfolio.disbursed));

            setText('sum-toilets-grant-count', fmtVal(k.reach.grantToilets));
            setText('sum-toilets-grant-val', fmtMoney(k.financials.grantsDisbursed));

            setText('sum-households', fmtVal(k.reach.toilets));
            setText('sum-people', fmtVal(k.reach.people));
            setText('sum-mes', fmtVal(k.reach.mes));

            // New Phase 22: SDG6
            if (k.reach.sdg6Gap !== undefined) {
                setText('sum-sdg6', fmtPct(k.reach.sdg6Gap));
            }
            setText('sum-constraint', k.reach.dominantConstraint || '--');


            // --- Impact Card ---
            if (k.impact) {
                setText('sum-dalys', fmtVal(k.impact.dalys));
                setText('sum-val-dalys', fmtMoney(k.impact.valDalys));
                setText('sum-carbon', inputs.co2PerToilet > 0 ? `${fmtNum(k.impact.carbon)} tCO2e` : 'Not estimated');
                setText('sum-val-carbon', inputs.co2PerToilet > 0 ? fmtMoney(k.impact.valCarbon) : 'Project factor required');
                setText('sum-jobs', fmtVal(k.reach.jobs)); // Jobs is in Reach now
            }

            // --- Sustainability Scorecard ---

            // Liquidity / Export Stats Population
            // Loan ledger only (F-66, ADR-0057): grant cash cannot pay operations.
            const minCash = k.sustainability.minLoanCash || 0;
            const insolvencyMonths = k.sustainability.monthsInsolvent;
            const isInsolvent = minCash < 0;

            // Store Summary Stats for Export (Already standardized in computeKPIs, but useful for Reference)
            UI.lastSummaryStats = {
                totalLatrines: k.reach.toilets,
                loanToilets: k.reach.loanToilets,
                grantToilets: k.reach.grantToilets,
                households: k.reach.toilets, // Assuming households = toilets for now
                people: k.reach.people,
                mes: k.reach.mes,
                dalys: k.impact ? k.impact.dalys.toFixed(0) : 0,
                economicValue: k.impact ? k.impact.valDalys.toFixed(0) : 0,
                carbon: k.impact ? k.impact.carbon.toFixed(1) : 0,
                jobs: k.reach ? k.reach.jobs.toFixed(0) : 0,
                ossRatio: k.sustainability.oss,
                minCash: minCash,
                insolvencyMonths: insolvencyMonths,
                fundBalance: k.financials.cashEnd
            };

            // OSS Display
            // F-69 / ADR-0059: render the ratio itself. null means there is no
            // operating cost, so the ratio is undefined. Insolvency is reported by its
            // own rows and banner; it must not overwrite OSS with a fake 0% (R-10.3).
            const ossValue = k.sustainability.oss;
            const ossEl = document.getElementById('sus-oss-ratio');
            if (ossEl) {
                if (ossValue === null || ossValue === undefined) {
                    ossEl.innerText = "n/a (no operating cost)";
                    ossEl.style.color = "inherit";
                } else {
                    const oss = ossValue * 100;
                    ossEl.innerText = oss.toFixed(1) + '%';
                    ossEl.style.color = oss >= 100 ? '#22c55e' : '#ef4444';
                }
                ossEl.title = isInsolvent
                    ? "The loan ledger was overdrawn during the run; see Months Insolvent."
                    : "";
            }

            setText('sus-depletion', k.sustainability.depletionYear || "Sustainable");

            // Break-even rate / max sustainable grant — both solvers now return
            // { ok, value, reason } (ADR-0032, F-27), so "no feasible answer" is
            // distinguishable from "the answer is zero" instead of both showing as
            // the same number.
            const be = results.breakEvenRate;
            setText('sus-breakeven-rate', be && be.ok ? (be.value * 100).toFixed(1) + '%' : 'N/A');

            // F-37: this used to skip the *100 conversion CSV export already applied,
            // so a real 99.9% max-sustainable-grant answer displayed here as "1.0%".
            const mg = results.maxGrantPct;
            setText('sus-max-grant', mg && mg.ok ? (mg.value * 100).toFixed(1) + '%' : 'N/A');

            // --- Liquidity ---
            setText('sum-min-cash', fmtMoney(minCash));
            const mcEl = document.getElementById('sum-min-cash');
            if (mcEl) mcEl.style.color = minCash < 0 ? '#ef4444' : 'inherit';
            setText('sum-insolvency', insolvencyMonths + " Mo");

            // --- Fund Balance (Capital Card) ---
            setText('sum-balance', fmtMoney(k.financials.cashEnd));
            setText('sum-capital-repaid', fmtMoney(k.financials.investorRepaid || 0));

            // Additional Liquidity / Sustainability Context
            setText('sum-repaid', fmtMoney(k.financials.investorRepaid || 0));
            setText('sum-repaid-pct', fmtPct(k.financials.investorRepaidPct || 0));
            setText('sum-preserved', (k.financials.grantEquityMultiple || 0).toFixed(2) + 'x');
            setText('sum-health', fmtPct(k.value.capitalPreservation || 0));
            setText('sum-sufficiency', fmtPct(k.sustainability.fss || 0));

            const runway = k.sustainability.opsRunway || 0;
            const runwayText = runway > 20 ? "Sustainable (>20y)" : fmtNum(runway) + " Years";
            setText('sum-ops-coverage', runwayText);

            // Unit Economics
            setText('sum-cost-per-latrine', fmtMoney(k.sustainability.costPerLatrine || 0));
            setText('sum-economic-cost', fmtMoney(k.value.economicCostPerLatrine || 0));
            setText('sum-effective-cost', fmtMoney(k.sustainability.effectiveCostPerLatrine || 0));

            // Legacy/Other
            setText('sum-leverage', fmtNum(k.financials.leverage || 0) + 'x');
            setText('sum-sroi', fmtNum(k.value.grossSocialValueMultiple || 0) + 'x');

        } catch (e) {
            console.error("ERROR IN UPDATEKPIS:", e);
        }
    },

    // Integrity UI
    showIntegrityError(errors) {
        let banner = document.getElementById('integrityBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'integrityBanner';
            banner.style.background = '#fee2e2';
            banner.style.border = '1px solid #ef4444';
            banner.style.color = '#b91c1c';
            banner.style.padding = '1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.display = 'none';
            // Insert after top-actions
            const parent = document.querySelector('.top-actions');
            if (parent) parent.insertAdjacentElement('afterend', banner);
        }

        banner.innerHTML = `<strong>⚠️ Model Integrity Check Failed</strong><ul style="margin-top:0.5rem; padding-left:1.5rem;">` +
            errors.map(e => `<li>${e}</li>`).join('') + `</ul>`;
        banner.style.display = 'block';
    },

    /**
     * Render the fund-viability verdict ON SCREEN (R-10.3, finding F-29).
     *
     * The model used to report insolvency and investor default via console.warn, where
     * no user would ever see them, while printing "Model Integrity Verified" — a green
     * tick on a failing fund. These are two different claims and they get two different
     * banners: integrity failures are defects in the model, viability failures are
     * findings about the scenario and are a legitimate result.
     */
    showViability(viability) {
        let banner = document.getElementById('viabilityBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'viabilityBanner';
            banner.style.padding = '0.85rem 1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.fontSize = '0.85rem';
            banner.style.lineHeight = '1.5';
            const parent = document.querySelector('.top-actions') || document.body;
            if (!parent) return;   // no DOM to render into (headless test harness)
            parent.insertAdjacentElement(parent === document.body ? 'afterbegin' : 'afterend', banner);
        }

        if (viability.ok) {
            banner.style.background = '#dcfce7';
            banner.style.border = '1px solid #16a34a';
            banner.style.color = '#166534';
            banner.innerHTML = '<strong>&#10003; Fund is viable</strong> &mdash; stays solvent, repays senior debt in full, and covers its operating costs.';
        } else {
            banner.style.background = '#fef3c7';
            banner.style.border = '1px solid #d97706';
            banner.style.color = '#92400e';
            banner.innerHTML =
                '<strong>&#9888; This scenario does not stand up</strong>' +
                '<ul style="margin:0.5rem 0 0; padding-left:1.25rem;">' +
                viability.issues.map(i => `<li>${i.text}</li>`).join('') +
                '</ul>' +
                '<div style="margin-top:0.5rem; opacity:0.85;">This is the model reporting a result, not an error. ' +
                'Adjust the assumptions, or accept that the fund as specified needs more subsidy.</div>';
        }
        banner.style.display = 'block';
    },

    clearIntegrityError() {
        const banner = document.getElementById('integrityBanner');
        if (banner) banner.style.display = 'none';
    },

    /**
     * Withdraw every rendered result (F-73). Used whenever no valid calculation backs
     * the form: a failed or incomplete country load, or invalid inputs. Nulling
     * lastResults alone blocked the export but left the dashboard, charts and verdict
     * banners showing the previous scenario's numbers.
     */
    clearResults(reason) {
        UI.lastResults = null;
        const tab = document.getElementById('modelTab');
        if (tab) tab.classList.add('no-results');
        const notice = document.getElementById('noResultsNotice');
        if (notice) {
            notice.innerText = `No results are shown. ${reason}`;
            notice.hidden = false;
        }
        if (typeof chartInstances === 'object') {
            for (const key of Object.keys(chartInstances)) {
                if (chartInstances[key]) chartInstances[key].destroy();
                delete chartInstances[key];
            }
        }
        const tbody = document.getElementById('monthlyDataBody');
        if (tbody) tbody.innerHTML = '';
        for (const id of ['viabilityBanner', 'adviceBanner', 'integrityBanner']) {
            const banner = document.getElementById(id);
            if (banner) banner.style.display = 'none';
        }
    },

    /** Undo clearResults once a valid calculation has rendered. */
    showResults() {
        const tab = document.getElementById('modelTab');
        if (tab) tab.classList.remove('no-results');
        const notice = document.getElementById('noResultsNotice');
        if (notice) {
            notice.innerText = '';
            notice.hidden = true;
        }
    },
});
