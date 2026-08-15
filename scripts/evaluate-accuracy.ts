import fs from 'fs';
import path from 'path';
import { scanCode } from '../src/lib/detector';

interface ExpectedFinding {
  algorithm: string;
  type: string;
  line_range: [number, number];
}

interface ExpectedJson {
  file: string;
  expected_findings: ExpectedFinding[];
}

interface FailureDetail {
  file: string;
  type: 'miss' | 'false_positive';
  details: string;
}

// Normalizes algorithms to avoid case or naming format discrepancies
function normalizeAlgo(algo: string): string {
  const clean = algo.toLowerCase();
  if (clean.includes('rsa')) return 'rsa';
  if (clean.includes('ecdsa') || clean.includes('ecc')) return 'ecc/ecdsa';
  if (clean.includes('dh') || clean.includes('diffie')) return 'dh';
  return clean;
}

async function runEvaluation() {
  console.log('==================================================');
  console.log('       QUANTUM SHIELD DETECTION EVALUATION        ');
  console.log('==================================================\n');

  let datasetName = 'test-data';
  process.argv.forEach(val => {
    if (val.startsWith('--dataset=')) {
      datasetName = val.split('=')[1];
    }
  });

  console.log(`Running evaluation on dataset: ${datasetName}\n`);

  const testDataDir = path.join(process.cwd(), datasetName);
  const vulnerableDir = path.join(testDataDir, 'vulnerable');
  const cleanDir = path.join(testDataDir, 'clean');

  if (!fs.existsSync(testDataDir)) {
    console.error(`Error: dataset directory not found at ${testDataDir}`);
    process.exit(1);
  }

  let totalExpectedVulnerabilities = 0;
  let correctlyFlaggedVulnerabilities = 0;

  let totalCleanFiles = 0;
  let cleanFilesIncorrectlyFlagged = 0;

  let totalTrapFiles = 0;
  let trapFilesIncorrectlyFlagged = 0;

  const failures: FailureDetail[] = [];

  // Per-language statistics
  const languageStats: Record<string, { totalExpected: number; detected: number; totalClean: number; fp: number }> = {
    python: { totalExpected: 0, detected: 0, totalClean: 0, fp: 0 },
    java: { totalExpected: 0, detected: 0, totalClean: 0, fp: 0 },
    cpp: { totalExpected: 0, detected: 0, totalClean: 0, fp: 0 }
  };

  const getLanguage = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.py') return 'python';
    if (ext === '.java') return 'java';
    if (ext === '.cpp' || ext === '.h' || ext === '.hpp') return 'cpp';
    return 'unknown';
  };

  // --- PART 1: EVALUATE VULNERABLE FILES ---
  console.log('Evaluating Vulnerable Files...');
  if (fs.existsSync(vulnerableDir)) {
    const files = fs.readdirSync(vulnerableDir);
    const expectedFiles = files.filter(f => f.endsWith('.expected.json'));

    for (const expectedFile of expectedFiles) {
      const expectedPath = path.join(vulnerableDir, expectedFile);
      const expectedContent = fs.readFileSync(expectedPath, 'utf8');
      const expectedData: ExpectedJson = JSON.parse(expectedContent);

      const codeFilePath = path.join(vulnerableDir, expectedData.file);
      if (!fs.existsSync(codeFilePath)) {
        console.warn(`Warning: Expected code file ${codeFilePath} not found.`);
        continue;
      }

      const codeContent = fs.readFileSync(codeFilePath, 'utf8');
      const lang = getLanguage(expectedData.file);

      // Run static detector
      const actualFindings = await scanCode(codeContent, expectedData.file);
      
      // Compare expected findings
      const detectedIndices = new Set<number>();
      
      expectedData.expected_findings.forEach((expected, expIdx) => {
        totalExpectedVulnerabilities++;
        if (lang !== 'unknown') languageStats[lang].totalExpected++;

        // Look for matching actual finding
        let matchFound = false;
        for (let actIdx = 0; actIdx < actualFindings.length; actIdx++) {
          const actual = actualFindings[actIdx];
          const algoMatch = normalizeAlgo(actual.algorithm) === normalizeAlgo(expected.algorithm);
          const typeMatch = actual.usageType.toLowerCase() === expected.type.toLowerCase();
          const lineMatch = actual.lineRange[0] >= expected.line_range[0] && actual.lineRange[0] <= expected.line_range[1];

          if (algoMatch && typeMatch && lineMatch) {
            matchFound = true;
            detectedIndices.add(expIdx);
            break;
          }
        }

        if (matchFound) {
          correctlyFlaggedVulnerabilities++;
          if (lang !== 'unknown') languageStats[lang].detected++;
        } else {
          failures.push({
            file: expectedData.file,
            type: 'miss',
            details: `Missed expected finding: Algorithm=${expected.algorithm}, Type=${expected.type}, Expected Line Range=[${expected.line_range.join(', ')}]`
          });
        }
      });
    }
  }

  // --- PART 2: EVALUATE CLEAN & TRAP FILES ---
  console.log('Evaluating Clean & Trap Files...');
  if (fs.existsSync(cleanDir)) {
    const files = fs.readdirSync(cleanDir);
    const codeFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.py', '.java', '.cpp', '.h', '.hpp'].includes(ext);
    });

    for (const codeFile of codeFiles) {
      const codeFilePath = path.join(cleanDir, codeFile);
      const codeContent = fs.readFileSync(codeFilePath, 'utf8');
      const lang = getLanguage(codeFile);
      const isTrap = codeFile.includes('_trap');

      totalCleanFiles++;
      if (isTrap) totalTrapFiles++;
      if (lang !== 'unknown') languageStats[lang].totalClean++;

      // Run static detector
      const actualFindings = await scanCode(codeContent, codeFile);

      if (actualFindings.length > 0) {
        cleanFilesIncorrectlyFlagged++;
        if (isTrap) trapFilesIncorrectlyFlagged++;
        if (lang !== 'unknown') languageStats[lang].fp++;

        failures.push({
          file: codeFile,
          type: 'false_positive',
          details: `Flagged ${actualFindings.length} false positives: ${actualFindings.map(f => `${f.algorithm} (${f.usageType}) at line ${f.lineRange[0]}`).join(', ')}`
        });
      }
    }
  }

  // --- PART 3: COMPUTE METRICS ---
  const overallAccuracy = totalExpectedVulnerabilities > 0 
    ? (correctlyFlaggedVulnerabilities / totalExpectedVulnerabilities) * 100 
    : 100;

  const overallFPR = totalCleanFiles > 0 
    ? (cleanFilesIncorrectlyFlagged / totalCleanFiles) * 100 
    : 0;

  const trapFPR = totalTrapFiles > 0 
    ? (trapFilesIncorrectlyFlagged / totalTrapFiles) * 100 
    : 0;

  // Print console report
  console.log('\n==================================================');
  console.log('                EVALUATION RESULTS                ');
  console.log('==================================================');
  console.log(`Overall Detection Accuracy : ${overallAccuracy.toFixed(2)}% (${correctlyFlaggedVulnerabilities}/${totalExpectedVulnerabilities} vulnerabilities detected)`);
  console.log(`Overall False Positive Rate: ${overallFPR.toFixed(2)}% (${cleanFilesIncorrectlyFlagged}/${totalCleanFiles} clean files flagged)`);
  console.log(`Trap Files False Positive  : ${trapFPR.toFixed(2)}% (${trapFilesIncorrectlyFlagged}/${totalTrapFiles} trap files flagged)`);
  console.log('--------------------------------------------------');
  
  console.log('Per-Language Breakdown:');
  Object.keys(languageStats).forEach(lang => {
    const stats = languageStats[lang];
    const accuracy = stats.totalExpected > 0 ? (stats.detected / stats.totalExpected) * 100 : 100;
    const fpr = stats.totalClean > 0 ? (stats.fp / stats.totalClean) * 100 : 0;
    console.log(`- ${lang.toUpperCase()}:`);
    console.log(`  * Accuracy           : ${accuracy.toFixed(2)}% (${stats.detected}/${stats.totalExpected})`);
    console.log(`  * False Positive Rate: ${fpr.toFixed(2)}% (${stats.fp}/${stats.totalClean})`);
  });
  console.log('==================================================\n');

  if (failures.length > 0) {
    console.log('FAILURES & DISCREPANCIES LOG:');
    failures.forEach((f, idx) => {
      console.log(`[${idx + 1}] File: ${f.file} (${f.type.toUpperCase()})`);
      console.log(`    Details: ${f.details}`);
    });
    console.log('==================================================\n');
  } else {
    console.log('All tests passed cleanly! No misses or false positives.\n');
  }

  // --- PART 4: WRITE JSON RESULTS ---
  const evalResults = {
    timestamp: new Date().toISOString(),
    metrics: {
      overall_accuracy: overallAccuracy,
      overall_fpr: overallFPR,
      trap_fpr: trapFPR,
      correctly_flagged_vulnerabilities: correctlyFlaggedVulnerabilities,
      total_expected_vulnerabilities: totalExpectedVulnerabilities,
      clean_files_incorrectly_flagged: cleanFilesIncorrectlyFlagged,
      total_clean_files: totalCleanFiles,
      trap_files_incorrectly_flagged: trapFilesIncorrectlyFlagged,
      total_trap_files: totalTrapFiles
    },
    languages: languageStats,
    failures
  };

  const resultsFile = datasetName === 'test-data-external' ? 'eval-results-external.json' : 'eval-results.json';
  const resultsPath = path.join(process.cwd(), resultsFile);
  fs.writeFileSync(resultsPath, JSON.stringify(evalResults, null, 2));
  console.log(`Results successfully saved to: ${resultsPath}`);
}

runEvaluation().catch(err => {
  console.error('Fatal evaluation script error:', err);
  process.exit(1);
});
