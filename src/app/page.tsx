'use client';

import React, { useState, useRef } from 'react';
import DownloadReportButton from '@/components/DownloadReportButton';

interface Finding {
  lineRange: [number, number];
  matchedPattern: string;
  snippet: string;
  algorithm: string;
  usageType: string;
  confirmed: boolean;
  explanation: string;
  confidence: number;
  severity: 'High' | 'Medium' | 'Low';
  filename?: string; // Track filename for multi-file repo scans
  remediation?: {
    replacement_code: string;
    nist_standard: string;
    parameter_set: string;
    library_used: string;
    notes: string;
  };
}

interface ScanResponse {
  success: boolean;
  filename: string;
  riskAnalysis: {
    findings: Finding[];
    highCount: number;
    mediumCount: number;
    lowCount: number;
    aggregateScore: number;
    riskLevel: 'High' | 'Medium' | 'Low';
  };
  manualReview: any[];
}

export default function Home() {
  const [view, setView] = useState<'upload' | 'scanning' | 'results'>('upload');
  const [scanType, setScanType] = useState<'single' | 'github'>('single');
  const [dragActive, setDragActive] = useState(false);
  const [pastedCode, setPastedCode] = useState('');
  const [selectedLang, setSelectedLang] = useState('py');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const [totalCodeFiles, setTotalCodeFiles] = useState(0);
  const [scannedFilesList, setScannedFilesList] = useState<string[]>([]);

  // GitHub Scan States
  const [githubUrl, setGithubUrl] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [repoProgress, setRepoProgress] = useState<{
    active: boolean;
    statusText: string;
    current: number;
    total: number;
    vulnerabilitiesFound: number;
  }>({
    active: false,
    statusText: '',
    current: 0,
    total: 0,
    vulnerabilitiesFound: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Drag Over
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Process selected file
  const processFile = async (file: File) => {
    const validExtensions = ['.py', '.java', '.cpp', '.h', '.cc', '.cxx', '.hpp'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      setErrorMsg(`Unsupported file type. Please upload Python (.py), Java (.java), or C++ (.cpp, .h) files.`);
      return;
    }

    setErrorMsg(null);
    setView('scanning');
    setRepoProgress({ active: false, statusText: '', current: 0, total: 0, vulnerabilitiesFound: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/scan', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server returned an error');
      }

      const result: ScanResponse = await response.json();
      setScanResult(result);
      setScannedFilesList([file.name]);
      // Pre-expand first card if findings exist
      if (result.riskAnalysis.findings.length > 0) {
        setExpandedCards({ 0: true });
      }
      setView('results');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during scanning.');
      setView('upload');
    }
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle File Input Click
  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Handle File Select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Handle Paste Scan
  const handlePasteScan = async () => {
    if (!pastedCode.trim()) {
      setErrorMsg('Please paste some code to scan.');
      return;
    }

    setErrorMsg(null);
    setView('scanning');
    setRepoProgress({ active: false, statusText: '', current: 0, total: 0, vulnerabilitiesFound: 0 });

    let extension = '.py';
    if (selectedLang === 'java') extension = '.java';
    else if (selectedLang === 'cpp') extension = '.cpp';

    const filename = `pasted_snippet${extension}`;

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: pastedCode,
          filename,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Server returned an error');
      }

      const result: ScanResponse = await response.json();
      setScanResult(result);
      setScannedFilesList([filename]);
      if (result.riskAnalysis.findings.length > 0) {
        setExpandedCards({ 0: true });
      }
      setView('results');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during scanning.');
      setView('upload');
    }
  };

  // Parse GitHub repo owner and name from URL
  const parseGitHubUrl = (url: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_\.-]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
    return null;
  };

  // Handle GitHub Repository Scan Flow
  const handleGitHubScan = async () => {
    if (!githubUrl.trim()) {
      setErrorMsg('Please enter a GitHub repository URL.');
      return;
    }

    const repoInfo = parseGitHubUrl(githubUrl);
    if (!repoInfo) {
      setErrorMsg('Invalid GitHub Repository URL. Use formats like "https://github.com/owner/repo" or "owner/repo".');
      return;
    }

    const { owner, repo } = repoInfo;
    setErrorMsg(null);
    setView('scanning');
    setRepoProgress({
      active: true,
      statusText: 'Connecting to GitHub API...',
      current: 0,
      total: 0,
      vulnerabilitiesFound: 0
    });

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };
      if (githubPat.trim()) {
        headers['Authorization'] = `token ${githubPat.trim()}`;
      }

      // 1. Fetch Repository Metadata to resolve default branch name
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoRes.ok) {
        throw new Error('Failed to retrieve repository metadata. Check repository name or token permissions.');
      }
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || 'main';

      // 2. Fetch Git tree recursively
      setRepoProgress(prev => ({ ...prev, statusText: 'Fetching repository file tree...' }));
      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
      if (!treeRes.ok) {
        throw new Error('Failed to retrieve repository tree. Check GitHub API rate limits or token permissions.');
      }
      const treeData = await treeRes.json();

      // 3. Filter target file paths
      const validExtensions = ['.py', '.java', '.cpp', '.h', '.cc', '.cxx', '.hpp'];
      const codeFiles = (treeData.tree || []).filter((item: any) => {
        if (item.type !== 'blob') return false;
        const lastDot = item.path.lastIndexOf('.');
        const ext = lastDot !== -1 ? item.path.substring(lastDot).toLowerCase() : '';
        const isExcluded = 
          item.path.includes('node_modules/') || 
          item.path.includes('vendor/') || 
          item.path.includes('build/') || 
          item.path.includes('dist/') || 
          item.path.includes('.git/') || 
          item.path.includes('.github/') || 
          item.path.includes('venv/') || 
          item.path.includes('.venv/') || 
          item.path.includes('env/') || 
          item.path.includes('tests/') || 
          item.path.includes('test/') || 
          item.path.includes('docs/') || 
          item.path.includes('__pycache__/') || 
          item.path.includes('egg-info/');
        return validExtensions.includes(ext) && !isExcluded;
      });

      // Cap at 100 files to prevent browser out-of-memory or high latency
      const limit = 100;
      const filesToScan = codeFiles.slice(0, limit);
      setTotalCodeFiles(codeFiles.length);
      if (filesToScan.length === 0) {
        throw new Error('No Python (.py), Java (.java), or C++ (.cpp, .h) code files found in this repository.');
      }

      setRepoProgress(prev => ({ ...prev, total: filesToScan.length, current: 0 }));

      const aggregatedFindings: Finding[] = [];
      const aggregatedManualReview: any[] = [];
      let totalHigh = 0;
      let totalMedium = 0;
      let totalLow = 0;

      // 4. Sequentially download and scan files
      for (let i = 0; i < filesToScan.length; i++) {
        const file = filesToScan[i];
        setRepoProgress(prev => ({
          ...prev,
          current: i,
          statusText: `Downloading & scanning: ${file.path}`
        }));

        let codeContent = '';
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${file.path}`;

        try {
          const rawRes = await fetch(rawUrl);
          if (rawRes.ok) {
            codeContent = await rawRes.text();
          } else {
            // Fallback for private repos using GitHub contents API
            const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${defaultBranch}`, { headers });
            if (contentsRes.ok) {
              const contentsData = await contentsRes.json();
              codeContent = atob(contentsData.content.replace(/\s/g, ''));
            } else {
              console.warn(`Skipped file (unable to fetch): ${file.path}`);
              continue;
            }
          }
        } catch (e) {
          console.warn(`Error downloading file ${file.path}:`, e);
          continue;
        }

        if (!codeContent.trim()) continue;

        // Post to single-file API scanner
        try {
          const scanRes = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: codeContent,
              filename: file.path,
            }),
          });

          if (scanRes.ok) {
            const scanData: ScanResponse = await scanRes.json();
            const fileFindings = scanData.riskAnalysis.findings.map(f => ({
              ...f,
              filename: file.path,
            }));
            const fileManual = scanData.manualReview.map(m => ({
              ...m,
              filename: file.path,
            }));

            aggregatedFindings.push(...fileFindings);
            aggregatedManualReview.push(...fileManual);

            totalHigh += scanData.riskAnalysis.highCount;
            totalMedium += scanData.riskAnalysis.mediumCount;
            totalLow += scanData.riskAnalysis.lowCount;

            setRepoProgress(prev => ({
              ...prev,
              vulnerabilitiesFound: prev.vulnerabilitiesFound + fileFindings.length,
            }));
          }
        } catch (e) {
          console.error(`Error scanning ${file.path}:`, e);
        }
      }

      // 5. Aggregate metrics
      const finalScore = (15 * totalHigh) + (8 * totalMedium) + (5 * totalLow);
      let finalRiskLevel: 'High' | 'Medium' | 'Low' = 'Low';
      if (finalScore >= 50) finalRiskLevel = 'High';
      else if (finalScore >= 15) finalRiskLevel = 'Medium';

      const finalResult: ScanResponse = {
        success: true,
        filename: `${owner}/${repo} (GitHub Repository)`,
        riskAnalysis: {
          findings: aggregatedFindings,
          highCount: totalHigh,
          mediumCount: totalMedium,
          lowCount: totalLow,
          aggregateScore: finalScore,
          riskLevel: finalRiskLevel,
        },
        manualReview: aggregatedManualReview,
      };

      setScanResult(finalResult);
      setScannedFilesList(filesToScan.map((f: any) => f.path));
      if (aggregatedFindings.length > 0) {
        setExpandedCards({ 0: true });
      }
      setView('results');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during repository scan.');
      setView('upload');
    } finally {
      setRepoProgress(prev => ({ ...prev, active: false }));
    }
  };

  // Toggle card expansion
  const toggleCard = (index: number) => {
    setExpandedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Reset to scan another file
  const resetScanner = () => {
    setPastedCode('');
    setGithubUrl('');
    setScanResult(null);
    setErrorMsg(null);
    setExpandedCards({});
    setView('upload');
  };

  return (
    <>
      {/* Header */}
      <header>
        <div className="logo-container">
          <svg className="logo-icon" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <h1>Quantum Shield</h1>
        </div>
        <span className="badge-pqc">PQC Compliance Evaluator</span>
      </header>

      {/* Main Container */}
      <main>
        {/* VIEW 1: UPLOAD & PASTE & GITHUB SCREEN */}
        {view === 'upload' && (
          <div className="upload-container">
            <div className="welcome-box">
              <h2>Quantum Cryptography Audit</h2>
              <p>Evaluate your source code or full repositories for classical cryptography vulnerabilities and remediate using NIST standards.</p>
            </div>

            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--severity-high)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            {/* Tabs */}
            <div className="tabs-container">
              <button 
                className={`tab-button ${scanType === 'single' ? 'active' : ''}`}
                onClick={() => { setScanType('single'); setErrorMsg(null); }}
              >
                Single File Scan
              </button>
              <button 
                className={`tab-button ${scanType === 'github' ? 'active' : ''}`}
                onClick={() => { setScanType('github'); setErrorMsg(null); }}
              >
                GitHub Repository Scan
              </button>
            </div>

            {scanType === 'single' ? (
              <>
                {/* Drag & Drop zone */}
                <div 
                  className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={onButtonClick}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    style={{ display: 'none' }} 
                    onChange={handleFileChange}
                    accept=".py,.java,.cpp,.h,.cc,.cxx,.hpp"
                  />
                  <svg className="upload-icon" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <p>Drag and drop your file here, or click to upload</p>
                  <span>Supports Python (.py), Java (.java), C++ (.cpp, .h)</span>
                </div>

                <div className="separator">Or Paste Code Snippet</div>

                {/* Paste Box */}
                <div className="textbox-container">
                  <div className="textbox-header">
                    <span className="textbox-label">Source Code Snippet</span>
                    <select 
                      className="lang-select"
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                    >
                      <option value="py">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <textarea 
                    className="code-textarea"
                    placeholder="Paste code snippet containing classical cryptography (e.g. RSA, ECDSA, ECC) here..."
                    value={pastedCode}
                    onChange={(e) => setPastedCode(e.target.value)}
                  />
                  <button 
                    className="btn-scan" 
                    onClick={handlePasteScan}
                    disabled={!pastedCode.trim()}
                  >
                    Scan Code Snippet
                  </button>
                </div>
              </>
            ) : (
              /* GitHub Form */
              <div className="github-form">
                <div className="form-group">
                  <label htmlFor="github-url">GitHub Repository URL</label>
                  <input 
                    id="github-url"
                    type="text" 
                    className="input-text"
                    placeholder="e.g. https://github.com/owner/repository or owner/repository"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="github-pat">Personal Access Token (Optional for Private Repos / Rate Limits)</label>
                  <input 
                    id="github-pat"
                    type="password" 
                    className="input-text"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                  />
                </div>
                <button 
                  className="btn-scan"
                  onClick={handleGitHubScan}
                  disabled={!githubUrl.trim()}
                  style={{ marginTop: '0.5rem' }}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                  Scan GitHub Repository
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: LOADING & SCANNING SCREEN */}
        {view === 'scanning' && (
          <div className="loading-container">
            <div className="loader-glow">
              <span className="loader-circle"></span>
              <span className="loader-circle"></span>
              <span className="loader-circle"></span>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '500px' }}>
              <span className="loading-text">
                {repoProgress.active ? 'Scanning GitHub Repository' : 'Analyzing Cryptographic Signature Modules'}
              </span>
              <span className="loading-subtext" style={{ wordBreak: 'break-all', minHeight: '2.5rem', display: 'block' }}>
                {repoProgress.active 
                  ? repoProgress.statusText 
                  : 'Executing AST parsing and evaluating NIST post-quantum compliant transformations...'
                }
              </span>
              
              {repoProgress.active && repoProgress.total > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    <span>Progress: {Math.round((repoProgress.current / repoProgress.total) * 100)}%</span>
                    <span>{repoProgress.current} / {repoProgress.total} Files</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '9999px', height: '10px', overflow: 'hidden', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                    <div 
                      style={{ 
                        width: `${(repoProgress.current / repoProgress.total) * 100}%`, 
                        backgroundColor: 'var(--primary)', 
                        height: '100%', 
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 0 10px rgba(2, 132, 199, 0.5)'
                      }}
                    ></div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--severity-medium)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Vulnerabilities Flagged So Far: {repoProgress.vulnerabilitiesFound}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: RESULTS SCREEN */}
        {view === 'results' && scanResult && (
          <div>
            {/* Dashboard Header */}
            <div className="results-header" style={{ flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="results-meta">
                  <h2>Scan Results</h2>
                  <p>Audited: {scanResult.filename}</p>
                </div>

                <div className="risk-summary-card">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Quantum Risk Index</span>
                  <div className="risk-score-display">
                    <span className="risk-score-number">{scanResult.riskAnalysis.aggregateScore}</span>
                    <span className={`risk-badge ${scanResult.riskAnalysis.riskLevel}`}>{scanResult.riskAnalysis.riskLevel} Risk</span>
                  </div>
                  <div className="severity-stats">
                    <span className="stat-item">High: <span>{scanResult.riskAnalysis.highCount}</span></span>
                    <span className="stat-item">Medium: <span>{scanResult.riskAnalysis.mediumCount}</span></span>
                    <span className="stat-item">Low: <span>{scanResult.riskAnalysis.lowCount}</span></span>
                  </div>
                </div>
              </div>

              {scanResult.filename.includes('GitHub') && totalCodeFiles > 100 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.2)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--severity-medium)', fontWeight: 600 }}>
                  <svg style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Capped Scan: Audited the first 100 code files of {totalCodeFiles} total files discovered in the repository tree to prevent gateway timeouts.</span>
                </div>
              )}
            </div>

            {/* Actions Row */}
            <div className="actions-row">
              <button className="btn-secondary" onClick={resetScanner}>
                ← Scan Another Source
              </button>

              <DownloadReportButton 
                filename={scanResult.filename}
                findings={scanResult.riskAnalysis.findings}
                manualReview={scanResult.manualReview}
                riskAnalysis={{
                  highCount: scanResult.riskAnalysis.highCount,
                  mediumCount: scanResult.riskAnalysis.mediumCount,
                  lowCount: scanResult.riskAnalysis.lowCount,
                  aggregateScore: scanResult.riskAnalysis.aggregateScore,
                  riskLevel: scanResult.riskAnalysis.riskLevel
                }}
              />
            </div>

            {/* Findings */}
            <div className="findings-container">
              {scanResult.riskAnalysis.findings.length === 0 ? (
                <div className="no-findings-box">
                  <h3>No Vulnerabilities Found</h3>
                  <p>Congratulations! No classical asymmetric cryptographic operations were detected in the source.</p>
                </div>
              ) : (
                scanResult.riskAnalysis.findings.map((finding, idx) => (
                  <div key={idx} className={`finding-card ${expandedCards[idx] ? 'expanded' : ''}`}>
                    {/* Header */}
                    <div className="finding-header" onClick={() => toggleCard(idx)}>
                      <div className="finding-header-left" style={{ flex: 1, minWidth: 0 }}>
                        <span className={`severity-dot ${finding.severity}`}></span>
                        <span className="finding-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {finding.filename && (
                            <span style={{ color: 'var(--primary)', fontWeight: 700, marginRight: '0.4rem', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>
                              [{finding.filename}]
                            </span>
                          )}
                          Line {finding.lineRange[0]}
                          <span>{finding.matchedPattern}</span>
                        </span>
                      </div>
                      <div className="finding-header-right">
                        <span className="finding-algo-badge">{finding.algorithm}</span>
                        <span className={`risk-badge ${finding.severity}`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                          {finding.severity}
                        </span>
                        <svg className="arrow-icon" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {expandedCards[idx] && (
                      <div className="finding-content">
                        {/* Explanation */}
                        <div className="finding-explanation-section">
                          <span className="section-title">Cryptographic Vulnerability Risk</span>
                          <p className="finding-explanation-text">{finding.explanation}</p>
                        </div>

                        {/* Code Diff Panel */}
                        <div className="diff-container">
                          {/* Insecure */}
                          <div className="diff-panel">
                            <div className="diff-header">
                              <span className="diff-title insecure">Classical Crypto Code</span>
                            </div>
                            <div className="diff-code-box">
                              <pre>{finding.snippet}</pre>
                            </div>
                          </div>

                          {/* Remediated */}
                          {finding.remediation && (
                            <div className="diff-panel">
                              <div className="diff-header">
                                <span className="diff-title remediated">NIST PQC Suggestion</span>
                              </div>
                              <div className="diff-code-box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                <pre>{finding.remediation.replacement_code}</pre>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Remediation Specs */}
                        {finding.remediation && (
                          <div className="remediation-meta">
                            <div className="meta-item">
                              <span className="meta-label">Standard Approved</span>
                              <span className="meta-value standard">{finding.remediation.nist_standard}</span>
                            </div>
                            <div className="meta-item">
                              <span className="meta-label">Parameter Configuration</span>
                              <span className="meta-value">{finding.remediation.parameter_set}</span>
                            </div>
                            <div className="meta-item">
                              <span className="meta-label">Vetted Math Library</span>
                              <span className="meta-value">{finding.remediation.library_used}</span>
                            </div>

                            {finding.remediation.notes && (
                              <div className="meta-notes">
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mapping Rationale</span>
                                <p style={{ marginTop: '0.2rem', color: '#334155' }}>{finding.remediation.notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer Disclaimer */}
                        <div className="ai-warning-footer">
                          <svg className="warning-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          AI-generated suggestion per {finding.remediation?.nist_standard || 'NIST standard'} — review and test before use.
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Manual Review Items if any */}
            {scanResult.manualReview && scanResult.manualReview.length > 0 && (
              <div>
                <div className="manual-review-title-bar">
                  <svg style={{ width: '1.25rem', height: '1.25rem', color: 'var(--severity-medium)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2>Items Flagged for Manual Review</h2>
                </div>
                <div className="findings-container">
                  {scanResult.manualReview.map((finding, idx) => (
                    <div key={idx} className="finding-card">
                      <div className="finding-header" style={{ cursor: 'default' }}>
                        <div className="finding-header-left" style={{ flex: 1, minWidth: 0 }}>
                          <span className="severity-dot Medium"></span>
                          <span className="finding-title" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {finding.filename && (
                              <span style={{ color: 'var(--primary)', fontWeight: 700, marginRight: '0.4rem', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>
                                [{finding.filename}]
                              </span>
                            )}
                            Line {finding.lineRange[0]}
                            <span>{finding.matchedPattern}</span>
                          </span>
                        </div>
                        <div className="finding-header-right">
                          <span className="finding-algo-badge">{finding.algorithm}</span>
                          <span className="risk-badge Medium" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                            Uncertain
                          </span>
                        </div>
                      </div>
                      <div className="finding-content">
                        <div className="finding-explanation-section">
                          <span className="section-title">Manual Evaluation Recommended</span>
                          <p className="finding-explanation-text">{finding.explanation}</p>
                        </div>
                        <div className="diff-container">
                          <div className="diff-panel">
                            <span className="diff-title">Flagged Code Snippet</span>
                            <div className="diff-code-box">
                              <pre>{finding.snippet}</pre>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Collapsible Scanned Files Log */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
              <details style={{ cursor: 'pointer' }}>
                <summary style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>
                  Audited Files List ({scannedFilesList.length} files scanned)
                </summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.15)', padding: '1rem', borderRadius: '8px' }}>
                  {scannedFilesList.map((filename, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#0f172a', fontFamily: 'monospace' }}>
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                      <span>{filename}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
