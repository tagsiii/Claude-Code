// Registry for the Data browser page: every dataset the grid can show, with a
// whitelisted column list (geometry columns deliberately excluded — heavy geo
// never transits serverless routes). The API route refuses anything not here.

export type ColType = 'text' | 'number' | 'date' | 'boolean';

export interface DataColumn {
  key: string;
  label: string;
  type: ColType;
  // Array-typed DB columns render fine but can't be filtered/sorted server-side.
  filterable?: boolean;
  sortable?: boolean;
}

export interface Dataset {
  key: string;
  table: string;
  label: string;
  description: string;
  columns: DataColumn[];
  defaultSort: string;
  defaultDir: 'asc' | 'desc';
  // When set, the first column links to `${rowLinkPrefix}${row[rowLinkKey]}`.
  rowLinkPrefix?: string;
  rowLinkKey?: string;
}

const col = (key: string, label: string, type: ColType = 'text', extra: Partial<DataColumn> = {}): DataColumn =>
  ({ key, label, type, ...extra });

export const DATASETS: Record<string, Dataset> = {
  deals: {
    key: 'deals', table: 'deals', label: 'Deals',
    description: 'The tracked transactions — one living row per deal.',
    defaultSort: 'composite_score', defaultDir: 'desc',
    rowLinkPrefix: '/dashboard/deals/', rowLinkKey: 'id',
    columns: [
      col('title', 'Title'),
      col('host_country', 'Host Country'),
      col('country_iso3', 'ISO3'),
      col('sector', 'Sector'),
      col('subsector', 'Subsector'),
      col('lifecycle_stage', 'Stage'),
      col('sponsoring_state', 'Sponsor State'),
      col('rom_value_usd', 'Value (USD)', 'number'),
      col('composite_score', 'Score', 'number'),
      col('source_count', 'Sources', 'number'),
      col('source_confidence_tier', 'Tier', 'number'),
      col('location_precision', 'Precision'),
      col('flag_white_space', 'White Space', 'boolean'),
      col('flag_near_cable_landing', 'Near Cable', 'boolean'),
      col('flag_contested_asset', 'Contested', 'boolean'),
      col('flag_us_positioning', 'US Positioned', 'boolean'),
      col('flag_unpositioned_mdb', 'MDB Gap', 'boolean'),
      col('status', 'Status'),
      col('first_seen_at', 'First Seen', 'date'),
      col('last_updated_at', 'Updated', 'date'),
    ],
  },
  cn_projects: {
    key: 'cn_projects', table: 'cn_finance_projects', label: 'Chinese Projects',
    description: 'AidData GCDF: Chinese state-backed development finance projects.',
    defaultSort: 'commitment_usd', defaultDir: 'desc',
    columns: [
      col('project_ref', 'Ref'),
      col('title', 'Title'),
      col('sector', 'Sector'),
      col('commitment_usd', 'Commitment (USD)', 'number'),
      col('year', 'Year', 'number'),
      col('status', 'Status'),
      col('country_iso3', 'ISO3'),
      col('loaded_at', 'Loaded', 'date'),
    ],
  },
  us_activity: {
    key: 'us_activity', table: 'us_activity', label: 'US Activity',
    description: 'US agency programs and financings (DFC, EXIM, USTDA, MCC…).',
    defaultSort: 'value_usd', defaultDir: 'desc',
    columns: [
      col('agency', 'Agency'),
      col('record_type', 'Type'),
      col('project_name', 'Project'),
      col('country_iso3', 'ISO3'),
      col('sector', 'Sector'),
      col('value_usd', 'Value (USD)', 'number'),
      col('announced_date', 'Announced', 'date'),
      col('is_leading_indicator', 'Leading', 'boolean'),
      col('source', 'Source'),
    ],
  },
  mdb_pipeline: {
    key: 'mdb_pipeline', table: 'mdb_pipeline', label: 'MDB Pipeline',
    description: 'Multilateral development bank projects (World Bank, PPI).',
    defaultSort: 'value_usd', defaultDir: 'desc',
    columns: [
      col('bank', 'Bank'),
      col('project_ref', 'Ref'),
      col('name', 'Project'),
      col('country_iso3', 'ISO3'),
      col('sector', 'Sector'),
      col('status', 'Status'),
      col('value_usd', 'Value (USD)', 'number'),
      col('source', 'Source'),
    ],
  },
  intl_finance: {
    key: 'intl_finance', table: 'intl_finance', label: 'Intl Finance',
    description: 'Other-donor commitments by country and year (OECD CRS).',
    defaultSort: 'commitment_usd', defaultDir: 'desc',
    columns: [
      col('donor', 'Donor'),
      col('country_iso3', 'ISO3'),
      col('sector', 'Sector'),
      col('year', 'Year', 'number'),
      col('commitment_usd', 'Commitment (USD)', 'number'),
      col('source', 'Source'),
    ],
  },
  facilities: {
    key: 'facilities', table: 'facilities', label: 'Facilities',
    description: 'Ports, power plants, LNG terminals, pipelines, mines, cable landings.',
    defaultSort: 'name', defaultDir: 'asc',
    columns: [
      col('name', 'Name'),
      col('facility_type', 'Type'),
      col('country_iso3', 'ISO3'),
      col('source', 'Source'),
      col('source_ref', 'Source Ref'),
      col('loaded_at', 'Loaded', 'date'),
    ],
  },
  sponsors: {
    key: 'sponsors', table: 'sponsors', label: 'Sponsors',
    description: 'Canonical sponsor entities (SOEs, policy banks, DFIs…).',
    defaultSort: 'canonical_name', defaultDir: 'asc',
    columns: [
      col('canonical_name', 'Name'),
      col('aliases', 'Aliases', 'text', { filterable: false, sortable: false }),
      col('country_iso3', 'ISO3'),
      col('entity_type', 'Type'),
      col('is_state_backed', 'State-Backed', 'boolean'),
      col('needs_review', 'Needs Review', 'boolean'),
    ],
  },
  countries: {
    key: 'countries', table: 'countries', label: 'Countries',
    description: 'Reference countries with regions and centroids.',
    defaultSort: 'name', defaultDir: 'asc',
    columns: [
      col('iso3', 'ISO3'),
      col('name', 'Name'),
      col('continent', 'Continent'),
      col('un_region', 'UN Region'),
      col('subregion', 'Subregion'),
      col('centroid_lon', 'Lon', 'number'),
      col('centroid_lat', 'Lat', 'number'),
    ],
  },
  cables: {
    key: 'cables', table: 'cables', label: 'Cables',
    description: 'Submarine cables (user-licensed data).',
    defaultSort: 'name', defaultDir: 'asc',
    columns: [
      col('name', 'Name'),
      col('rfs_year', 'RFS Year', 'number'),
      col('owners', 'Owners', 'text', { filterable: false, sortable: false }),
      col('source', 'Source'),
    ],
  },
  sources: {
    key: 'sources', table: 'sources', label: 'Sources',
    description: 'Every article and document the pipeline has recorded.',
    defaultSort: 'retrieved_at', defaultDir: 'desc',
    columns: [
      col('title', 'Title'),
      col('url', 'URL'),
      col('connector', 'Connector'),
      col('confidence_tier', 'Tier', 'number'),
      col('published_at', 'Published', 'date'),
      col('retrieved_at', 'Retrieved', 'date'),
    ],
  },
};

