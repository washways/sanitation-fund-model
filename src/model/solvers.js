/**
 * solvers.js — part of the S5 structural split (ADR-0033). Break-even rate / max sustainable grant (ADR-0032, F-27).
 */

Object.assign(ModelModule, {
    // --- Numeric Solver for Break-Even Interest ---
    /**
     * Grid-then-bisect extremum finder shared by both solvers (ADR-0032, F-27).
     *
     * Naive bisection assumes the objective is monotone in the swept parameter. It
     * is not: netAssets(loanInterestRate) has been measured to fall on 14 of 73
     * upward steps in a capital-tight regime (docs/ANALYSIS.md F-27). Bisecting
     * blindly there can converge on a value that is not the answer, silently.
     *
     * Fix: evaluate a coarse grid across the full range, and take the true
     * extremum found ACROSS THE WHOLE GRID (lowest feasible x for 'min', highest
     * for 'max') — not the first sign change scanning in one direction. That is
     * correct regardless of monotonicity or however many separate feasible
     * pockets exist; it only needs the grid to be fine enough to find one.
     * Bisection then refines just the one grid cell adjacent to that extremum,
     * where assuming local monotonicity is far safer than assuming it globally.
     *
     * Returns `{ ok, value, reason }`. `ok: false` means no feasible point was
     * found anywhere in range — reported, not returned as a silent 0 or null a
     * caller might mistake for "the answer is zero" (the old solveMaxGrant did
     * exactly that).
     */
    _solveGridBisect({ evaluate, low, high, gridSteps, bisectIterations, extremum, noneFoundReason }) {
        const points = [];
        for (let i = 0; i <= gridSteps; i++) {
            const x = low + (high - low) * (i / gridSteps);
            points.push({ x, feasible: evaluate(x) });
        }

        const feasible = points.filter(p => p.feasible);
        if (feasible.length === 0) {
            return { ok: false, value: null, reason: noneFoundReason };
        }
        const best = extremum === 'min'
            ? feasible.reduce((a, b) => (b.x < a.x ? b : a))
            : feasible.reduce((a, b) => (b.x > a.x ? b : a));

        // Refine within the one grid cell adjacent to `best`, on its infeasible
        // side — the only place a more precise extremum can be. Nothing to refine
        // if `best` already sits at the boundary of the search range.
        const step = (high - low) / gridSteps;
        let lo, hi;
        if (extremum === 'min') {
            lo = best.x - step; hi = best.x; // lo is infeasible (or below range), hi is feasible
            if (lo < low - 1e-9) return { ok: true, value: best.x, reason: null };
        } else {
            lo = best.x; hi = best.x + step; // lo is feasible, hi is infeasible (or above range)
            if (hi > high + 1e-9) return { ok: true, value: best.x, reason: null };
        }

        for (let i = 0; i < bisectIterations; i++) {
            const mid = (lo + hi) / 2;
            const midFeasible = evaluate(mid);
            if (extremum === 'min') {
                if (midFeasible) hi = mid; else lo = mid;
            } else {
                if (midFeasible) lo = mid; else hi = mid;
            }
        }
        return { ok: true, value: extremum === 'min' ? hi : lo, reason: null };
    },

    /** Lowest household interest rate (0%-150%) at which netAssets >= 0. */
    solveBreakEven(inputs) {
        // Sub-simulations: no recursion into the solvers, and no verification noise.
        // These are separate flags — overloading one to mean both was finding F-11.
        const simInputs = structuredClone(inputs);
        simInputs.enableBreakEvenSolver = false;
        simInputs.verify = false;

        return this._solveGridBisect({
            evaluate: (rate) => {
                simInputs.loanInterestRate = rate;
                return this.calculate(simInputs).kpis.financials.netAssets >= 0;
            },
            low: 0, high: 1.50,
            gridSteps: 12, bisectIterations: 10,
            extremum: 'min',
            noneFoundReason: 'no interest rate up to 150% keeps net assets non-negative',
        });
    },

    /** Highest grant-support share (0%-100%) at which netAssets >= 0. */
    solveMaxGrant(inputs) {
        const simInputs = structuredClone(inputs);
        simInputs.enableBreakEvenSolver = false;
        simInputs.verify = false;

        return this._solveGridBisect({
            evaluate: (pct) => {
                simInputs.grantSupportPct = pct;
                return this.calculate(simInputs).kpis.financials.netAssets >= 0;
            },
            low: 0, high: 1.0,
            gridSteps: 12, bisectIterations: 10,
            extremum: 'max',
            noneFoundReason: 'no grant support % up to 100% keeps net assets non-negative',
        });
    },
});
