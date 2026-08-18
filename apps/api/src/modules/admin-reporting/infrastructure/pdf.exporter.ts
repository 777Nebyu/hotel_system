import PDFDocument from 'pdfkit';

type ReportRow = Record<string, unknown>;

const toCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
};

export class PdfReportExporter {
  readonly format = 'pdf' as const;

  async export(title: string, rows: ReportRow[]): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'center' });
    doc.moveDown();

    if (rows.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(11)
        .text('No data available.', { align: 'center' });
      doc.end();
      return done;
    }

    const columns = Object.keys(rows[0]).map((c) => this.headerFor(c));
    const widths: number[] = columns.map(() => 0);
    for (const row of rows) {
      Object.values(row).forEach((value, i) => {
        const cell = toCell(value);
        const estimated = cell.length * 5;
        if (estimated > widths[i]) widths[i] = Math.min(estimated, 140);
      });
    }

    const startY = doc.y + 12;
    let y = startY;
    // header
    doc.font('Helvetica-Bold').fontSize(9);
    let x = 48;
    columns.forEach((col, i) => {
      doc.text(col, x, y, { width: widths[i], height: 18 });
      x += widths[i];
    });
    doc
      .moveTo(48, y + 18)
      .lineTo(548, y + 18)
      .stroke();
    y += 24;

    doc.font('Helvetica').fontSize(8.5);
    for (const row of rows) {
      x = 48;
      const cells = Object.values(row).map(toCell);
      cells.forEach((cell, i) => {
        doc.text(cell, x, y, { width: widths[i] });
        x += widths[i];
      });
      y += 16;
      if (y > 780) {
        doc.addPage();
        y = 60;
      }
    }

    doc.end();
    return done;
  }

  private headerFor(column: string): string {
    return column
      .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
      .replace(/(^|\s)\w/g, (m) => m.toUpperCase());
  }
}
