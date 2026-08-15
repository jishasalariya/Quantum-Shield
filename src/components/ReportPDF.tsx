import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register standard fonts
Font.register({
  family: 'Courier-Bold',
  src: 'https://fonts.gstatic.com/s/courierprime/v9/u-450pyZ2ylyFDoac7zB1q32yvx2.ttf' // Fallback to standard monospaced
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155'
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#0ea5e9',
    paddingBottom: 15,
    marginBottom: 25,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch'
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'column'
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4
  },
  badgePqc: {
    fontSize: 8,
    backgroundColor: '#f0f9ff',
    color: '#0284c7',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    textTransform: 'uppercase'
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  grid: {
    display: 'flex',
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  riskBadge: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textTransform: 'uppercase'
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 25,
    alignItems: 'center',
    paddingHorizontal: 8
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    borderBottomColor: '#cbd5e1'
  },
  tableCellHeader: {
    fontWeight: 'bold',
    color: '#475569'
  },
  col1: { width: '10%' },
  col2: { width: '25%' },
  col3: { width: '15%' },
  col4: { width: '50%' },
  
  findingCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20
  },
  findingHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  findingTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  severityBadge: {
    fontSize: 8,
    fontWeight: 'bold',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: 'uppercase'
  },
  explanation: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 1.4
  },
  codeBlock: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 10
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 7.5,
    color: '#0f172a',
    lineHeight: 1.3
  },
  codeHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  remediationMeta: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#0369a1',
    textTransform: 'uppercase'
  },
  metaValue: {
    fontSize: 8,
    color: '#0c4a6e',
    fontWeight: 'bold',
    marginTop: 1
  },
  metaNotes: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e0f2fe',
    paddingTop: 6,
    marginTop: 6
  },
  warningFooter: {
    fontSize: 7.5,
    color: '#d97706',
    fontStyle: 'italic',
    marginTop: 15,
    textAlign: 'center'
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8
  }
});

interface FindingReportProps {
  filename: string;
  findings: any[];
  manualReview: any[];
  riskAnalysis: {
    highCount: number;
    mediumCount: number;
    lowCount: number;
    aggregateScore: number;
    riskLevel: string;
  };
}

