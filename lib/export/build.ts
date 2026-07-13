import type { Deal, ExportConfig } from '../types';
import { buildXlsx } from './excel';
import { buildDocx } from './word';
import { buildPdf } from './pdf';

export interface BuiltExport {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

const CONTENT_TYPES: Record<ExportConfig['format'], { contentType: string; extension: string }> = {
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
  },
  pdf: { contentType: 'application/pdf', extension: 'pdf' },
};

export async function buildExport(deals: Deal[], config: ExportConfig): Promise<BuiltExport> {
  const meta = CONTENT_TYPES[config.format];
  if (!meta) throw new Error(`Unsupported export format: ${config.format}`);

  let buffer: Buffer;
  switch (config.format) {
    case 'xlsx':
      buffer = await buildXlsx(deals, config.columns);
      break;
    case 'docx':
      buffer = await buildDocx(deals, config);
      break;
    case 'pdf':
      buffer = await buildPdf(deals, config);
      break;
  }
  return { buffer, ...meta };
}
