'use client';

import React, { useEffect, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReportPDF } from './ReportPDF';

interface DownloadProps {
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

export default function DownloadReportButton({ filename, findings, manualReview, riskAnalysis }: DownloadProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <button className="btn-download" disabled>
        Preparing PDF Engine...
      </button>
    );
  }

  // Generate safe filename for PDF
  const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const baseName = cleanFilename.substring(0, cleanFilename.lastIndexOf('.')) || cleanFilename;
  const pdfName = `quantum_shield_${baseName}.pdf`;

  return (
    <PDFDownloadLink
      document={
        <ReportPDF
          filename={filename}
          findings={findings}
          manualReview={manualReview}
          riskAnalysis={riskAnalysis}
        />
      }
      fileName={pdfName}
    >
      {({ blob, url, loading, error }) => {
        if (loading) {
          return (
            <button className="btn-download" disabled style={{ opacity: 0.8, cursor: 'wait' }}>
              Compiling Report...
            </button>
          );
        }
        if (error) {
          console.error('PDF Generation Error:', error);
          return <button className="btn-download">Error Generating PDF</button>;
        }
        return (
          <button className="btn-download">
            <svg
              style={{ width: '1.25rem', height: '1.25rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download Compliance Report
          </button>
        );
      }}
    </PDFDownloadLink>
  );
}
