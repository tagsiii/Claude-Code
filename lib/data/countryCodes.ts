// Country name → ISO 3166-1 alpha-3. Pure/static — used by normalization,
// the country_iso3 backfill, and loaders. Keys are matched case-insensitively
// after trimming; add aliases here as ingestion surfaces new variants.

const NAME_TO_ISO3: Record<string, string> = {
  // Priority actors + common variants
  'china': 'CHN', "people's republic of china": 'CHN', 'prc': 'CHN', 'peoples republic of china': 'CHN',
  'russia': 'RUS', 'russian federation': 'RUS',
  'united states': 'USA', 'united states of america': 'USA', 'usa': 'USA', 'us': 'USA',
  'united arab emirates': 'ARE', 'uae': 'ARE',
  'saudi arabia': 'SAU', 'kingdom of saudi arabia': 'SAU', 'ksa': 'SAU',
  'qatar': 'QAT', 'kuwait': 'KWT', 'bahrain': 'BHR', 'oman': 'OMN',
  'iran': 'IRN', 'islamic republic of iran': 'IRN',
  'turkey': 'TUR', 'türkiye': 'TUR', 'turkiye': 'TUR',
  'north korea': 'PRK', 'dprk': 'PRK', 'south korea': 'KOR', 'republic of korea': 'KOR', 'korea': 'KOR',
  'japan': 'JPN', 'india': 'IND', 'pakistan': 'PAK', 'bangladesh': 'BGD', 'sri lanka': 'LKA',
  'nepal': 'NPL', 'bhutan': 'BTN', 'maldives': 'MDV', 'afghanistan': 'AFG',
  'myanmar': 'MMR', 'burma': 'MMR', 'thailand': 'THA', 'laos': 'LAO', 'lao pdr': 'LAO',
  'cambodia': 'KHM', 'vietnam': 'VNM', 'viet nam': 'VNM', 'malaysia': 'MYS', 'singapore': 'SGP',
  'indonesia': 'IDN', 'philippines': 'PHL', 'brunei': 'BRN', 'timor-leste': 'TLS', 'east timor': 'TLS',
  'mongolia': 'MNG', 'kazakhstan': 'KAZ', 'uzbekistan': 'UZB', 'turkmenistan': 'TKM',
  'kyrgyzstan': 'KGZ', 'kyrgyz republic': 'KGZ', 'tajikistan': 'TJK',
  'azerbaijan': 'AZE', 'armenia': 'ARM', 'georgia': 'GEO',
  // Africa
  'egypt': 'EGY', 'libya': 'LBY', 'tunisia': 'TUN', 'algeria': 'DZA', 'morocco': 'MAR',
  'sudan': 'SDN', 'south sudan': 'SSD', 'ethiopia': 'ETH', 'eritrea': 'ERI', 'djibouti': 'DJI',
  'somalia': 'SOM', 'kenya': 'KEN', 'uganda': 'UGA', 'tanzania': 'TZA',
  'united republic of tanzania': 'TZA', 'rwanda': 'RWA', 'burundi': 'BDI',
  'democratic republic of the congo': 'COD', 'dr congo': 'COD', 'drc': 'COD', 'congo-kinshasa': 'COD',
  'republic of the congo': 'COG', 'congo': 'COG', 'congo-brazzaville': 'COG',
  'gabon': 'GAB', 'cameroon': 'CMR', 'central african republic': 'CAF', 'chad': 'TCD',
  'niger': 'NER', 'nigeria': 'NGA', 'benin': 'BEN', 'togo': 'TGO', 'ghana': 'GHA',
  "cote d'ivoire": 'CIV', 'ivory coast': 'CIV', 'liberia': 'LBR', 'sierra leone': 'SLE',
  'guinea': 'GIN', 'guinea-bissau': 'GNB', 'senegal': 'SEN', 'gambia': 'GMB',
  'mauritania': 'MRT', 'mali': 'MLI', 'burkina faso': 'BFA',
  'angola': 'AGO', 'zambia': 'ZMB', 'malawi': 'MWI', 'mozambique': 'MOZ', 'zimbabwe': 'ZWE',
  'botswana': 'BWA', 'namibia': 'NAM', 'south africa': 'ZAF', 'lesotho': 'LSO', 'eswatini': 'SWZ',
  'madagascar': 'MDG', 'mauritius': 'MUS', 'seychelles': 'SYC', 'comoros': 'COM',
  'cape verde': 'CPV', 'cabo verde': 'CPV', 'sao tome and principe': 'STP', 'equatorial guinea': 'GNQ',
  // MENA remainder
  'iraq': 'IRQ', 'syria': 'SYR', 'lebanon': 'LBN', 'jordan': 'JOR', 'israel': 'ISR',
  'palestine': 'PSE', 'yemen': 'YEM',
  // Europe
  'united kingdom': 'GBR', 'uk': 'GBR', 'great britain': 'GBR', 'france': 'FRA', 'germany': 'DEU',
  'italy': 'ITA', 'spain': 'ESP', 'portugal': 'PRT', 'netherlands': 'NLD', 'belgium': 'BEL',
  'luxembourg': 'LUX', 'switzerland': 'CHE', 'austria': 'AUT', 'poland': 'POL',
  'czech republic': 'CZE', 'czechia': 'CZE', 'slovakia': 'SVK', 'hungary': 'HUN',
  'romania': 'ROU', 'bulgaria': 'BGR', 'greece': 'GRC', 'cyprus': 'CYP', 'malta': 'MLT',
  'croatia': 'HRV', 'slovenia': 'SVN', 'serbia': 'SRB', 'bosnia and herzegovina': 'BIH',
  'montenegro': 'MNE', 'north macedonia': 'MKD', 'macedonia': 'MKD', 'albania': 'ALB', 'kosovo': 'KOS',
  'ukraine': 'UKR', 'belarus': 'BLR', 'moldova': 'MDA', 'lithuania': 'LTU', 'latvia': 'LVA',
  'estonia': 'EST', 'finland': 'FIN', 'sweden': 'SWE', 'norway': 'NOR', 'denmark': 'DNK',
  'iceland': 'ISL', 'ireland': 'IRL',
  // Americas
  'canada': 'CAN', 'mexico': 'MEX', 'guatemala': 'GTM', 'belize': 'BLZ', 'honduras': 'HND',
  'el salvador': 'SLV', 'nicaragua': 'NIC', 'costa rica': 'CRI', 'panama': 'PAN',
  'cuba': 'CUB', 'jamaica': 'JAM', 'haiti': 'HTI', 'dominican republic': 'DOM',
  'trinidad and tobago': 'TTO', 'barbados': 'BRB', 'bahamas': 'BHS', 'guyana': 'GUY',
  'suriname': 'SUR', 'venezuela': 'VEN', 'colombia': 'COL', 'ecuador': 'ECU', 'peru': 'PER',
  'bolivia': 'BOL', 'brazil': 'BRA', 'paraguay': 'PRY', 'uruguay': 'URY', 'chile': 'CHL',
  'argentina': 'ARG',
  // Oceania
  'australia': 'AUS', 'new zealand': 'NZL', 'papua new guinea': 'PNG', 'fiji': 'FJI',
  'solomon islands': 'SLB', 'vanuatu': 'VUT', 'samoa': 'WSM', 'tonga': 'TON',
  'kiribati': 'KIR', 'micronesia': 'FSM', 'palau': 'PLW', 'marshall islands': 'MHL', 'nauru': 'NRU',
  'tuvalu': 'TUV', 'cook islands': 'COK',
};

