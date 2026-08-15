const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function debug() {
  const wasmPath = path.join(__dirname, '../public/wasm');
  
  await Parser.init({
    locateFile(scriptName) {
      return path.join(wasmPath, scriptName);
    }
  });

  const Python = await Language.load(path.join(wasmPath, 'tree-sitter-python.wasm'));
  const parser = new Parser();
  parser.setLanguage(Python);

  const code = fs.readFileSync(path.join(__dirname, 'vulnerable_python.py'), 'utf8');
  const tree = parser.parse(code);

  console.log('--- AST Tree Structure ---');
  
  function printNode(node, depth = 0) {
    const indent = ' '.repeat(depth * 2);
    console.log(`${indent}${node.type} [${node.startPosition.row}:${node.startPosition.column}] - text: "${node.text.split('\n')[0].substring(0, 50)}"`);
    for (let i = 0; i < node.childCount; i++) {
      printNode(node.child(i), depth + 1);
    }
  }

  printNode(tree.rootNode);
}

debug().catch(console.error);
