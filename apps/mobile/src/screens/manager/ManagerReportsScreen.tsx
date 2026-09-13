import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { requestBlob } from '../../api';
import { Button, Card, EmptyState } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadowCard } from '../../theme';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type Props = { onBack: () => void; onNavigate?: (page: { screen: string } & Record<string, any>) => void };

interface ReportType {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  format: 'pdf' | 'excel';
}

const ALL_REPORTS: ReportType[] = [
  { key: 'occupancy', title: 'Occupancy Report', description: 'Room occupancy rates over a selected period', endpoint: '/admin/reports/occupancy', format: 'pdf' },
  { key: 'revenue', title: 'Revenue Report', description: 'Detailed revenue breakdown by room type and period', endpoint: '/admin/reports/revenue', format: 'pdf' },
  { key: 'booking', title: 'Booking Report', description: 'Booking analytics and trends', endpoint: '/admin/reports/booking', format: 'pdf' },
  { key: 'customer', title: 'Guest Analytics', description: 'Guest demographics, repeat visits, and satisfaction', endpoint: '/admin/reports/customer', format: 'pdf' },
  { key: 'cancellation', title: 'Cancellation Report', description: 'Cancellation analytics and patterns', endpoint: '/admin/reports/cancellation', format: 'excel' },
];

// Staff only gets operational reports — no financial (Revenue) per STAFF-005
const STAFF_EXCLUDED = new Set(['revenue']);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ManagerReportsScreen({ onBack, onNavigate }: Props) {
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const userRole = useAppSelector((s) => s.auth.session?.user?.role ?? 'MANAGER');
  const toast = useToast();
  const [generating, setGenerating] = useState<string | null>(null);

  const reports = userRole === 'STAFF'
    ? ALL_REPORTS.filter((r) => !STAFF_EXCLUDED.has(r.key))
    : ALL_REPORTS;

  const generateReport = async (report: ReportType) => {
    setGenerating(report.key);
    try {
      const blob = await requestBlob(`${report.endpoint}?format=${report.format}`, { method: 'GET', token });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const ext = report.format === 'pdf' ? 'pdf' : 'xlsx';
        const file = new File(Paths.document, `report-${report.key}.${ext}`);
        file.write(base64);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: report.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: `Export ${report.title}`,
          });
          toast('success', `${report.title} exported`, `Your ${report.format.toUpperCase()} report has been saved.`);
        } else {
          Alert.alert('Downloaded', `Saved to ${file.uri}`);
        }
      };
      reader.readAsDataURL(new Blob([blob], { type: report.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    } catch (err) {
      toast('error', 'Report failed', err instanceof Error ? err.message : 'Could not generate report');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Reports & Analytics"
        onBack={onBack}
        subtitle="Export performance & guest insights"
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {reports.length === 0 ? (
          <EmptyState title="No reports available" />
        ) : (
          reports.map((report) => (
            <Card key={report.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.reportIconWrap, report.format === 'pdf' ? styles.pdfIconWrap : styles.excelIconWrap]}>
                  <Ionicons
                    name={report.format === 'pdf' ? 'document-text' : 'grid'}
                    size={22}
                    color={report.format === 'pdf' ? colors.teal : colors.goldDeep}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportDesc}>{report.description}</Text>
                </View>
                <View style={[styles.formatBadge, report.format === 'pdf' && styles.formatPdf, report.format === 'excel' && styles.formatExcel]}>
                  <Text style={styles.formatText}>{report.format.toUpperCase()}</Text>
                </View>
              </View>
              <Button
                title={generating === report.key ? 'Generating...' : `Export ${report.format.toUpperCase()}`}
                variant={report.format === 'pdf' ? 'primary' : 'secondary'}
                size="sm"
                loading={generating === report.key}
                onPress={() => generateReport(report)}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 14, gap: 12, padding: 16, borderRadius: radius.card, ...shadowCard },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  reportIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pdfIconWrap: { backgroundColor: colors.tealTint },
  excelIconWrap: { backgroundColor: colors.goldTint },
  flex: { flex: 1 },
  reportTitle: { fontFamily: font.display, fontSize: 17, fontWeight: '700', color: colors.ink },
  reportDesc: { fontSize: 13, color: colors.inkMuted, marginTop: 4, lineHeight: 18 },
  formatBadge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  formatPdf: { backgroundColor: colors.tealTint, borderColor: 'rgba(31,111,100,0.3)' },
  formatExcel: { backgroundColor: colors.goldTint, borderColor: 'rgba(200,138,30,0.3)' },
  formatText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, letterSpacing: 0.5 },
});