const VALID_ISO3 = new Set(Object.values(NAME_TO_ISO3));

// Resolve a country name or code to ISO3, or null.
export function toIso3(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^[A-Za-z]{3}$/.test(s)) {
    const upper = s.toUpperCase();
    if (VALID_ISO3.has(upper)) return upper;
  }
  const key = s.toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
  return NAME_TO_ISO3[key] ?? null;
}

export function isValidIso3(code: string | null | undefined): boolean {
  return !!code && /^[A-Z]{3}$/.test(code);
}

// ISO 3166-1 alpha-2 → alpha-3 (IATI and several agency files use 2-letter codes).
const ISO2_TO_ISO3: Record<string, string> = {
  AF: 'AFG', AL: 'ALB', DZ: 'DZA', AO: 'AGO', AR: 'ARG', AM: 'ARM', AU: 'AUS', AT: 'AUT', AZ: 'AZE',
  BS: 'BHS', BH: 'BHR', BD: 'BGD', BB: 'BRB', BY: 'BLR', BE: 'BEL', BZ: 'BLZ', BJ: 'BEN', BT: 'BTN',
  BO: 'BOL', BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN', BG: 'BGR', BF: 'BFA', BI: 'BDI', CV: 'CPV',
  KH: 'KHM', CM: 'CMR', CA: 'CAN', CF: 'CAF', TD: 'TCD', CL: 'CHL', CN: 'CHN', CO: 'COL', KM: 'COM',
  CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV', HR: 'HRV', CU: 'CUB', CY: 'CYP', CZ: 'CZE', DK: 'DNK',
  DJ: 'DJI', DO: 'DOM', EC: 'ECU', EG: 'EGY', SV: 'SLV', GQ: 'GNQ', ER: 'ERI', EE: 'EST', SZ: 'SWZ',
  ET: 'ETH', FJ: 'FJI', FI: 'FIN', FR: 'FRA', GA: 'GAB', GM: 'GMB', GE: 'GEO', DE: 'DEU', GH: 'GHA',
  GR: 'GRC', GT: 'GTM', GN: 'GIN', GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND', HU: 'HUN', IS: 'ISL',
  IN: 'IND', ID: 'IDN', IR: 'IRN', IQ: 'IRQ', IE: 'IRL', IL: 'ISR', IT: 'ITA', JM: 'JAM', JP: 'JPN',
  JO: 'JOR', KZ: 'KAZ', KE: 'KEN', KI: 'KIR', KP: 'PRK', KR: 'KOR', KW: 'KWT', KG: 'KGZ', LA: 'LAO',
  LV: 'LVA', LB: 'LBN', LS: 'LSO', LR: 'LBR', LY: 'LBY', LT: 'LTU', LU: 'LUX', MG: 'MDG', MW: 'MWI',
  MY: 'MYS', MV: 'MDV', ML: 'MLI', MT: 'MLT', MH: 'MHL', MR: 'MRT', MU: 'MUS', MX: 'MEX', FM: 'FSM',
  MD: 'MDA', MN: 'MNG', ME: 'MNE', MA: 'MAR', MZ: 'MOZ', MM: 'MMR', NA: 'NAM', NR: 'NRU', NP: 'NPL',
  NL: 'NLD', NZ: 'NZL', NI: 'NIC', NE: 'NER', NG: 'NGA', MK: 'MKD', NO: 'NOR', OM: 'OMN', PK: 'PAK',
  PW: 'PLW', PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL', PT: 'PRT', QA: 'QAT',
  RO: 'ROU', RU: 'RUS', RW: 'RWA', WS: 'WSM', SA: 'SAU', SN: 'SEN', RS: 'SRB', SC: 'SYC', SL: 'SLE',
  SG: 'SGP', SK: 'SVK', SI: 'SVN', SB: 'SLB', SO: 'SOM', ZA: 'ZAF', SS: 'SSD', ES: 'ESP', LK: 'LKA',
  SD: 'SDN', SR: 'SUR', SE: 'SWE', CH: 'CHE', SY: 'SYR', TJ: 'TJK', TZ: 'TZA', TH: 'THA', TL: 'TLS',
  TG: 'TGO', TO: 'TON', TT: 'TTO', TN: 'TUN', TR: 'TUR', TM: 'TKM', TV: 'TUV', UG: 'UGA', UA: 'UKR',
  AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY', UZ: 'UZB', VU: 'VUT', VE: 'VEN', VN: 'VNM', YE: 'YEM',
  ZM: 'ZMB', ZW: 'ZWE', PS: 'PSE', XK: 'KOS',
};

export function iso2ToIso3(code: string | null | undefined): string | null {
  if (!code) return null;
  return ISO2_TO_ISO3[code.trim().toUpperCase()] ?? null;
}

// Scan free text (e.g. a press-release title) for the first known country name.
// Longer names are matched first so "South Sudan" wins over "Sudan".
const NAMES_BY_LENGTH = Object.keys(NAME_TO_ISO3)
  .filter((n) => n.length > 3) // skip ambiguous short codes like 'us', 'uk'
  .sort((a, b) => b.length - a.length);

export function findCountryInText(text: string): { name: string; iso3: string } | null {
  const hay = ` ${text.toLowerCase().replace(/[^a-z\s'-]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const name of NAMES_BY_LENGTH) {
    if (hay.includes(` ${name} `)) return { name, iso3: NAME_TO_ISO3[name] };
  }
  return null;
}
