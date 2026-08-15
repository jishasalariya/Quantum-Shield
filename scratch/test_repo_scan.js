const fs = require('fs');
const path = require('path');

const owner = 'snoopysecurity';
const repo = 'Broken-Vulnerable-Code-Snippets';

async function main() {
  console.log(`Auditing repo: ${owner}/${repo}`);
  
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repo metadata: ${repoRes.statusText}`);
    }
    const repoData = await repoRes.json();
    const branch = repoData.default_branch || 'main';
    console.log(`Default branch: ${branch}`);
    
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (!treeRes.ok) {
      throw new Error(`Failed to fetch tree: ${treeRes.statusText}`);
    }
    const treeData = await treeRes.json();
    
    const validExtensions = ['.py', '.java', '.cpp', '.h', '.cc', '.cxx', '.hpp'];
    const files = treeData.tree.filter(item => {
      if (item.type !== 'blob') return false;
      const ext = item.path.substring(item.path.lastIndexOf('.')).toLowerCase();
      return validExtensions.includes(ext);
    });
    
    console.log(`Discovered ${files.length} code files.`);
    
    for (const file of files) {
      console.log(`\nFetching: ${file.path}`);
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      const rawRes = await fetch(rawUrl);
      const codeContent = await rawRes.text();
      
      console.log(`Scanning: ${file.path} (${codeContent.length} bytes)`);
      
      const scanRes = await fetch('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeContent,
          filename: file.path
        })
      });
      
      if (!scanRes.ok) {
        console.error(`  Scan API failed: ${scanRes.status} ${scanRes.statusText}`);
        continue;
      }
      
      const scanData = await scanRes.json();
      console.log(`  Findings: ${scanData.riskAnalysis.findings.length}`);
      if (scanData.riskAnalysis.findings.length > 0) {
        scanData.riskAnalysis.findings.forEach(f => {
          console.log(`  - Flagged: ${f.matchedPattern} at line ${f.lineRange[0]} (${f.severity})`);
        });
      }
    }
  } catch (e) {
    console.error("Error during scan test:", e);
  }
}

main();
