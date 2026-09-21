import { PdfReportExporter } from './pdf.exporter';
import { ExcelReportExporter } from './excel.exporter';
import type { ReportDocument, ReportRow } from './types';

export type {
  ReportRow,
  ReportKpiCard,
  ReportSection,
  ReportSectionColumn,
  ReportDocument,
} from './types';

export interface ReportExporter {
  readonly format: 'pdf' | 'excel';
  export(
    docOrTitle: ReportDocument | string,
    maybeRows?: ReportRow[],
  ): Promise<Buffer>;
}

export type ReportFormat = 'pdf' | 'excel';

export function exporterFor(format: ReportFormat): ReportExporter {
  return format === 'excel'
    ? new ExcelReportExporter()
    : new PdfReportExporter();
}
