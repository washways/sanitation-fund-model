/**
 * countries.js — part of the S5 structural split (ADR-0033). The LDC country list the selector offers.
 * `dhs` is the DHS Program country code (not always ISO2), or null where the DHS has
 * no surveys (ADR-0062).
 */

/* eslint-disable no-unused-vars --
 * Same reason as ApiModule in src/data/worldbank.js: used only from src/app.js,
 * across the shared global scope the S5 split (ADR-0033) preserves. Not F-19 baseline.
 */
const LDC_COUNTRIES = [
    { name: "Afghanistan", code: "AFG", iso2: "AF", dhs: "AF" },
    { name: "Angola", code: "AGO", iso2: "AO", dhs: "AO" },
    { name: "Bangladesh", code: "BGD", iso2: "BD", dhs: "BD" },
    { name: "Benin", code: "BEN", iso2: "BJ", dhs: "BJ" },
    { name: "Burkina Faso", code: "BFA", iso2: "BF", dhs: "BF" },
    { name: "Burundi", code: "BDI", iso2: "BI", dhs: "BU" },
    { name: "Cambodia", code: "KHM", iso2: "KH", dhs: "KH" },
    { name: "Central African Republic", code: "CAF", iso2: "CF", dhs: "CF" },
    { name: "Chad", code: "TCD", iso2: "TD", dhs: "TD" },
    { name: "Comoros", code: "COM", iso2: "KM", dhs: "KM" },
    { name: "Congo, Dem. Rep.", code: "COD", iso2: "CD", dhs: "CD" },
    { name: "Djibouti", code: "DJI", iso2: "DJ", dhs: null },
    { name: "Eritrea", code: "ERI", iso2: "ER", dhs: "ER" },
    { name: "Ethiopia", code: "ETH", iso2: "ET", dhs: "ET" },
    { name: "Gambia, The", code: "GMB", iso2: "GM", dhs: "GM" },
    { name: "Guinea", code: "GIN", iso2: "GN", dhs: "GN" },
    { name: "Guinea-Bissau", code: "GNB", iso2: "GW", dhs: null },
    { name: "Haiti", code: "HTI", iso2: "HT", dhs: "HT" },
    { name: "Kiribati", code: "KIR", iso2: "KI", dhs: null },
    { name: "Lao PDR", code: "LAO", iso2: "LA", dhs: "LA" },
    { name: "Lesotho", code: "LSO", iso2: "LS", dhs: "LS" },
    { name: "Liberia", code: "LBR", iso2: "LR", dhs: "LB" },
    { name: "Madagascar", code: "MDG", iso2: "MG", dhs: "MD" },
    { name: "Malawi", code: "MWI", iso2: "MW", dhs: "MW" },
    { name: "Mali", code: "MLI", iso2: "ML", dhs: "ML" },
    { name: "Mauritania", code: "MRT", iso2: "MR", dhs: "MR" },
    { name: "Mozambique", code: "MOZ", iso2: "MZ", dhs: "MZ" },
    { name: "Myanmar", code: "MMR", iso2: "MM", dhs: "MM" },
    { name: "Nepal", code: "NPL", iso2: "NP", dhs: "NP" },
    { name: "Niger", code: "NER", iso2: "NE", dhs: "NI" },
    { name: "Rwanda", code: "RWA", iso2: "RW", dhs: "RW" },
    { name: "Senegal", code: "SEN", iso2: "SN", dhs: "SN" },
    { name: "Sierra Leone", code: "SLE", iso2: "SL", dhs: "SL" },
    { name: "Solomon Islands", code: "SLB", iso2: "SB", dhs: null },
    { name: "Somalia", code: "SOM", iso2: "SO", dhs: null },
    { name: "South Sudan", code: "SSD", iso2: "SS", dhs: null },
    { name: "Sudan", code: "SDN", iso2: "SD", dhs: "SD" },
    { name: "Timor-Leste", code: "TLS", iso2: "TL", dhs: "TL" },
    { name: "Togo", code: "TGO", iso2: "TG", dhs: "TG" },
    { name: "Tuvalu", code: "TUV", iso2: "TV", dhs: null },
    { name: "Uganda", code: "UGA", iso2: "UG", dhs: "UG" },
    { name: "Tanzania", code: "TZA", iso2: "TZ", dhs: "TZ" },
    { name: "Yemen, Rep.", code: "YEM", iso2: "YE", dhs: "YE" },
    { name: "Zambia", code: "ZMB", iso2: "ZM", dhs: "ZM" }
];
