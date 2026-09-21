import PDFDocument from 'pdfkit';
import type { ReportDocument, ReportKpiCard, ReportRow, ReportSection } from './types';

const toCell = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return JSON.stringify(value);
  }
  return String(value);
};

export class PdfReportExporter {
  readonly format = 'pdf' as const;

  async export(
    docOrTitle: ReportDocument | string,
    maybeRows?: ReportRow[],
  ): Promise<Buffer> {
    const docMeta: ReportDocument =
      typeof docOrTitle === 'string'
        ? {
            title: docOrTitle,
            scopeName: 'LuxStay System',
            periodLabel: 'Standard Report',
            dateRange: new Date().toISOString().slice(0, 10),
            generatedAt: new Date().toLocaleString(),
            sections: [
              {
                title: 'Data Records',
                rows: maybeRows ?? [],
              },
            ],
          }
        : docOrTitle;

    // Buffer collection
    const pdfDoc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 36;
    const contentWidth = pageWidth - margin * 2; // 523.28

    // ── 1. Header Banner ──────────────────────────────────────────────────
    this.renderHeader(pdfDoc, docMeta, contentWidth, margin);

    // ── 2. KPI Summary Cards ──────────────────────────────────────────────
    if (docMeta.kpiCards && docMeta.kpiCards.length > 0) {
      this.renderKpiCards(pdfDoc, docMeta.kpiCards, contentWidth, margin);
    }

    // ── 3. Data Sections & Tables ─────────────────────────────────────────
    for (const section of docMeta.sections) {
      this.renderSection(pdfDoc, section, contentWidth, margin, pageHeight);
    }

    // ── 4. Footers with Page Numbers across all buffered pages ────────────
    const totalPages = pdfDoc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      pdfDoc.switchToPage(i);
      this.renderFooter(pdfDoc, i + 1, totalPages, contentWidth, margin, pageHeight);
    }

