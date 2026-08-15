import { NextResponse } from 'next/server';
import { scanCode } from '@/lib/detector';
import { analyzeFinding } from '@/lib/llm';
import { generateRemediation } from '@/lib/llm';
import { analyzeRisk } from '@/lib/scorer';

export async function POST(request: Request) {
  try {
    let code = '';
    let filename = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      code = await file.text();
      filename = file.name;
    } else {
      const body = await request.json();
      code = body.code;
      filename = body.filename;
    }

    if (code && typeof code === 'object' && 'value' in code) {
      code = (code as any).value;
    }

    if (Array.isArray(code)) {
      code = code.join('\n');
    } else if (typeof code !== 'string') {
      code = String(code || '');
    }

    if (!code || !filename) {
      return NextResponse.json({ error: 'Missing code or filename' }, { status: 400 });
    }

    console.log('Received payload:', { typeofCode: typeof code, typeofFilename: typeof filename, filename });
    // Step 1: Run Web-Tree-Sitter Static Detector
    const staticFindings = await scanCode(code, filename);
    if (staticFindings.length === 0) {
      return NextResponse.json({
        success: true,
        filename,
        riskAnalysis: {
          findings: [],
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          aggregateScore: 0,
          riskLevel: 'Low'
        },
        manualReview: []
      });
    }

    // Step 2: Call LLM Analyzer in parallel to confirm findings
    const confirmedResults = await Promise.all(
      staticFindings.map(async (finding) => {
        try {
          return await analyzeFinding(finding);
        } catch (err) {
          console.error(`Error analyzing finding on lines ${finding.lineRange.join('-')}:`, err);
          return {
            ...finding,
            confirmed: true, // Default to true on failure to avoid missing real vulnerabilities
            explanation: 'Automatically flagged classic crypto pattern.',
            confidence: 0.5
          };
        }
      })
    );

    // Filter results:
    // - confirmed: confirmed is true AND confidence is >= 0.5
    // - manual review: confidence is < 0.5
    // - false positive: confirmed is false
    const confirmedFindings = confirmedResults.filter(r => r.confirmed && r.confidence >= 0.5);
    const manualReviewFindings = confirmedResults.filter(r => r.confidence < 0.5).map(f => ({
      ...f,
      severity: 'Low' as const // default severity for manual review
    }));

    // Step 3: Run Transformation Engine in parallel for confirmed findings
    const remediatedFindings = await Promise.all(
      confirmedFindings.map(async (finding) => {
        // Map to scored format for severity helper
        const severity = (finding.usageType === 'keygen' || finding.usageType === 'encryption' || finding.usageType === 'signature') 
          ? 'High' as const 
          : (finding.usageType === 'import' ? 'Medium' as const : 'Low' as const);

        const scoredFinding = { ...finding, severity };

        try {
          const remediation = await generateRemediation(scoredFinding, filename);
          return {
            ...scoredFinding,
            remediation
          };
        } catch (err) {
          console.error(`Error remediating lines ${finding.lineRange.join('-')}:`, err);
          return {
            ...scoredFinding,
            remediation: {
              replacement_code: '// Failed to generate remediation automatically.',
              nist_standard: 'N/A',
              parameter_set: 'N/A',
              library_used: 'N/A',
              notes: 'LLM invocation failed during code generation.'
            }
          };
        }
      })
    );

    // Step 4: Calculate Risk Score
    const riskAnalysis = analyzeRisk(remediatedFindings);

    return NextResponse.json({
      success: true,
      filename,
      riskAnalysis,
      manualReview: manualReviewFindings
    });

  } catch (error: any) {
    console.error('Scan API handler error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
