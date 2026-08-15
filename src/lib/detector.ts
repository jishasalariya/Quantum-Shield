import { Parser, Language, Node as TreeSitterNode } from 'web-tree-sitter';
import path from 'path';
import fs from 'fs';

export interface Finding {
  lineRange: [number, number]; // 1-indexed [startLine, endLine]
  matchedPattern: string;
  snippet: string;
  algorithm: string;
  usageType: string;
  context: string; // surrounding code for LLM analysis (~10 lines before/after)
}

let parserInitialized = false;
let pythonLang: Language | null = null;
let javaLang: Language | null = null;
let cppLang: Language | null = null;

export async function initParser() {
  if (parserInitialized) return;

  const wasmPath = path.join(process.cwd(), 'public', 'wasm');

  // Verify WASM files exist
  const requiredFiles = ['tree-sitter.wasm', 'tree-sitter-python.wasm', 'tree-sitter-java.wasm', 'tree-sitter-cpp.wasm'];
  for (const file of requiredFiles) {
    const filePath = path.join(wasmPath, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required WASM binary not found at ${filePath}. Make sure copy-wasm has run.`);
    }
  }

  await Parser.init({
    locateFile(scriptName: string) {
      return path.join(wasmPath, scriptName);
    }
  });

  pythonLang = await Language.load(path.join(wasmPath, 'tree-sitter-python.wasm'));
  javaLang = await Language.load(path.join(wasmPath, 'tree-sitter-java.wasm'));
  cppLang = await Language.load(path.join(wasmPath, 'tree-sitter-cpp.wasm'));

  parserInitialized = true;
  console.log('web-tree-sitter and language grammars initialized successfully.');
}

// Extract a snippet and surrounding context from file lines
function getSnippetAndContext(
  lines: string[],
  startRow: number,
  endRow: number,
  contextSize = 10
): { snippet: string; context: string } {
  const startLine = startRow; // 0-indexed
  const endLine = endRow;

  // The specific vulnerable snippet
  const snippet = lines.slice(startLine, endLine + 1).join('\n');

  // The snippet + surrounding lines for LLM analysis
  const contextStart = Math.max(0, startLine - contextSize);
  const contextEnd = Math.min(lines.length - 1, endLine + contextSize);
  
  const contextLines = lines.slice(contextStart, contextEnd + 1);
  const context = contextLines.map((line, index) => {
    const lineNum = contextStart + index + 1;
    const marker = (lineNum >= startLine + 1 && lineNum <= endLine + 1) ? '>>> ' : '    ';
    return `${marker}${lineNum}: ${line}`;
  }).join('\n');

  return { snippet, context };
}

export async function scanCode(code: string, filename: string): Promise<Finding[]> {
  await initParser();

  const ext = path.extname(filename).toLowerCase();
  const lines = code.split(/\r?\n/);
  const findings: Finding[] = [];

  let lang: Language | null = null;
  if (ext === '.py') {
    lang = pythonLang;
  } else if (ext === '.java') {
    lang = javaLang;
  } else if (ext === '.cpp' || ext === '.h' || ext === '.cc' || ext === '.cxx' || ext === '.hpp') {
    lang = cppLang;
  }

  if (!lang) {
    // If not a supported language by AST, perform generic regex scan
    return runRegexFallback(code, filename, lines);
  }

  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(code);
  if (!tree) {
    return [];
  }
  const rootNode = tree.rootNode;

  // DFS AST traversal
  const visitedRows = new Set<number>();

  function traverse(node: TreeSitterNode) {
    let matched = false;
    let algorithm = '';
    let usageType = '';
    let matchedPattern = '';

    const text = node.text;

    if (ext === '.py') {
      // PYTHON AST CHECKS
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const importText = text.toLowerCase();
        if (importText.includes('crypto.publickey')) {
          matched = true;
          algorithm = (importText.includes('ecc') || importText.includes('ecdsa')) ? 'ECC/ECDSA' : 'RSA';
          usageType = 'import';
          matchedPattern = `Python Crypto.PublicKey import: ${text}`;
        } else if (importText.includes('cryptography.hazmat.primitives.asymmetric') && (importText.includes('rsa') || importText.includes('ec') || importText.includes('dsa') || importText.includes('dh'))) {
          matched = true;
          if (importText.includes('rsa')) algorithm = 'RSA';
          else if (importText.includes('ec')) algorithm = 'ECC/ECDSA';
          else algorithm = 'DSA';
          usageType = 'import';
          matchedPattern = `Python cryptography import: ${text}`;
        } else if (importText.includes('rsa') || importText.includes('ecdsa')) {
          if (importText.includes('import rsa') || importText.includes('from rsa import') || importText.includes('import ecdsa') || importText.includes('from ecdsa import') || importText.startsWith('import rsa') || importText.startsWith('from rsa') || importText.startsWith('import ecdsa') || importText.startsWith('from ecdsa')) {
            matched = true;
            algorithm = importText.includes('rsa') ? 'RSA' : 'ECDSA';
            usageType = 'import';
            matchedPattern = `Python import: ${text}`;
          }
        }
      } else if (node.type === 'call') {
        const calleeText = node.child(0)?.text || '';
        const calleeLower = calleeText.toLowerCase();

        if (calleeLower.includes('rsa.generate_private_key') || 
            calleeLower.includes('ec.generate_private_key') ||
            calleeLower.includes('rsa.generate') ||
            calleeLower.includes('ecc.generate') ||
            calleeLower.includes('signingkey.generate') ||
            calleeLower.includes('rsa.newkeys') ||
            calleeLower.includes('newkeys') ||
            (calleeLower === 'generate_private_key' && (text.includes('rsa') || text.includes('ec')))) {
          matched = true;
          algorithm = (calleeLower.includes('rsa') || text.includes('rsa')) ? 'RSA' : 'ECC/ECDSA';
          usageType = 'keygen';
          matchedPattern = `Python key generation call: ${calleeText}`;
        } else if (calleeLower.includes('rsa.encrypt') || calleeLower.includes('rsa.decrypt')) {
          matched = true;
          algorithm = 'RSA';
          usageType = 'encryption';
          matchedPattern = `Python RSA encrypt/decrypt call: ${calleeText}`;
        } else if (calleeLower.includes('rsa.sign') || calleeLower.includes('rsa.verify') || calleeLower.includes('sign') || calleeLower.includes('verify')) {
          if (calleeLower.includes('rsa') || calleeLower.includes('signingkey') || calleeLower.includes('verifyingkey') || calleeLower.endsWith('.sign') || calleeLower.endsWith('.verify')) {
            matched = true;
            algorithm = calleeLower.includes('rsa') ? 'RSA' : 'ECDSA';
            usageType = 'signature';
            matchedPattern = `Python signing/verification call: ${calleeText}`;
          }
        }
      }
    } else if (ext === '.java') {
      // JAVA AST CHECKS
      if (node.type === 'method_invocation') {
        const methodName = node.childForFieldName('name')?.text || '';
        const objectName = node.child(0)?.text || '';

        if (methodName === 'getInstance') {
          const argList = node.children.find((c: TreeSitterNode) => c.type === 'argument_list');
          if (argList) {
            const argsText = argList.text.toUpperCase();
            if (argsText.includes('RSA') || argsText.includes('EC') || argsText.includes('ECDSA') || argsText.includes('ECDH') || argsText.includes('DIFFIEHELLMAN') || argsText.includes('DH')) {
              matched = true;
              if (argsText.includes('RSA')) algorithm = 'RSA';
              else if (argsText.includes('ECDSA') || argsText.includes('EC')) algorithm = 'ECC/ECDSA';
              else algorithm = 'DH/DiffieHellman';

              if (objectName.includes('Cipher')) usageType = 'encryption';
              else if (objectName.includes('KeyPairGenerator')) usageType = 'keygen';
              else if (objectName.includes('Signature')) usageType = 'signature';
              else usageType = 'other';

              matchedPattern = `Java ${objectName}.getInstance(${argList.text})`;
            }
          }
        }
      }
    } else if (ext === '.cpp' || ext === '.h' || ext === '.cc' || ext === '.cxx' || ext === '.hpp') {
      // C++ AST CHECKS
      if (node.type === 'preproc_include') {
        const includeText = text.toLowerCase();
        if (includeText.includes('openssl/rsa.h') || 
            includeText.includes('openssl/ec.h') || 
            includeText.includes('openssl/ecdsa.h') || 
            includeText.includes('openssl/dh.h')) {
          matched = true;
          if (includeText.includes('rsa')) algorithm = 'RSA';
          else if (includeText.includes('ec')) algorithm = 'ECC/ECDSA';
          else algorithm = 'DH/DiffieHellman';
          usageType = 'import';
          matchedPattern = `C++ include: ${text}`;
        }
      } else if (node.type === 'call_expression') {
        const functionName = node.child(0)?.text || '';
        if (functionName === 'RSA_generate_key_ex' || 
            functionName === 'RSA_new' || 
            functionName === 'RSA_generate_key') {
          matched = true;
          algorithm = 'RSA';
          usageType = 'keygen';
          matchedPattern = `C++ OpenSSL RSA keygen: ${functionName}`;
        } else if (functionName === 'EC_KEY_new_by_curve_name' || 
                   functionName === 'EC_KEY_generate_key') {
          matched = true;
          algorithm = 'ECC/ECDSA';
          usageType = 'keygen';
          matchedPattern = `C++ OpenSSL ECC keygen: ${functionName}`;
        } else if (functionName.startsWith('PEM_read_bio_RSA') || 
                   functionName.startsWith('PEM_write_bio_RSA')) {
          matched = true;
          algorithm = 'RSA';
          usageType = 'import';
          matchedPattern = `C++ OpenSSL PEM RSA: ${functionName}`;
        } else if (functionName.startsWith('PEM_read_bio_EC') || 
                   functionName.startsWith('PEM_write_bio_EC')) {
          matched = true;
          algorithm = 'ECC/ECDSA';
          usageType = 'import';
          matchedPattern = `C++ OpenSSL PEM ECC: ${functionName}`;
        }
      }
    }

    // Deduplicate findings on the same start line
    const startRow = node.startPosition.row;
    const endRow = node.endPosition.row;

    if (matched && !visitedRows.has(startRow)) {
      visitedRows.add(startRow);
      const { snippet, context } = getSnippetAndContext(lines, startRow, endRow);
      findings.push({
        lineRange: [startRow + 1, endRow + 1],
        matchedPattern,
        snippet,
        algorithm,
        usageType,
        context
      });
    }

    // Recurse children
    for (let i = 0; i < node.childCount; i++) {
      traverse(node.child(i)!);
    }
  }

  traverse(rootNode);

  // Fallback / complement: regex checking for classical-crypto indicators in comments, or standard APIs that might not have been parsed cleanly
  const regexFindings = runRegexFallback(code, filename, lines);
  
  // Merge findings, avoiding duplicate lines
  const existingLines = new Set<number>();
  findings.forEach(f => {
    for (let i = f.lineRange[0]; i <= f.lineRange[1]; i++) {
      existingLines.add(i);
    }
  });

  regexFindings.forEach(rf => {
    const overlaps = rf.lineRange[0] <= rf.lineRange[1] && 
                     Array.from({length: rf.lineRange[1] - rf.lineRange[0] + 1}, (_, k) => rf.lineRange[0] + k)
                     .some(line => existingLines.has(line));
                     
    if (!overlaps) {
      findings.push(rf);
      for (let i = rf.lineRange[0]; i <= rf.lineRange[1]; i++) {
        existingLines.add(i);
      }
    }
  });

  return findings.sort((a, b) => a.lineRange[0] - b.lineRange[0]);
}

function runRegexFallback(code: string, filename: string, lines: string[]): Finding[] {
  const findings: Finding[] = [];
  const ext = path.extname(filename).toLowerCase();

  const rules = [
    {
      regex: /Cipher\.getInstance\(\s*["']RSA[^"']*["']\s*\)/gi,
      algorithm: 'RSA',
      usageType: 'encryption',
      pattern: 'Cipher.getInstance("RSA...")'
    },
    {
      regex: /KeyPairGenerator\.getInstance\(\s*["']RSA["']\s*\)/gi,
      algorithm: 'RSA',
      usageType: 'keygen',
      pattern: 'KeyPairGenerator.getInstance("RSA")'
    },
    {
      regex: /KeyPairGenerator\.getInstance\(\s*["']EC["']\s*\)/gi,
      algorithm: 'ECC/ECDSA',
      usageType: 'keygen',
      pattern: 'KeyPairGenerator.getInstance("EC")'
    },
    {
      regex: /Signature\.getInstance\(\s*["'][^"']*(RSA|ECDSA)[^"']*["']\s*\)/gi,
      algorithm: 'RSA/ECDSA',
      usageType: 'signature',
      pattern: 'Signature.getInstance("...RSA/ECDSA...")'
    },
    {
      regex: /import\s+rsa\b/g,
      algorithm: 'RSA',
      usageType: 'import',
      pattern: 'import rsa'
    },
    {
      regex: /import\s+ecdsa\b/g,
      algorithm: 'ECDSA',
      usageType: 'import',
      pattern: 'import ecdsa'
    },
    {
      regex: /cryptography\.hazmat\.primitives\.asymmetric/g,
      algorithm: 'RSA/ECC',
      usageType: 'import',
      pattern: 'cryptography asymmetric module'
    },
    {
      regex: /Crypto\.PublicKey\.(RSA|ECC)/g,
      algorithm: 'RSA/ECC',
      usageType: 'import',
      pattern: 'Crypto.PublicKey'
    },
    {
      regex: /#include\s+<openssl\/(rsa|ec|ecdsa|dh)\.h>/g,
      algorithm: 'RSA/ECC/DH',
      usageType: 'import',
      pattern: '#include <openssl/...h>'
    },
    {
      regex: /\bRSA_generate_key_ex\b/g,
      algorithm: 'RSA',
      usageType: 'keygen',
      pattern: 'RSA_generate_key_ex'
    },
    {
      regex: /\bEC_KEY_generate_key\b/g,
      algorithm: 'ECC/ECDSA',
      usageType: 'keygen',
      pattern: 'EC_KEY_generate_key'
    }
  ];

  lines.forEach((line, idx) => {
    // Basic comment stripping to avoid double matches if commented out
    const lineNum = idx + 1;
    const isComment = (ext === '.py' && line.trim().startsWith('#')) ||
                      ((ext === '.java' || ext === '.cpp' || ext === '.h') && line.trim().startsWith('//'));

    if (isComment) return;

    rules.forEach((rule) => {
      // Reset regex index for safety
      rule.regex.lastIndex = 0;
      if (rule.regex.test(line)) {
        let algo = rule.algorithm;
        if (algo === 'RSA/ECDSA') {
          algo = line.toUpperCase().includes('ECDSA') ? 'ECDSA' : 'RSA';
        } else if (algo === 'RSA/ECC') {
          algo = line.toLowerCase().includes('rsa') ? 'RSA' : 'ECC';
        } else if (algo === 'RSA/ECC/DH') {
          if (line.includes('rsa')) algo = 'RSA';
          else if (line.includes('ec')) algo = 'ECC/ECDSA';
          else algo = 'DH/DiffieHellman';
        }

        const { snippet, context } = getSnippetAndContext(lines, idx, idx);
        findings.push({
          lineRange: [lineNum, lineNum],
          matchedPattern: `Regex Match: ${rule.pattern}`,
          snippet,
          algorithm: algo,
          usageType: rule.usageType,
          context
        });
      }
    });
  });

  return findings;
}