    pdfDoc.end();
    return done;
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    meta: ReportDocument,
    contentWidth: number,
    margin: number,
  ) {
    const bannerHeight = 58;
    // Dark Sapphire header block
    doc
      .rect(margin, margin, contentWidth, bannerHeight)
      .fill('#0F2942');

    // Gold accent line
    doc
      .rect(margin, margin + bannerHeight, contentWidth, 3)
      .fill('#D4AF37');

    // Brand tag
    doc
      .fillColor('#D4AF37')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('LUXSTAY RESORTS & HOSPITALITY PLATFORM', margin + 14, margin + 10, {
        characterSpacing: 1.2,
      });

    // Report Title
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(meta.title, margin + 14, margin + 24, { width: contentWidth - 140 });

    // Period Badge on top right
    const badgeText = `${meta.periodLabel.toUpperCase()} REPORT`;
    const badgeWidth = 110;
    const badgeX = margin + contentWidth - badgeWidth - 14;
    doc
      .roundedRect(badgeX, margin + 14, badgeWidth, 22, 4)
      .fill('#1E3E62');

    doc
      .fillColor('#F1F5F9')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(badgeText, badgeX, margin + 20, {
        width: badgeWidth,
        align: 'center',
      });

    // Metadata Sub-bar
    const subBarY = margin + bannerHeight + 9;
    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8)
      .text(`Scope: `, margin, subBarY, { continued: true })
      .font('Helvetica-Bold')
      .text(`${meta.scopeName}    `, { continued: true })
      .font('Helvetica')
      .text(`Period: `, { continued: true })
      .font('Helvetica-Bold')
      .text(`${meta.dateRange}    `, { continued: true })
      .font('Helvetica')
      .text(`Generated: `, { continued: true })
      .font('Helvetica-Bold')
      .text(`${meta.generatedAt}`);

    doc.y = subBarY + 16;
  }

  private renderKpiCards(
    doc: PDFKit.PDFDocument,
    cards: ReportKpiCard[],
    contentWidth: number,
    margin: number,
  ) {
    const cardCount = Math.min(cards.length, 4);
    const gap = 10;
    const cardWidth = (contentWidth - gap * (cardCount - 1)) / cardCount;
    const cardHeight = 46;
    const startY = doc.y + 4;

    cards.slice(0, cardCount).forEach((card, idx) => {
      const cardX = margin + idx * (cardWidth + gap);

      // Box background & border
      doc
        .roundedRect(cardX, startY, cardWidth, cardHeight, 6)
        .fillAndStroke('#F8FAFC', '#E2E8F0');

      // Top label
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(card.label.toUpperCase(), cardX + 8, startY + 7, {
          width: cardWidth - 16,
          characterSpacing: 0.5,
        });

      // KPI Value
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(String(card.value), cardX + 8, startY + 18, {
          width: cardWidth - 16,
        });

      // Subtext
      if (card.subtext) {
        doc
          .fillColor('#94A3B8')
          .font('Helvetica')
          .fontSize(6.5)
          .text(card.subtext, cardX + 8, startY + 34, {
            width: cardWidth - 16,
          });
      }
    });

    doc.y = startY + cardHeight + 14;
  }

  private renderSection(
    doc: PDFKit.PDFDocument,
    section: ReportSection,
    contentWidth: number,
    margin: number,
    pageHeight: number,
  ) {
    // Check if we need a page break before section header
    if (doc.y > pageHeight - 120) {
      doc.addPage();
      doc.y = margin;
    }

    // Section Title
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(section.title, margin, doc.y);

    if (section.description) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8)
        .text(section.description, margin, doc.y + 2);
      doc.y += 4;
    }

    doc.y += 8;

    const rows = section.rows;
    if (rows.length === 0) {
      doc
        .roundedRect(margin, doc.y, contentWidth, 30, 4)
        .fillAndStroke('#F8FAFC', '#E2E8F0');
      doc
        .fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(8.5)
        .text('No records found for this period.', margin, doc.y + 10, {
          align: 'center',
          width: contentWidth,
        });
      doc.y += 38;
      return;
    }

    // Determine columns
    const rawKeys = Object.keys(rows[0]);
    const columns = (section.columns ?? []).length > 0
      ? section.columns!
      : rawKeys.map((k) => ({
          key: k,
          header: this.headerFor(k),
          align: this.inferAlign(k) as 'left' | 'right' | 'center',
        }));

    // Calculate column widths proportional to content
    const colCount = columns.length;
    const defaultColWidth = contentWidth / colCount;
    const colWidths: number[] = columns.map((col) => col.width ?? defaultColWidth);

    // Normalize widths so total equals contentWidth
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const scale = contentWidth / totalW;
    const widths = colWidths.map((w) => Math.floor(w * scale));

    const rowHeight = 18;
    const headerHeight = 20;

    // Helper: Draw Table Header
    const drawTableHeader = (y: number) => {
      doc
        .rect(margin, y, contentWidth, headerHeight)
        .fill('#0F2942');

      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
      let currentX = margin;
      columns.forEach((col, i) => {
        const w = widths[i];
        const align = col.align ?? 'left';
        doc.text(col.header.toUpperCase(), currentX + 6, y + 6, {
          width: w - 12,
          align,
        });
        currentX += w;
      });
    };

    // Draw initial header
    let currentY = doc.y;
    drawTableHeader(currentY);
    currentY += headerHeight;

    // Draw rows
    doc.font('Helvetica').fontSize(7.5);
    rows.forEach((row, rowIdx) => {
      // Check page overflow
      if (currentY + rowHeight > pageHeight - 50) {
        doc.addPage();
        currentY = margin;
        drawTableHeader(currentY);
        currentY += headerHeight;
        doc.font('Helvetica').fontSize(7.5);
      }

      // Zebra striping
      const bg = rowIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(margin, currentY, contentWidth, rowHeight).fill(bg);

      // Subtle bottom line
      doc
        .moveTo(margin, currentY + rowHeight)
        .lineTo(margin + contentWidth, currentY + rowHeight)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();

      // Render cell text
      let cellX = margin;
      columns.forEach((col, i) => {
        const w = widths[i];
        const rawVal = row[col.key];
        const cellText = toCell(rawVal);
        const align = col.align ?? (this.inferAlign(col.key) as 'left' | 'right' | 'center');

        doc
          .fillColor('#1E293B')
          .text(cellText, cellX + 6, currentY + 5, {
            width: w - 12,
            align,
            ellipsis: true,
          });
        cellX += w;
      });

      currentY += rowHeight;
    });

    doc.y = currentY + 16;
  }

  private renderFooter(
    doc: PDFKit.PDFDocument,
    page: number,
    total: number,
    contentWidth: number,
    margin: number,
    pageHeight: number,
  ) {
    const footerY = pageHeight - 28;

    doc
      .moveTo(margin, footerY - 4)
      .lineTo(margin + contentWidth, footerY - 4)
      .strokeColor('#E2E8F0')
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor('#94A3B8')
      .font('Helvetica')
      .fontSize(7)
      .text('LuxStay Hotel Management System — Official Analytics & Audit Record', margin, footerY);

    doc
      .fillColor('#94A3B8')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(`Page ${page} of ${total}`, margin, footerY, {
        width: contentWidth,
        align: 'right',
      });
  }

  private headerFor(column: string): string {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());
  }

  private inferAlign(key: string): 'left' | 'right' | 'center' {
    const lower = key.toLowerCase();
    if (
      lower.includes('price') ||
      lower.includes('amount') ||
      lower.includes('total') ||
      lower.includes('revenue') ||
      lower.includes('spend') ||
      lower.includes('rate') ||
      lower.includes('count') ||
      lower.includes('occupancy')
    ) {
      return 'right';
    }
    if (lower.includes('date') || lower.includes('status') || lower.includes('ref')) {
      return 'center';
    }
    return 'left';
  }
}
