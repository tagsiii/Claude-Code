// One-page briefing memo for a SINGLE deal — the drop-into-your-writing
// deliverable: facts with provenance, score rationale, spatial signals,
// evidence quality, and sources.

import type { Deal } from '../types';
import { formatSector, formatStage, formatUsd } from '../utils/format';

const SCORE_DIMS = [
  ['likelihood', 'Likelihood to Close'],
  ['actionability', 'US Actionability'],
  ['financing', 'Financing Certainty'],
  ['corroboration', 'Source Corroboration'],
  ['strategic_priority', 'Strategic Priority'],
] as const;

const SIGNALS: Array<[keyof Deal, string]> = [
  ['flag_near_cable_landing_reason', 'Near cable landing'],
  ['flag_white_space_reason', 'White space'],
  ['flag_contested_asset_reason', 'Contested asset'],
  ['flag_us_positioning_reason', 'US positioning'],
  ['flag_unpositioned_mdb_reason', 'Unpositioned MDB pipeline'],
];

interface MemoModel {
  title: string;
  metaLine: string;
  factRows: Array<[string, string]>;
  signals: Array<[string, string]>;
  scoreLines: string[];
  summary: string | null;
  diplomatic: string | null;
  sources: Array<{ label: string; url: string }>;
  generated: string;
}

