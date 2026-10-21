/**
 * sensitivity.js — evidence-bounded one-at-a-time analysis (ADR-0045).
 * Pure: no DOM, files, network, timestamps, or mutation of caller-owned values.
 */

Object.assign(ModelModule, {
    _sensitivitySnapshot(result, inputs) {
        const s = result.series;
        const k = result.kpis;
        const viability = this.checkViability(s, inputs, k);
        return {
            netAssets: k.financials.netAssets,
            cashEnd: k.financials.cashEnd,
            minimumCash: Math.min(...s.dataMonthlyCashBalance),
            toilets: k.reach.toilets,
            investorRepaidPct: k.financials.investorRepaidPct,
            sroi: k.value.sroi,
            viable: viability.ok
        };
    },

    /**
     * Run one-at-a-time low/base/high comparisons over 1–8 documented ranges.
     *
     * `specification.parameters` entries are:
     * `{ id, low, high, source }`. Bounds are model units (rates are decimals),
     * must bracket the base value, and must pass the normal input validator.
     */
    runSensitivity(inputs, specification) {
        const supportedMetrics = [
            'netAssets', 'cashEnd', 'minimumCash', 'toilets',
            'investorRepaidPct', 'sroi'
        ];
        const metric = specification && specification.metric;
        const parameters = specification && specification.parameters;
        const errors = [];
        const fail = () => ({
            ok: false,
            metric: supportedMetrics.includes(metric) ? metric : null,
            baseline: null,
            results: [],
            errors
        });

        if (!supportedMetrics.includes(metric)) {
            errors.push(`Unsupported sensitivity metric "${metric}". Use one of: ${supportedMetrics.join(', ')}.`);
        }
        if (!Array.isArray(parameters) || parameters.length === 0) {
            errors.push('Sensitivity requires at least one parameter range.');
        } else if (parameters.length > 8) {
            errors.push('Sensitivity accepts at most eight parameter ranges.');
        }

        const baseValidation = this.validateInputs(inputs || {});
        for (const error of baseValidation) errors.push(`Base scenario: ${error}`);

        const seen = new Set();
        if (Array.isArray(parameters)) {
            for (const [index, range] of parameters.entries()) {
                const prefix = `Range ${index + 1}`;
                if (!range || typeof range !== 'object') {
                    errors.push(`${prefix} must be an object.`);
                    continue;
                }
                const id = range.id;
                if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(inputs || {}, id)
                    || !Number.isFinite(inputs[id])) {
                    errors.push(`${prefix} has unknown or non-numeric parameter "${id}".`);
                    continue;
                }
                if (seen.has(id)) errors.push(`${prefix} duplicates parameter "${id}".`);
                seen.add(id);

                if (typeof range.source !== 'string' || range.source.trim() === '') {
                    errors.push(`${prefix} (${id}) requires a non-empty provenance source.`);
                }
                if (!Number.isFinite(range.low) || !Number.isFinite(range.high)) {
                    errors.push(`${prefix} (${id}) low and high values must be finite numbers.`);
                    continue;
                }
                if (!(range.low < range.high)) {
                    errors.push(`${prefix} (${id}) low must be less than high.`);
                }
                if (!(range.low <= inputs[id] && inputs[id] <= range.high)) {
                    errors.push(`${prefix} (${id}) must bracket the base value ${inputs[id]}.`);
                }

                for (const [boundName, value] of [['low', range.low], ['high', range.high]]) {
                    if (!Number.isFinite(value)) continue;
                    const scenarioErrors = this.validateInputs({ ...inputs, [id]: value });
                    for (const error of scenarioErrors) {
                        errors.push(`${prefix} (${id}) ${boundName}: ${error}`);
                    }
                }
            }
        }

        if (errors.length > 0) return fail();

        const baseInputs = structuredClone(inputs);
        baseInputs.enableBreakEvenSolver = false;
        baseInputs.verify = false;
        const baselineResult = this.calculate(baseInputs);
        const baseline = this._sensitivitySnapshot(baselineResult, baseInputs);

        const snapshotAt = (id, value) => {
            if (value === inputs[id]) return { ...baseline };
            const scenario = { ...baseInputs, [id]: value };
            return this._sensitivitySnapshot(this.calculate(scenario), scenario);
        };
        const deltasFromBase = metrics => Object.fromEntries(
            Object.entries(metrics)
                .filter(([, value]) => typeof value === 'number')
                .map(([key, value]) => [key, value - baseline[key]])
        );

        const results = parameters.map(range => {
            const lowMetrics = snapshotAt(range.id, range.low);
            const highMetrics = snapshotAt(range.id, range.high);
            return {
                parameter: range.id,
                source: range.source.trim(),
                low: {
                    value: range.low,
                    metrics: lowMetrics,
                    deltaFromBase: deltasFromBase(lowMetrics)
                },
                base: {
                    value: inputs[range.id],
                    metrics: { ...baseline }
                },
                high: {
                    value: range.high,
                    metrics: highMetrics,
                    deltaFromBase: deltasFromBase(highMetrics)
                },
                swing: Math.abs(highMetrics[metric] - lowMetrics[metric])
            };
        }).sort((a, b) => b.swing - a.swing || a.parameter.localeCompare(b.parameter));

        return {
            ok: true,
            metric,
            baseline,
            results,
            errors: []
        };
    }
});
