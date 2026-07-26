# Reference data for the geospatial layer

Loaders run **locally** (`npm run load:*`), are idempotent, and write a run-log
row visible on the Activity page. They cost **zero AI tokens** — batch scripts
on a manual/monthly cadence, never part of the scan loop.

| Command | Source | File(s) expected here |
|---|---|---|
| `npm run load:countries` | Natural Earth admin-0 (public domain) | auto-downloads; fallback `ne_countries.geojson` |
| `npm run load:wpi` | NGA World Port Index | `wpi.csv` |
| `npm run load:gem` | Global Energy Monitor trackers | `gem/*.xlsx` |
| `npm run load:cables` | **user-provided** (see licensing below) | `cables.geojson` |
| `npm run load:all` | all of the above in order | — |

## Download instructions

**Natural Earth** — no action needed; the loader downloads
`ne_110m_admin_0_countries.geojson` from the `nvkelso/natural-earth-vector`
GitHub mirror. If offline, place the file at `data/ne_countries.geojson`.

**World Port Index (WPI)** — visit NGA Maritime Safety Information
(https://msi.nga.mil/Publications/WPI), download the current WPI **CSV**
(e.g. `UpdatedPub150.csv`), save as `data/wpi.csv`. ~3,700 ports.

**Global Energy Monitor** — visit https://globalenergymonitor.org/projects/
and download the tracker spreadsheets you want (Coal Plant, Gas/LNG, Wind,
Solar, pipelines, coal mines — some require free registration). Drop the
`.xlsx` files into `data/gem/`. Facility type is inferred from the filename
(`lng` → lng_terminal, `pipeline` → pipeline, `mine` → mine, other energy →
power_plant), so keep the original names.

## Subsea cables — licensing note (read this)

TeleGeography's Submarine Cable Map is the standard reference, but its data is
**not openly licensed for automated scraping/ingestion**. This project
therefore ships **no automated cable ingester** — that is deliberate, not an
omission.

- For manual reference, use the free interactive map:
  https://www.submarinecablemap.com
- If you have data you are licensed to use (or your own compilation), save it
  as `data/cables.geojson`: `LineString`/`MultiLineString` features become
  cables (properties: `name`, optional `owners`, `rfs_year`);
  `Point` features become cable **landing stations** (property `name`,
  optional `country_iso3`) and feed the `flag_near_cable_landing` scoring
  signal.
- Without the file, `load:cables` logs a skip and everything else works;
  the near-cable-landing flag simply never fires.

Everything else in this directory is government/open data and is ingested
directly.

## Phase 2 — activity layers

| Command | Source | Needs from you |
|---|---|---|
| `npm run load:aiddata` | AidData GeoGCDF v3 (GitHub) | nothing — auto-fetches (~20-40 min first run, resumable) |
| `npm run load:eez` | Marine Regions World EEZ | `eez.zip` (shapefile zip, do not unzip) |
| `npm run load:dfc` | dfc.gov "View DFC Project Data" | `dfc.xlsx` or `dfc.csv` |
| `npm run load:exim` | exim.gov/open authorizations | `exim.xlsx` or `exim.csv` |
| `npm run load:mcc` | mcc.gov open data (compacts) | `mcc.xlsx` or `mcc.csv` |
| `npm run load:ppi` | ppi.worldbank.org bulk download | `ppi.xlsx` or `ppi.csv` |
| `npm run sync:ustda` | USTDA press feed (API) | nothing |
| `npm run sync:wb` | World Bank Projects API | nothing |
| `npm run sync:oecd` | OECD CRS (SDMX API) | nothing |

Run `lib/db/geo2.sql` in the Supabase SQL editor once before the first Phase-2
load. All loaders print their real columns when a file parses to zero rows —
paste those lines back to the developer for parser extension.