// Shared shape both renderers consume — keeps Word and PDF memos identical.
export function buildMemoModel(deal: Deal): MemoModel {
  const prov = (field: string): string => {
    const p = deal.provenance?.[field];
    return p ? ` (per ${p.source}, ${p.date})` : '';
  };

  const factRows: Array<[string, string]> = [];
  factRows.push(['Host country', `${deal.host_country ?? 'Unknown'}${deal.host_region ? ` (${deal.host_region})` : ''}`]);
  factRows.push(['Sponsoring state', (deal.sponsoring_state ?? 'Unknown') + prov('sponsoring_state')]);
  factRows.push(['Sector / stage', `${formatSector(deal.sector)}${deal.subsector ? ` · ${deal.subsector}` : ''} · ${formatStage(deal.lifecycle_stage)}${prov('lifecycle_stage')}`]);
  if (deal.rom_value_usd) {
    factRows.push(['Value', `${formatUsd(deal.rom_value_usd)}${deal.rom_basis ? ` — ${deal.rom_basis}` : ''}${prov('rom_value_usd')}`]);
  }
  const fin = deal.enrichment_details?.financing_structure;
  if (fin?.type || fin?.details) {
    factRows.push(['Financing', [fin.type, fin.details].filter(Boolean).join(' — ')]);
  }
  const parties = deal.enrichment_details?.counterparties ?? [];
  if (parties.length > 0) {
    factRows.push(['Counterparties', parties.map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join('; ')]);
  }
  if ((deal.financial_sponsors?.length ?? 0) > 0) {
    factRows.push(['Financial sponsors', deal.financial_sponsors.map((s) => `${s.name} [${s.commitment_status}]`).join('; ')]);
  }
  const quality: string[] = [];
  if (deal.data_quality_grade) quality.push(`data quality ${deal.data_quality_grade}`);
  quality.push(`${deal.independent_source_count ?? deal.source_count} independent source(s)`);
  if (deal.xref_cn_ref) quality.push(deal.xref_note ?? `corroborated by AidData ${deal.xref_cn_ref}`);
  if (deal.is_confirmed) quality.push('confirmed');
  factRows.push(['Evidence', quality.join(' · ')]);

  const signals: Array<[string, string]> = [];
  for (const [field, label] of SIGNALS) {
    const reason = deal[field];
    if (typeof reason === 'string' && reason) signals.push([label, reason]);
  }

  const scoreLines: string[] = [];
  if (deal.score_breakdown) {
    for (const [key, label] of SCORE_DIMS) {
      const sub = deal.score_breakdown[key];
      if (!sub) continue;
      scoreLines.push(`${label} — ${sub.score}/100 (weight ${(sub.weight * 100).toFixed(0)}%): ${sub.reasoning}`);
    }
  }

  return {
    title: deal.title,
    metaLine: `Executability score ${deal.composite_score?.toFixed(0) ?? '—'}/100 · First seen ${deal.first_seen_at?.slice(0, 10) ?? '—'} · Last updated ${deal.last_updated_at?.slice(0, 10) ?? '—'}`,
    factRows,
    signals,
    scoreLines,
    summary: deal.executive_summary ?? null,
    diplomatic: deal.us_diplomatic_context ?? null,
    sources: (deal.sources ?? []).slice(0, 8).map((s) => ({
      label: s.title || s.url,
      url: s.url,
    })),
    generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

export async function buildMemoDocx(deal: Deal): Promise<Buffer> {
  const m = buildMemoModel(deal);
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  const children: unknown[] = [
    new Paragraph({ text: 'BRIEFING MEMO — ECONOMIC STATECRAFT MONITOR', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: m.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: m.metaLine, color: '666666', size: 18 })] }),
    new Paragraph({ text: '' }),
  ];

  for (const [k, v] of m.factRows) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${k}: `, bold: true, size: 18 }),
        new TextRun({ text: v, size: 18 }),
      ],
    }));
  }

  if (m.signals.length > 0) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Spatial Signals', bold: true, size: 20 })] }));
    for (const [label, reason] of m.signals) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${label}: `, bold: true, size: 18 }),
          new TextRun({ text: reason, size: 18 }),
        ],
      }));
    }
  }

  if (m.summary) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Executive Summary', bold: true, size: 20 })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: m.summary, size: 18 })] }));
  }
  if (m.diplomatic) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'US Diplomatic Context', bold: true, size: 20 })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: m.diplomatic, size: 18 })] }));
  }

  if (m.scoreLines.length > 0) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Score Rationale', bold: true, size: 20 })] }));
    for (const line of m.scoreLines) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${line}`, size: 16 })] }));
    }
  }

  if (m.sources.length > 0) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Sources', bold: true, size: 20 })] }));
    for (const s of m.sources) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${s.label} — ${s.url}`, size: 16, color: '444444' })] }));
    }
  }

  children.push(new Paragraph({ text: '' }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated ${m.generated} · All claims carry stored provenance in the monitor`, color: '999999', size: 14 })],
  }));

  const doc = new Document({ sections: [{ children: children as never }] });
  return (await Packer.toBuffer(doc)) as Buffer;
}

export async function buildMemoPdf(deal: Deal): Promise<Buffer> {
  const m = buildMemoModel(deal);
  const PDFDocument = (await import('pdfkit')).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#888888').text('BRIEFING MEMO — ECONOMIC STATECRAFT MONITOR');
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111111').text(m.title);
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(m.metaLine);
    doc.moveDown(0.8);

    for (const [k, v] of m.factRows) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text(`${k}: `, { continued: true });
      doc.font('Helvetica').fillColor('#222222').text(v);
    }

    const section = (title: string) => {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(title);
      doc.moveDown(0.15);
    };

    if (m.signals.length > 0) {
      section('Spatial Signals');
      for (const [label, reason] of m.signals) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text(`• ${label}: `, { continued: true });
        doc.font('Helvetica').fillColor('#222222').text(reason);
      }
    }
    if (m.summary) {
      section('Executive Summary');
      doc.font('Helvetica').fontSize(9).fillColor('#222222').text(m.summary);
    }
    if (m.diplomatic) {
      section('US Diplomatic Context');
      doc.font('Helvetica').fontSize(9).fillColor('#222222').text(m.diplomatic);
    }
    if (m.scoreLines.length > 0) {
      section('Score Rationale');
      for (const line of m.scoreLines) {
        doc.font('Helvetica').fontSize(8.5).fillColor('#222222').text(`• ${line}`);
      }
    }
    if (m.sources.length > 0) {
      section('Sources');
      for (const s of m.sources) {
        doc.font('Helvetica').fontSize(8).fillColor('#444444').text(`• ${s.label} — ${s.url}`);
      }
    }

    doc.moveDown(0.8);
    doc.font('Helvetica').fontSize(7.5).fillColor('#999999')
      .text(`Generated ${m.generated} · All claims carry stored provenance in the monitor`);

    doc.end();
  });
}
