/**
 * who.js — WHO Global Health Observatory client for sanitation-attributable DALYs.
 * No DOM. See ADR-0049.
 */

/* eslint-disable no-unused-vars -- used by src/app.js through the shared classic-script scope. */
const WhoApiModule = {
    indicator: 'WSH_30_SAN',

    async fetchSanitationDalys(countryCode) {
        try {
            const filter = encodeURIComponent(
                `SpatialDim eq '${countryCode}' and Dim1 eq 'SEX_BTSX' and Dim2 eq 'AGEGROUP_YEARSALL'`
            );
            const url = `https://ghoapi.azureedge.net/api/${this.indicator}?$filter=${filter}`;
            const response = await fetch(url);
            const payload = await response.json();
            const records = Array.isArray(payload?.value) ? payload.value : [];
            const finiteValue = value => value !== null && value !== '' && Number.isFinite(Number(value));
            const valid = records
                .filter(record => finiteValue(record.NumericValue)
                    && finiteValue(record.Low)
                    && finiteValue(record.TimeDim))
                .sort((a, b) => Number(b.TimeDim) - Number(a.TimeDim));
            if (valid.length === 0) return null;

            const record = valid[0];
            const central = Number(record.NumericValue);
            const low = Number(record.Low);
            const high = Number(record.High);
            return {
                value: central,
                low,
                high: finiteValue(record.High) ? high : central,
                year: Number(record.TimeDim),
                indicator: this.indicator,
            };
        } catch (error) {
            console.error(`Error fetching WHO ${this.indicator}`, error);
            return null;
        }
    },
};
