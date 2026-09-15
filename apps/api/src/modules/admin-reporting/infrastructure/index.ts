import { PdfReportExporter } from './pdf.exporter';
import { ExcelReportExporter } from './excel.exporter';

export type { ReportRow } from './types';

export interface ReportExporter {
  readonly format: 'pdf' | 'excel';
  export(title: string, rows: Record<string, unknown>[]): Promise<Buffer>;
}

export type ReportFormat = 'pdf' | 'excel';

export function exporterFor(format: ReportFormat): ReportExporter {
  return format === 'excel'
    ? new ExcelReportExporter()
    : new PdfReportExporter();
}
