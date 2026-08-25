/**
 * worldbank.js — part of the S5 structural split (ADR-0033). World Bank / countriesnow.space API client. No DOM.
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
        poverty: 'SI.POV.DDAY', // Poverty headcount ratio at $2.15 a day (2017 PPP) (% of population)
        politicalStability: 'PV.EST' // Political Stability and Absence of Violence/Terrorism (Estimate, 0-100 Rank)
    },

    async fetchData(countryCode) {
        const baseUrl = 'https://api.worldbank.org/v2/country';
        const format = 'format=json';

        const fetchIndicator = async (ind) => {
            try {
                // Fetch last 5 years (MRV=5) to handle patchy data (like Governance)
                const url = `${baseUrl}/${countryCode}/indicator/${ind}?${format}&MRV=5`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && data[1] && data[1].length > 0) {
                    // Loop through results to find the first non-null value
                    const validRecord = data[1].find(r => r.value !== null);
                    return validRecord ? validRecord.value : null;
                }
                return null;
            } catch (e) {
                console.error(`Error fetching ${ind}`, e);
                return null;
            }
        };

        const [pop, basicSan, safeSan, gdp, gni, inflation, popGrowth, lendingRate, gini, poverty, politicalStability] = await Promise.all([
            fetchIndicator(this.indicators.ruralPop),
            fetchIndicator(this.indicators.basicSanitation),
            fetchIndicator(this.indicators.safelyManaged),
            fetchIndicator(this.indicators.gdpPerCapita),
            fetchIndicator(this.indicators.gniPerCapita),
            fetchIndicator(this.indicators.inflation),
            fetchIndicator(this.indicators.popGrowth),
            fetchIndicator(this.indicators.lendingRate),
            fetchIndicator(this.indicators.gini),
            fetchIndicator(this.indicators.poverty),
            fetchIndicator(this.indicators.politicalStability)
        ]);

        return { pop, basicSan, safeSan, gdp, gni, inflation, popGrowth, lendingRate, gini, poverty, politicalStability };
    },

    async fetchStates(countryName) {
        try {
            const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ country: countryName })
            });
            const data = await res.json();
            if (data && data.data && data.data.states) {
                return data.data.states;
            }
            return [];
        } catch (e) {
            console.error("Error fetching states", e);
            return [];
        }
    }
};
