import { BaseConnector, ConnectorOptions } from './base';
import type { RawArticle } from '../types';

const WB_PROJECTS_API = 'https://search.worldbank.org/api/v2/projects';
const WB_BASE_URL = 'https://projects.worldbank.org/en/projects-operations/project-detail';

// Sectors mapped to WB sector codes relevant to our mandate
const TARGET_SECTORS = [
  'Transportation',
  'Energy and Extractives',
  'Information and Communications Technologies',
  'Water',
];

interface WBProject {
  id: string;
  project_name: string;
  countryname: string;
  regionname?: string;
  sector: string;
  status: string;
  totalamt?: number;
  lendinginstr?: string;
  impagency?: string;
  boardapprovaldate?: string;
  closingdate?: string;
}

interface WBResponse {
  projects?: Record<string, WBProject>;
  total?: number;
}

export class WorldBankConnector extends BaseConnector {
  readonly name = 'worldbank';
  readonly displayName = 'World Bank Projects';

  isAvailable(): boolean {
    return true; // public API, no key
  }

  async fetchArticles(opts: ConnectorOptions = {}): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    const lookbackDays = opts.lookbackDays ?? 30; // WB projects update less frequently

    // Use approvalfy to filter recent approvals
    const currentYear = new Date().getFullYear();

    for (const sector of TARGET_SECTORS) {
      try {
        const params = new URLSearchParams({
          format: 'json',
          sector_exact: sector,
          status: 'Active',
          rows: '50',
          page: '1',
          approvalfy: `${currentYear - 1},${currentYear}`,
        });

        const res = await fetch(`${WB_PROJECTS_API}?${params}`, {
          headers: { 'User-Agent': 'EconomicStatecraftMonitor/1.0' },
          next: { revalidate: 0 },
        });

        if (!res.ok) continue;

        const json: WBResponse = await res.json();
        for (const [, project] of Object.entries(json.projects ?? {})) {
          if (!project.id || !project.project_name) continue;
          articles.push({
            url: `${WB_BASE_URL}/${project.id}`,
            title: buildWBTitle(project),
            published_at: project.boardapprovaldate
              ? new Date(project.boardapprovaldate).toISOString()
              : null,
            source_country: 'United States', // WB is US-headquartered
            language: 'English',
            domain: 'projects.worldbank.org',
            connector: 'worldbank',
            confidence_tier: 1, // official/primary source
          });
        }

        await this.delay(300);
      } catch {
        // continue on per-sector errors
      }
    }

    return articles;
  }
}

function buildWBTitle(project: WBProject): string {
  const amt = project.totalamt
    ? ` ($${(project.totalamt / 1_000_000).toFixed(0)}M)`
    : '';
  return `[World Bank] ${project.project_name} — ${project.countryname}${amt}`;
}
