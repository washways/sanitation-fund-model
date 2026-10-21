/**
 * worldbank.js — World Bank indicator client. No DOM.
 */

/* eslint-disable no-unused-vars --
 * ApiModule is declared here and used only from other src/ files (data/, ui/, app.js),
 * which share this global scope at runtime (see tools/app-source.js and
 * eslint.config.js's `globals`). no-unused-vars only sees within one file, so it can't
 * see that cross-file usage — this is a structural artifact of the S5 split
 * (ADR-0033), not a real unused variable. Not part of the F-19 baseline.
 */
// --- API Module ---
const ApiModule = {
    indicators: {
        ruralPop: 'SP.RUR.TOTL',
        totalPop: 'SP.POP.TOTL',
        basicSanitation: 'SH.STA.BASS.RU.ZS',
        basicSanitationTotal: 'SH.STA.BASS.ZS',
        safelyManaged: 'SH.STA.SMSS.RU.ZS',
        gdpPerCapita: 'NY.GDP.PCAP.CD',
        gniPerCapita: 'NY.GNP.PCAP.CD', // Added GNI
        inflation: 'FP.CPI.TOTL.ZG',
        popGrowth: 'SP.POP.GROW',
        lendingRate: 'FR.INR.LEND',
        gini: 'SI.POV.GINI',
        poverty: 'SI.POV.DDAY'
    },

    async fetchIndicator(countryCode, indicator, query = 'mrnev=1') {
        const baseUrl = 'https://api.worldbank.org/v2/country';
        const format = 'format=json';
        try {
            // `mrnev=1` means the latest non-empty observation. Exact-year queries are
            // used when an external dated numerator needs a matching denominator.
            const url = `${baseUrl}/${countryCode}/indicator/${indicator}?${format}&${query}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data && data[1] && data[1].length > 0) {
                const validRecord = data[1].find(r => r.value !== null);
                return validRecord ? {
                    value: validRecord.value,
                    year: validRecord.date || null,
                    label: validRecord.indicator?.value || indicator
                } : null;
            }
            return null;
        } catch (e) {
            console.error(`Error fetching ${indicator}`, e);
            return null;
        }
    },

    async fetchData(countryCode) {

        const [popRecord, basicSanRecord, safeSanRecord, gdpRecord, gniRecord,
            inflationRecord, popGrowthRecord, lendingRateRecord, giniRecord, povertyRecord] = await Promise.all([
            this.fetchIndicator(countryCode, this.indicators.ruralPop),
            this.fetchIndicator(countryCode, this.indicators.basicSanitation),
            this.fetchIndicator(countryCode, this.indicators.safelyManaged),
            this.fetchIndicator(countryCode, this.indicators.gdpPerCapita),
            this.fetchIndicator(countryCode, this.indicators.gniPerCapita),
            this.fetchIndicator(countryCode, this.indicators.inflation),
            this.fetchIndicator(countryCode, this.indicators.popGrowth),
            this.fetchIndicator(countryCode, this.indicators.lendingRate),
            this.fetchIndicator(countryCode, this.indicators.gini),
            this.fetchIndicator(countryCode, this.indicators.poverty)
        ]);

        const records = {
            pop: popRecord,
            basicSan: basicSanRecord,
            safeSan: safeSanRecord,
            gdp: gdpRecord,
            gni: gniRecord,
            inflation: inflationRecord,
            popGrowth: popGrowthRecord,
            lendingRate: lendingRateRecord,
            gini: giniRecord,
            poverty: povertyRecord
        };
        const value = key => records[key]?.value ?? null;
        return {
            pop: value('pop'),
            basicSan: value('basicSan'),
            safeSan: value('safeSan'),
            gdp: value('gdp'),
            gni: value('gni'),
            inflation: value('inflation'),
            popGrowth: value('popGrowth'),
            lendingRate: value('lendingRate'),
            gini: value('gini'),
            poverty: value('poverty'),
            meta: records
        };
    },

    async fetchSanitationExposure(countryCode, year) {
        if (!Number.isInteger(Number(year))) return null;
        const query = `date=${Number(year)}`;
        const [population, basicSanitation] = await Promise.all([
            this.fetchIndicator(countryCode, this.indicators.totalPop, query),
            this.fetchIndicator(countryCode, this.indicators.basicSanitationTotal, query),
        ]);
        if (!population || !basicSanitation) return null;
        return { population, basicSanitation };
    }
};
