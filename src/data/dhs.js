/**
 * dhs.js — DHS Program API client for rural household size. No DOM. See ADR-0062.
 *
 * Indicator HC_MEMB_H_MNM is the mean number of usual household members. The model
 * needs RURAL households, so only the Residence = Rural breakdown is used, from the
 * most recent survey (DHS or MIS) that reports it.
 */

/* eslint-disable no-unused-vars -- used by src/app.js through the shared classic-script scope. */
const DhsApiModule = {
    indicator: 'HC_MEMB_H_MNM',

    /** @param dhsCode DHS country code (not always ISO2); null when the DHS has no surveys. */
    async fetchRuralHouseholdSize(dhsCode) {
        if (!dhsCode) return null;
        try {
            const url = 'https://api.dhsprogram.com/rest/dhs/data' +
                `?countryIds=${encodeURIComponent(dhsCode)}&indicatorIds=${this.indicator}` +
                '&breakdown=all&returnFields=SurveyYear,SurveyId,Value,CharacteristicCategory,CharacteristicLabel' +
                '&f=json';
            const response = await fetch(url);
            const payload = await response.json();
            const records = Array.isArray(payload?.Data) ? payload.Data : [];
            const rural = records
                .filter(record => record.CharacteristicCategory === 'Residence'
                    && record.CharacteristicLabel === 'Rural'
                    && Number.isFinite(Number(record.Value)) && Number(record.Value) > 0
                    && Number.isFinite(Number(record.SurveyYear)))
                .sort((a, b) => Number(b.SurveyYear) - Number(a.SurveyYear));
            if (rural.length === 0) return null;
            const record = rural[0];
            return {
                value: Number(record.Value),
                year: Number(record.SurveyYear),
                surveyId: record.SurveyId || null,
                indicator: this.indicator,
            };
        } catch (error) {
            console.error(`Error fetching DHS ${this.indicator}`, error);
            return null;
        }
    },
};
