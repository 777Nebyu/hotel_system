import ExcelJS from 'exceljs';
import type { ReportDocument, ReportRow } from './types';

export class ExcelReportExporter {
  readonly format = 'excel' as const;

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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LuxStay Hospitality System';
    workbook.created = new Date();

    // ── Sheet 1: Executive Summary ────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Executive Summary', {
      views: [{ showGridLines: true }],
    });

    // Brand Title Banner
    summarySheet.mergeCells('B2:F2');
    const brandCell = summarySheet.getCell('B2');
    brandCell.value = 'LUXSTAY RESORTS & HOSPITALITY PLATFORM';
    brandCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    brandCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F2942' },
    };
    brandCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(2).height = 24;

    // Report Title Banner
    summarySheet.mergeCells('B3:F3');
    const titleCell = summarySheet.getCell('B3');
    titleCell.value = docMeta.title;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F2942' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(3).height = 28;

    // Metadata Table
    const metaEntries = [
      ['Scope', docMeta.scopeName],
      ['Timeframe', `${docMeta.periodLabel} Report`],
      ['Date Range', docMeta.dateRange],
      ['Generated On', docMeta.generatedAt],
    ];

    let metaRowIdx = 5;
    metaEntries.forEach(([label, val]) => {
      const labelCell = summarySheet.getCell(`B${metaRowIdx}`);
      const valCell = summarySheet.getCell(`C${metaRowIdx}`);

      labelCell.value = label;
      labelCell.font = { bold: true, color: { argb: 'FF64748B' } };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };

      valCell.value = val;
      valCell.font = { bold: true, color: { argb: 'FF0F172A' } };

      metaRowIdx++;
    });

    // KPI Summary Section
    if (docMeta.kpiCards && docMeta.kpiCards.length > 0) {
      const kpiStartRow = metaRowIdx + 2;
      summarySheet.mergeCells(`B${kpiStartRow}:D${kpiStartRow}`);
      const kpiHeader = summarySheet.getCell(`B${kpiStartRow}`);
      kpiHeader.value = 'KEY PERFORMANCE INDICATORS (KPIs)';
      kpiHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      kpiHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3E62' },
      };
      summarySheet.getRow(kpiStartRow).height = 22;

      let cardRow = kpiStartRow + 1;
      docMeta.kpiCards.forEach((kpi) => {
        const lbl = summarySheet.getCell(`B${cardRow}`);
        const val = summarySheet.getCell(`C${cardRow}`);
        const sub = summarySheet.getCell(`D${cardRow}`);

        lbl.value = kpi.label;
        lbl.font = { bold: true, color: { argb: 'FF334155' } };

        val.value = kpi.value;
        val.font = { bold: true, color: { argb: 'FF0F2942' }, size: 12 };
        val.alignment = { horizontal: 'right' };

        sub.value = kpi.subtext ?? '';
        sub.font = { italic: true, color: { argb: 'FF94A3B8' } };

        cardRow++;
      });
    }

    summarySheet.getColumn('B').width = 28;
    summarySheet.getColumn('C').width = 30;
    summarySheet.getColumn('D').width = 26;

    // ── Sheets 2+: Sections / Data Tables ─────────────────────────────────
    docMeta.sections.forEach((section, sIdx) => {
      const sheetName = this.sanitizeSheetName(
        section.title || `Data Section ${sIdx + 1}`,
      );
      const dataSheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
      });

      const rows = section.rows;
      if (rows.length === 0) {
        dataSheet.getCell('A1').value = 'No records found for this period.';
        return;
      }

      const rawKeys = Object.keys(rows[0]);
      const columns =
        section.columns && section.columns.length > 0
          ? section.columns
          : rawKeys.map((key) => ({
              key,
              header: this.headerFor(key),
            }));

      dataSheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: 22,
      }));

      // Style header row
      const headerRow = dataSheet.getRow(1);
      headerRow.height = 24;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F2942' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add rows
      rows.forEach((row, rIdx) => {
        const addedRow = dataSheet.addRow(row);
        addedRow.height = 19;
        addedRow.alignment = { vertical: 'middle' };

        // Subtle alternating shading
        if (rIdx % 2 === 1) {
          addedRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      });

      // Auto-fit column widths
      columns.forEach((col, colIdx) => {
        let maxLen = col.header.length + 4;
        rows.forEach((r) => {
          const val = r[col.key];
          const len = val !== null && val !== undefined ? String(val).length + 3 : 0;
          if (len > maxLen) maxLen = len;
        });
        const currentCol = dataSheet.getColumn(colIdx + 1);
        currentCol.width = Math.min(Math.max(maxLen, 14), 45);
      });

      // Enable AutoFilter
      dataSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: rows.length + 1, column: columns.length },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private headerFor(column: string): string {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());
  }

  private sanitizeSheetName(name: string): string {
    const cleaned = name.replace(/[*?:/\\\[\]]/g, '').slice(0, 30).trim();
    return cleaned || 'Report';
  }
}
