/**
 * geoboundaries.js — geoBoundaries API client for the number of second-level
 * administrative units (ADM2). No DOM. See ADR-0062.
 *
 * ADM2 is not always called a district, so the unit type, the year the boundaries
 * represent and the national source are returned for display.
 */

/* eslint-disable no-unused-vars -- used by src/app.js through the shared classic-script scope. */
const GeoBoundariesModule = {
    level: 'ADM2',

    async fetchAdminUnitCount(iso3) {
        try {
            const url = `https://www.geoboundaries.org/api/current/gbOpen/${encodeURIComponent(iso3)}/${this.level}/`;
            const response = await fetch(url);
            const record = await response.json();
            const count = Number(record?.admUnitCount);
            if (!Number.isInteger(count) || count <= 0) return null;
            const canonical = record.boundaryCanonical && !/^unknown$/i.test(record.boundaryCanonical)
                ? record.boundaryCanonical : 'ADM2 unit';
            return {
                value: count,
                unitType: canonical,
                year: record.boundaryYearRepresented || 'year unavailable',
                source: record.boundarySource || 'source unavailable',
                level: this.level,
            };
        } catch (error) {
            console.error(`Error fetching geoBoundaries ${this.level}`, error);
            return null;
        }
    },
};
