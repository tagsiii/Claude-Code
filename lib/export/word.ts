import type { Deal, ExportConfig } from '../types';
import { resolveFields, cellString } from './fields';
import { formatSector, formatStage } from '../utils/format';

const SCORE_DIMS = [
  ['likelihood', 'Likelihood to Close'],
  ['actionability', 'US Actionability'],
  ['financing', 'Financing Certainty'],
  ['corroboration', 'Source Corroboration'],
  ['strategic_priority', 'Strategic Priority'],
] as const;

// Build a .docx report from the selected deals + config.
export async function buildDocx(deals: Deal[], config: ExportConfig): Promise<Buffer> {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle,
  } = docx;

  const gridFields = resolveFields(config.columns).filter((f) => !f.longText);
  const title = config.title?.trim() || 'Economic Statecraft — Transaction Report';

  const HEADER_FILL = 'F2F2F4';
  const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
  const cellBorders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

  const headerCells = gridFields.map(
    (f) =>
      new TableCell({
        shading: { fill: HEADER_FILL },
        borders: cellBorders,
        children: [new Paragraph({ children: [new TextRun({ text: f.label, bold: true, size: 16 })] })],
      })
  );

  const bodyRows = deals.map(
    (d) =>
      new TableRow({
        children: gridFields.map(
          (f) =>
            new TableCell({
              borders: cellBorders,
              children: [
                new Paragraph({
                  alignment: f.numeric ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  children: [new TextRun({ text: cellString(f.get(d)), size: 16 })],
                }),
              ],
            })
        ),
      })
  );

  const children: InstanceType<typeof Paragraph>[] | unknown[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${deals.length} transaction${deals.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleString()}`,
          color: '888888',
          size: 18,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyRows],
    }),
  ];

  // Per-deal narrative sections
  const wantNarrative = config.includeSummary || config.includeDiplomatic || config.includeScoreBreakdown;
  if (wantNarrative) {
    children.push(new Paragraph({ text: '' }));
    children.push(new Paragraph({ text: 'Detailed Briefs', heading: HeadingLevel.HEADING_1 }));

    for (const d of deals) {
      children.push(new Paragraph({ text: d.title, heading: HeadingLevel.HEADING_2 }));
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${d.sponsoring_state ?? 'Unknown sponsor'} · ${d.host_country ?? 'Unknown country'} · ${formatSector(d.sector)} · ${formatStage(d.lifecycle_stage)} · Score ${d.composite_score?.toFixed(0) ?? '—'}`,
              color: '666666',
              size: 16,
            }),
          ],
        })
      );

      if (config.includeSummary && d.executive_summary) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Executive Summary', bold: true, size: 18 })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: d.executive_summary, size: 18 })] }));
      }
      if (config.includeDiplomatic && d.us_diplomatic_context) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'US Diplomatic Context', bold: true, size: 18 })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: d.us_diplomatic_context, size: 18 })] }));
      }
      if (config.includeScoreBreakdown && d.score_breakdown) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Score Breakdown', bold: true, size: 18 })] }));
        for (const [key, label] of SCORE_DIMS) {
          const sub = d.score_breakdown[key];
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label} (${sub.score}/100, weight ${(sub.weight * 100).toFixed(0)}%): `, bold: true, size: 16 }),
                new TextRun({ text: sub.reasoning, size: 16 }),
              ],
            })
          );
        }
      }
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({ sections: [{ children: children as never }] });
  return (await Packer.toBuffer(doc)) as Buffer;
}
