export type ReportRow = Record<string, unknown>;

export interface ReportKpiCard {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface ReportSectionColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface ReportSection {
  title: string;
  description?: string;
  rows: ReportRow[];
  columns?: ReportSectionColumn[];
}

export interface ReportDocument {
  title: string;
  subtitle?: string;
  scopeName: string; // e.g. "Platform Administration" or "Grand Skylight Hotel Addis"
  periodLabel: string; // "Daily", "Weekly", "Monthly", "Yearly"
  dateRange: string; // "Sep 14, 2026 – Sep 21, 2026"
  generatedAt: string;
  kpiCards?: ReportKpiCard[];
  sections: ReportSection[];
}
