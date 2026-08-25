/**
 * countries.js — part of the S5 structural split (ADR-0033). The LDC country list the selector offers.
 */

/* eslint-disable no-unused-vars --
 * Same reason as ApiModule in src/data/worldbank.js: used only from src/app.js,
 * across the shared global scope the S5 split (ADR-0033) preserves. Not F-19 baseline.
 */
const LDC_COUNTRIES = [
    { name: "Afghanistan", code: "AFG", iso2: "AF" },
    { name: "Angola", code: "AGO", iso2: "AO" },
    { name: "Bangladesh", code: "BGD", iso2: "BD" },
    { name: "Benin", code: "BEN", iso2: "BJ" },
    { name: "Burkina Faso", code: "BFA", iso2: "BF" },
    { name: "Burundi", code: "BDI", iso2: "BI" },
    { name: "Cambodia", code: "KHM", iso2: "KH" },
    { name: "Central African Republic", code: "CAF", iso2: "CF" },
    { name: "Chad", code: "TCD", iso2: "TD" },
    { name: "Comoros", code: "COM", iso2: "KM" },
    { name: "Congo, Dem. Rep.", code: "COD", iso2: "CD" },
    { name: "Djibouti", code: "DJI", iso2: "DJ" },
    { name: "Eritrea", code: "ERI", iso2: "ER" },
    { name: "Ethiopia", code: "ETH", iso2: "ET" },
    { name: "Gambia, The", code: "GMB", iso2: "GM" },
    { name: "Guinea", code: "GIN", iso2: "GN" },
    { name: "Guinea-Bissau", code: "GNB", iso2: "GW" },
    { name: "Haiti", code: "HTI", iso2: "HT" },
    { name: "Kiribati", code: "KIR", iso2: "KI" },
    { name: "Lao PDR", code: "LAO", iso2: "LA" },
    { name: "Lesotho", code: "LSO", iso2: "LS" },
    { name: "Liberia", code: "LBR", iso2: "LR" },
    { name: "Madagascar", code: "MDG", iso2: "MG" },
    { name: "Malawi", code: "MWI", iso2: "MW" },
    { name: "Mali", code: "MLI", iso2: "ML" },
    { name: "Mauritania", code: "MRT", iso2: "MR" },
    { name: "Mozambique", code: "MOZ", iso2: "MZ" },
    { name: "Myanmar", code: "MMR", iso2: "MM" },
    { name: "Nepal", code: "NPL", iso2: "NP" },
    { name: "Niger", code: "NER", iso2: "NE" },
    { name: "Rwanda", code: "RWA", iso2: "RW" },
    { name: "Senegal", code: "SEN", iso2: "SN" },
    { name: "Sierra Leone", code: "SLE", iso2: "SL" },
    { name: "Solomon Islands", code: "SLB", iso2: "SB" },
    { name: "Somalia", code: "SOM", iso2: "SO" },
    { name: "South Sudan", code: "SSD", iso2: "SS" },
    { name: "Sudan", code: "SDN", iso2: "SD" },
    { name: "Timor-Leste", code: "TLS", iso2: "TL" },
    { name: "Togo", code: "TGO", iso2: "TG" },
    { name: "Tuvalu", code: "TUV", iso2: "TV" },
    { name: "Uganda", code: "UGA", iso2: "UG" },
    { name: "Tanzania", code: "TZA", iso2: "TZ" },
    { name: "Yemen, Rep.", code: "YEM", iso2: "YE" },
    { name: "Zambia", code: "ZMB", iso2: "ZM" }
];
