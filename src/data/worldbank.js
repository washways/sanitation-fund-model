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
        basicSanitation: 'SH.STA.BASS.RU.ZS',
        safelyManaged: 'SH.STA.SMSS.RU.ZS',
        gdpPerCapita: 'NY.GDP.PCAP.CD',
        gniPerCapita: 'NY.GNP.PCAP.CD', // Added GNI
        inflation: 'FP.CPI.TOTL.ZG',
        popGrowth: 'SP.POP.GROW',
        lendingRate: 'FR.INR.LEND',
        gini: 'SI.POV.GINI',
        poverty: 'SI.POV.DDAY'
    },

    async fetchData(countryCode) {
        const baseUrl = 'https://api.worldbank.org/v2/country';
        const format = 'format=json';

        const fetchIndicator = async (ind) => {
            try {
                // `mrnev=1` means the latest non-empty observation. `MRV=5`, used
                // previously, means five calendar periods and silently dropped older
                // but still latest poverty/Gini observations in countries with patchy
                // series. Keep the record's year and API label for provenance.
                const url = `${baseUrl}/${countryCode}/indicator/${ind}?${format}&mrnev=1`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && data[1] && data[1].length > 0) {
                    const validRecord = data[1].find(r => r.value !== null);
                    return validRecord ? {
                        value: validRecord.value,
                        year: validRecord.date || null,
                        label: validRecord.indicator?.value || ind
                    } : null;
                }
                return null;
            } catch (e) {
                console.error(`Error fetching ${ind}`, e);
                return null;
            }
        };

        const [popRecord, basicSanRecord, safeSanRecord, gdpRecord, gniRecord,
            inflationRecord, popGrowthRecord, lendingRateRecord, giniRecord, povertyRecord] = await Promise.all([
            fetchIndicator(this.indicators.ruralPop),
            fetchIndicator(this.indicators.basicSanitation),
            fetchIndicator(this.indicators.safelyManaged),
            fetchIndicator(this.indicators.gdpPerCapita),
            fetchIndicator(this.indicators.gniPerCapita),
            fetchIndicator(this.indicators.inflation),
            fetchIndicator(this.indicators.popGrowth),
            fetchIndicator(this.indicators.lendingRate),
            fetchIndicator(this.indicators.gini),
            fetchIndicator(this.indicators.poverty)
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
    }
};