export const ReportPDF: React.FC<FindingReportProps> = ({
  filename,
  findings,
  manualReview,
  riskAnalysis
}) => {
  const getRiskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#10b981';
      default: return '#64748b';
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'HIGH': return '#fef2f2';
      case 'MEDIUM': return '#fffbeb';
      case 'LOW': return '#ecfdf5';
      default: return '#f8fafc';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#d97706';
      case 'LOW': return '#059669';
      default: return '#64748b';
    }
  };

  const getSeverityBgColor = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'HIGH': return '#fef2f2';
      case 'MEDIUM': return '#fffbeb';
      case 'LOW': return '#ecfdf5';
      default: return '#f8fafc';
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Quantum Shield</Text>
            <Text style={styles.subtitle}>Cryptographic Analysis & Post-Quantum Compliance Report</Text>
          </View>
          <Text style={styles.badgePqc}>NIST PQC Standard Ready</Text>
        </View>

        {/* Overview section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview & Risk Assessment</Text>
          <View style={styles.grid}>
            {/* Risk Card */}
            <View style={[styles.metricCard, { backgroundColor: getRiskBgColor(riskAnalysis.riskLevel), borderColor: getRiskColor(riskAnalysis.riskLevel) }]}>
              <Text style={styles.metricLabel}>Overall Risk Level</Text>
              <Text style={[styles.metricValue, { color: getRiskColor(riskAnalysis.riskLevel) }]}>{riskAnalysis.riskLevel}</Text>
              <Text style={styles.subtitle}>Based on active classic crypto calls</Text>
            </View>

            {/* Score Card */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Risk Score</Text>
              <Text style={styles.metricValue}>{riskAnalysis.aggregateScore}</Text>
              <Text style={styles.subtitle}>Quantum susceptibility index</Text>
            </View>

            {/* Severity Stats Card */}
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Findings Count</Text>
              <Text style={styles.metricValue}>{findings.length}</Text>
              <Text style={styles.subtitle}>
                {riskAnalysis.highCount} H | {riskAnalysis.mediumCount} M | {riskAnalysis.lowCount} L
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 9, color: '#64748b', marginBottom: 5 }}>
            Target File: {filename}
          </Text>
        </View>

        {/* Findings Summary Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vulnerabilities Summary</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.col1, styles.tableCellHeader]}>Line</Text>
              <Text style={[styles.col2, styles.tableCellHeader]}>Algorithm</Text>
              <Text style={[styles.col3, styles.tableCellHeader]}>Severity</Text>
              <Text style={[styles.col4, styles.tableCellHeader]}>Vulnerable Call</Text>
            </View>

            {findings.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={{ width: '100%', textAlign: 'center', color: '#10b981', fontWeight: 'bold', paddingVertical: 10 }}>
                  No classical cryptography vulnerabilities detected.
                </Text>
              </View>
            ) : (
              findings.map((f, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.col1}>{f.lineRange[0]}</Text>
                  <Text style={[styles.col2, { fontWeight: 'bold' }]}>{f.algorithm}</Text>
                  <Text style={[styles.col3, { color: getSeverityColor(f.severity), fontWeight: 'bold' }]}>{f.severity}</Text>
                  <Text style={[styles.col4, { fontFamily: 'Courier', fontSize: 8 }]}>{f.matchedPattern}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Manual Review Items if any */}
        {manualReview && manualReview.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Flagged for Manual Review</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.col1, styles.tableCellHeader]}>Line</Text>
                <Text style={[styles.col2, styles.tableCellHeader]}>Algorithm</Text>
                <Text style={[styles.col3, styles.tableCellHeader]}>Flagged As</Text>
                <Text style={[styles.col4, styles.tableCellHeader]}>Reason for Review</Text>
              </View>
              {manualReview.map((f, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.col1}>{f.lineRange[0]}</Text>
                  <Text style={styles.col2}>{f.algorithm}</Text>
                  <Text style={styles.col3}>Uncertain</Text>
                  <Text style={styles.col4}>{f.explanation}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Quantum Shield Compliance Report | Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>

      {/* Detailed findings pages */}
      {findings.map((f, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Vulnerability Detail</Text>
              <Text style={styles.subtitle}>Finding #{i + 1} — Target Line {f.lineRange[0]}</Text>
            </View>
            <Text style={[styles.severityBadge, { backgroundColor: getSeverityBgColor(f.severity), color: getSeverityColor(f.severity), borderWidth: 1, borderColor: getSeverityColor(f.severity) }]}>
              {f.severity} Severity
            </Text>
          </View>

          {/* Explanation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analysis</Text>
            <Text style={styles.explanation}>{f.explanation}</Text>
          </View>

          {/* Original Code */}
          <View style={styles.section}>
            <Text style={styles.codeHeader}>Original Insecure Code (Line {f.lineRange[0]})</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>{f.snippet}</Text>
            </View>
          </View>

          {/* Suggested Remediation */}
          {f.remediation && (
            <View style={styles.section}>
              <Text style={[styles.codeHeader, { color: '#059669' }]}>NIST-Approved Post-Quantum Replacement</Text>
              <View style={[styles.codeBlock, { borderColor: '#10b981' }]}>
                <Text style={[styles.codeText, { color: '#0f172a' }]}>{f.remediation.replacement_code}</Text>
              </View>

              {/* Remediation Metadata */}
              <View style={styles.remediationMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>NIST Standard</Text>
                  <Text style={styles.metaValue}>{f.remediation.nist_standard}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Parameter Set</Text>
                  <Text style={styles.metaValue}>{f.remediation.parameter_set}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Established Library</Text>
                  <Text style={styles.metaValue}>{f.remediation.library_used}</Text>
                </View>

                {f.remediation.notes && (
                  <View style={styles.metaNotes}>
                    <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Remediation Notes</Text>
                    <Text style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>{f.remediation.notes}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Text style={styles.warningFooter}>
            AI-generated suggestions per {f.remediation?.nist_standard || 'NIST Standard'} — review and test before use.
          </Text>

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Quantum Shield Compliance Report | Page ${pageNumber} of ${totalPages}`} fixed />
        </Page>
      ))}
    </Document>
  );
};
