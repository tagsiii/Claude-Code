import type { DocumentKind } from '../types';

export interface ParsedDocument {
  kind: DocumentKind;
  text: string;
  pageCount: number | null;
  charCount: number;
}

const WORD_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc (best-effort)
]);
const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
]);

export function classifyKind(filename: string, mime: string): DocumentKind {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (WORD_MIMES.has(mime) || ext === 'docx' || ext === 'doc') return 'word';
  if (EXCEL_MIMES.has(mime) || ext === 'xlsx' || ext === 'xls') return 'excel';
  if (mime === 'text/csv' || ext === 'csv') return 'csv';
  if (mime.startsWith('text/') || ext === 'txt' || ext === 'md') return 'text';
  return 'other';
}

// Extensions/mimes we can actually extract text from.
export function isSupported(filename: string, mime: string): boolean {
  return classifyKind(filename, mime) !== 'other';
}

// Parse a raw file buffer into plain text for LLM analysis.
export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mime: string
): Promise<ParsedDocument> {
  const kind = classifyKind(filename, mime);

  switch (kind) {
    case 'word':
      return finish(kind, await parseWord(buffer), null);
    case 'excel':
      return parseExcel(buffer);
    case 'pdf':
      return parsePdf(buffer);
    case 'csv':
    case 'text':
      return finish(kind, buffer.toString('utf8'), null);
    default:
      throw new Error(`Unsupported file type: ${filename} (${mime})`);
  }
}

function finish(kind: DocumentKind, text: string, pageCount: number | null): ParsedDocument {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { kind, text: clean, pageCount, charCount: clean.length };
}

async function parseWord(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseExcel(buffer: Buffer): Promise<ParsedDocument> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      parts.push(`# Sheet: ${sheetName}\n${csv}`);
    }
  }
  return finish('excel', parts.join('\n\n'), wb.SheetNames.length);
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Import the implementation directly to avoid pdf-parse's index.js debug harness,
  // which tries to read a bundled test PDF at import time.
  const mod = await import('pdf-parse/lib/pdf-parse.js');
  const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(buffer);
  return finish('pdf', data.text, data.numpages ?? null);
}
