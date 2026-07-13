import type { Deal } from '../types';
import { resolveFields } from './fields';

// Build an .xlsx workbook (one "Deals" sheet) from the selected columns.
export async function buildXlsx(deals: Deal[], columns: string[]): Promise<Buffer> {
  const XLSX = await import('xlsx');
  const fields = resolveFields(columns);

  const header = fields.map((f) => f.label);
  const rows = deals.map((d) => fields.map((f) => f.get(d)));
  const aoa: (string | number | null)[][] = [header, ...rows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = fields.map((f) => ({
    wch: f.longText ? 60 : f.key === 'title' ? 42 : 16,
  }));
  // Freeze the header row.
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' } as never;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Deals');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}
