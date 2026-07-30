// Data-source catalog: the provenance story for every dataset in the app —
// who publishes it, what it covers, its license, and how it gets refreshed.
// Shown on the Data page so the origin of every number is one click away.

export interface SourceInfo {
  provider: string;
  what: string;
  coverage: string;
  license: string;
  refresh: string; // the exact command or mechanism that updates it
  url: string;
  // Column that timestamps loads, for the "last loaded" stat (null = none).
  loadedAtColumn: string | null;
}

export const SOURCE_CATALOG: Record<string, SourceInfo> = {
  deals: {
    provider: 'This application (AI extraction + analyst input)',
    what: 'The living transaction records: extracted from news scans (GDELT) and uploaded documents, deduplicated into one row per deal, deterministically scored, human-reviewable.',
    coverage: 'Whatever the scans and your uploads have surfaced — grows continuously.',
    license: 'Internal work product',
    refresh: 'Run Scan button · document uploads · daily cron once deployed',
    url: '/dashboard',
    loadedAtColumn: 'last_updated_at',
  },
  cn_projects: {
    provider: 'AidData (William & Mary) — Global Chinese Development Finance Dataset v3',
    what: 'Official-record Chinese state-backed development finance projects with geometry: lender, value, year, status, location.',
    coverage: '~9,400 georeferenced projects, 2000–2021 commitments, worldwide.',
    license: 'Open Data Commons Attribution (research use, cite AidData)',
    refresh: 'npm run load:aiddata (resumable; GitHub-hosted files)',
    url: 'https://www.aiddata.org/gcdf',
    loadedAtColumn: 'loaded_at',
  },
  us_activity: {
    provider: 'DFC, EXIM, USTDA, MCC (via IATI Registry), World Bank',
    what: 'US agency financings, feasibility studies, and programs — the "US presence" layer that powers white-space and positioning signals.',
    coverage: 'DFC active projects, EXIM authorizations, USTDA press releases (leading indicators), MCC compacts.',
    license: 'US government open data (public domain)',
    refresh: 'npm run load:dfc / load:exim / load:mcc / sync:ustda / sync:mcc',
    url: 'https://www.dfc.gov / https://www.exim.gov/open / https://www.ustda.gov',
    loadedAtColumn: null,
  },
  mdb_pipeline: {
    provider: 'World Bank Projects API · World Bank PPI database',
    what: 'Multilateral development bank projects, including upcoming (pipeline) ones — the financing trains the US can still join.',
    coverage: 'Most recent ~6,000 WB projects + PPI infrastructure deals.',
    license: 'CC BY 4.0 (World Bank Open Data)',
    refresh: 'npm run sync:wb · npm run load:ppi',
    url: 'https://projects.worldbank.org / https://ppi.worldbank.org',
    loadedAtColumn: null,
  },
  intl_finance: {
    provider: 'OECD Creditor Reporting System (CRS)',
    what: 'Other-donor commitments (Japan, Korea, EU institutions, Gulf funds) aggregated by recipient country, sector, and year — comparison context.',
    coverage: 'CRS-reporting donors, 2018 onward.',
    license: 'OECD terms (free with attribution)',
    refresh: 'npm run sync:oecd',
    url: 'https://stats.oecd.org',
    loadedAtColumn: 'loaded_at',
  },
  facilities: {
    provider: 'NGA World Port Index · Global Energy Monitor trackers',
    what: 'The physical-infrastructure gazetteer: ports, power plants, LNG terminals, pipelines, mines, cable landings. Anchors deal geocoding and facility-level dedup.',
    coverage: '~414,000 facilities worldwide.',
    license: 'WPI: US public domain · GEM: CC BY 4.0',
    refresh: 'npm run load:wpi · npm run load:gem',
    url: 'https://msi.nga.mil / https://globalenergymonitor.org',
    loadedAtColumn: 'loaded_at',
  },
  sponsors: {
    provider: 'This application (seeded canon + scan discoveries)',
    what: 'Canonical sponsor entities (policy banks, SOEs, sovereign funds) with aliases — keeps "CCCC" and "China Communications Construction" as one entity.',
    coverage: 'Seeded with major Chinese/Russian/Gulf state actors; grows from scans (new names flagged for review).',
    license: 'Internal work product',
    refresh: 'Automatic during scans',
    url: '/dashboard/data',
    loadedAtColumn: 'created_at',
  },
  countries: {
    provider: 'Natural Earth (admin-0, 110m)',
    what: 'Country polygons, centroids, and regions — the base for country-level geocoding and the map choropleth.',
    coverage: '177 sovereign states.',
    license: 'Public domain',
    refresh: 'npm run load:countries (auto-downloads)',
    url: 'https://www.naturalearthdata.com',
    loadedAtColumn: null,
  },
  cables: {
    provider: 'TeleGeography Submarine Cable Map (user-supplied file)',
    what: 'Submarine cable routes and landing stations — powers the near-cable-landing scoring signal and the map layer.',
    coverage: 'Global, as of your downloaded snapshot.',
    license: 'CC BY-NC-SA — attribution required, non-commercial; no automated ingestion (file supplied manually)',
    refresh: 'npm run load:cables (reads data/cables.geojson)',
    url: 'https://www.submarinecablemap.com',
    loadedAtColumn: 'loaded_at',
  },
  sources: {
    provider: 'GDELT DOC 2.0 (news discovery) + your uploads',
    what: 'Every article and document the pipeline has recorded, with outlet, confidence tier, and retrieval time — the raw evidence trail.',
    coverage: 'All scans since setup; 7-day rolling news window per scan.',
    license: 'Article metadata only (links to publishers)',
    refresh: 'Every scan',
    url: 'https://www.gdeltproject.org',
    loadedAtColumn: 'retrieved_at',
  },
};