// One filter-box input → typed query operations. Excel-ish syntax:
//   text:    bare → contains (case-insensitive)
//   number:  "100" → equals · ">100" → at least · "<100" → at most · "5..10" → range
//   date:    "2024-01-01" → on/after · ">…" after · "<…" before
//   boolean: yes/true/1 → true · no/false/0 → false
export interface FilterOp {
  op: 'ilike' | 'eq' | 'gte' | 'lte';
  value: string | number | boolean;
}

export function parseFilterInput(raw: string, type: ColType): FilterOp[] {
  const v = raw.trim();
  if (!v) return [];

  if (type === 'boolean') {
    if (/^(y|yes|true|1|✓)$/i.test(v)) return [{ op: 'eq', value: true }];
    if (/^(n|no|false|0)$/i.test(v)) return [{ op: 'eq', value: false }];
    return [];
  }

  if (type === 'number') {
    const num = (s: string) => Number(s.replace(/[,$_\s]/g, ''));
    const range = v.match(/^(-?[\d,.$_\se]+)\.\.(-?[\d,.$_\se]+)$/);
    if (range) {
      const lo = num(range[1]);
      const hi = num(range[2]);
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        return [{ op: 'gte', value: lo }, { op: 'lte', value: hi }];
      }
      return [];
    }
    if (v.startsWith('>')) {
      const n = num(v.slice(1));
      return Number.isFinite(n) ? [{ op: 'gte', value: n }] : [];
    }
    if (v.startsWith('<')) {
      const n = num(v.slice(1));
      return Number.isFinite(n) ? [{ op: 'lte', value: n }] : [];
    }
    const n = num(v);
    return Number.isFinite(n) ? [{ op: 'eq', value: n }] : [];
  }

  if (type === 'date') {
    if (v.startsWith('>')) return [{ op: 'gte', value: v.slice(1).trim() }];
    if (v.startsWith('<')) return [{ op: 'lte', value: v.slice(1).trim() }];
    return [{ op: 'gte', value: v }];
  }

  // text — strip PostgREST-structural characters, contains-match the rest
  const safe = v.replace(/[,()"'\\%]/g, ' ').replace(/\s+/g, ' ').trim();
  return safe ? [{ op: 'ilike', value: `%${safe}%` }] : [];
}
