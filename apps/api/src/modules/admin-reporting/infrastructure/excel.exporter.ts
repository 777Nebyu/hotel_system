import ExcelJS from 'exceljs';

type ReportRow = Record<string, unknown>;

export class ExcelReportExporter {
  readonly format = 'excel' as const;

  async export(title: string, rows: ReportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');

    const columns = Object.keys(rows[0] ?? {});
    if (columns.length > 0) {
      sheet.columns = columns.map((key) => ({
        header: this.headerFor(key),
        key,
        width: 24,
      }));
    }
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };

    for (const row of rows) {
      sheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private headerFor(column: string): string {
    return column
      .replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)
      .replace(/(^|\s)\w/g, (m) => m.toUpperCase());
  }
}
