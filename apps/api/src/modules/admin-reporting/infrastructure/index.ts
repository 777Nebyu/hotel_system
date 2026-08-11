export interface ReportExporter {
  export(format: 'pdf' | 'excel', rows: unknown[]): Promise<Buffer>;
}
