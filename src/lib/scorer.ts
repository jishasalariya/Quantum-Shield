export interface ScoredFinding {
  lineRange: [number, number];
  matchedPattern: string;
  snippet: string;
  algorithm: string;
  usageType: string;
  confirmed: boolean;
  explanation: string;
  confidence: number;
  severity: 'High' | 'Medium' | 'Low';
}

export interface RiskAnalysis {
  findings: ScoredFinding[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  aggregateScore: number;
  riskLevel: 'High' | 'Medium' | 'Low';
}

export function classifySeverity(usageType: string, confirmed: boolean): 'High' | 'Medium' | 'Low' {
  if (!confirmed) return 'Low'; // Non-confirmed findings shouldn't count, but default to Low if evaluated

  const type = usageType.toLowerCase();
  if (type === 'keygen' || type === 'encryption' || type === 'signature') {
    return 'High';
  } else if (type === 'import') {
    return 'Medium';
  } else {
    return 'Low';
  }
}

export function analyzeRisk(confirmedFindings: {
  lineRange: [number, number];
  matchedPattern: string;
  snippet: string;
  algorithm: string;
  usageType: string;
  confirmed: boolean;
  explanation: string;
  confidence: number;
}[]): RiskAnalysis {
  // Only score confirmed findings
  const activeFindings = confirmedFindings.filter(f => f.confirmed);

  const scoredFindings: ScoredFinding[] = activeFindings.map(f => {
    const severity = classifySeverity(f.usageType, f.confirmed);
    return {
      ...f,
      severity
    };
  });

  const highCount = scoredFindings.filter(f => f.severity === 'High').length;
  const mediumCount = scoredFindings.filter(f => f.severity === 'Medium').length;
  const lowCount = scoredFindings.filter(f => f.severity === 'Low').length;

  const aggregateScore = (15 * highCount) + (8 * mediumCount) + (5 * lowCount);

  let riskLevel: 'High' | 'Medium' | 'Low' = 'Low';
  if (aggregateScore >= 70) {
    riskLevel = 'High';
  } else if (aggregateScore >= 40) {
    riskLevel = 'Medium';
  }

  return {
    findings: scoredFindings,
    highCount,
    mediumCount,
    lowCount,
    aggregateScore,
    riskLevel
  };
}
