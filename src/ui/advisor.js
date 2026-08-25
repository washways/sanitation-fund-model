/**
 * advisor.js — part of the S5 structural split (ADR-0033). Renders the model-tested solvency advice (F-32) computed by src/model/invariants.js's suggestSolvencyFix.
 */

Object.assign(UI, {
    /** Show what would actually close a repayment shortfall — each option model-tested. */
    showAdvice(advice) {
        const existing = document.getElementById('adviceBanner');
        if (!advice) { if (existing) existing.style.display = 'none'; return; }

        let banner = existing;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'adviceBanner';
            banner.style.padding = '0.85rem 1rem';
            banner.style.marginBottom = '1rem';
            banner.style.borderRadius = '0.5rem';
            banner.style.fontSize = '0.85rem';
            banner.style.background = '#eff6ff';
            banner.style.border = '1px solid #3b82f6';
            banner.style.color = '#1e40af';
            const anchor = document.getElementById('viabilityBanner') || document.querySelector('.top-actions');
            if (anchor) anchor.insertAdjacentElement('afterend', banner);
        }

        const money = n => '$' + Math.round(n).toLocaleString('en-US');
        if (advice.noneWork) {
            banner.innerHTML = `<strong>Repayment shortfall: ${money(advice.shortfall)}</strong>` +
                `<div style="margin-top:0.4rem;">No single parameter change tested here closes the gap. ` +
                `The fund as specified cannot repay this much senior debt; it needs more grant capital, ` +
                `less debt, or a fundamentally different cost structure.</div>`;
        } else {
            banner.innerHTML = `<strong>Repayment shortfall: ${money(advice.shortfall)}</strong> ` +
                `(${(advice.basePaidPct * 100).toFixed(1)}% repaid). Model-tested changes that improve it:` +
                '<ul style="margin:0.5rem 0 0; padding-left:1.25rem;">' +
                advice.options.map(o =>
                    `<li>${o.label} to <strong>${o.display}</strong> &rarr; ` +
                    `${(o.repaidPct * 100).toFixed(1)}% repaid` +
                    (o.fullyRepaid ? ' <em>(repaid in full)</em>' : '') +
                    `, ${o.toiletDelta >= 0 ? '+' : ''}${Math.round(o.toiletDelta).toLocaleString('en-US')} toilets</li>`
                ).join('') +
                '</ul>' +
                '<div style="margin-top:0.5rem; opacity:0.85;">Nothing has been changed. Each figure above ' +
                'comes from re-running the model with that one change.</div>';
        }
        banner.style.display = 'block';
    },
});
