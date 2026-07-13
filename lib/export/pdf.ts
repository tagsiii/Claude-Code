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

// Build a PDF briefing from the selected deals + config. Renders as a scannable
// list (one block per deal) rather than a wide grid, matching the app's brief format.
export async function buildPdf(deals: Deal[], config: ExportConfig): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const gridFields = resolveFields(config.columns).filter((f) => !f.longText);
  const title = config.title?.trim() || 'Economic Statecraft — Transaction Report';

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const wantNarrative =
      config.includeSummary || config.includeDiplomatic || config.includeScoreBreakdown;

    // Header
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#111111').text(title);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#777777')
      .text(`${deals.length} transaction${deals.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleString()}`);
    doc.moveDown(1);

    deals.forEach((d, i) => {
      // Start a new page if there is little room left for at least a heading.
      if (doc.y > doc.page.height - 120) doc.addPage();

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(`${i + 1}. ${d.title}`);

      // Key fields line
      const parts = gridFields
        .filter((f) => f.key !== 'title')
        .map((f) => `${f.label}: ${cellString(f.get(d))}`);
      if (parts.length) {
        doc.font('Helvetica').fontSize(9).fillColor('#555555').text(parts.join('   ·   '));
      }

      if (config.includeSummary && d.executive_summary) {
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('Executive Summary');
        doc.font('Helvetica').fontSize(9).fillColor('#222222').text(d.executive_summary, { align: 'left' });
      }
      if (config.includeDiplomatic && d.us_diplomatic_context) {
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('US Diplomatic Context');
        doc.font('Helvetica').fontSize(9).fillColor('#222222').text(d.us_diplomatic_context);
      }
      if (config.includeScoreBreakdown && d.score_breakdown) {
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('Score Breakdown');
        for (const [key, label] of SCORE_DIMS) {
          const sub = d.score_breakdown[key];
          doc.font('Helvetica').fontSize(9).fillColor('#222222');
          doc.text(`• ${label} (${sub.score}/100, ${(sub.weight * 100).toFixed(0)}%): ${sub.reasoning}`);
        }
      }

      doc.moveDown(0.9);
    });

    if (!wantNarrative && deals.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor('#777777').text('No transactions match the current filters.');
    }

    doc.end();
  });
}
