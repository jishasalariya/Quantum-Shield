const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../public/wasm');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created directory:', targetDir);
}

const filesToCopy = [
  {
    src: path.join(__dirname, '../node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    dest: path.join(targetDir, 'tree-sitter.wasm'),
  },
  {
    src: path.join(__dirname, '../node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    dest: path.join(targetDir, 'web-tree-sitter.wasm'),
  },
  {
    src: path.join(__dirname, '../node_modules/@repomix/tree-sitter-wasms/out/tree-sitter-python.wasm'),
    dest: path.join(targetDir, 'tree-sitter-python.wasm'),
  },
  {
    src: path.join(__dirname, '../node_modules/@repomix/tree-sitter-wasms/out/tree-sitter-java.wasm'),
    dest: path.join(targetDir, 'tree-sitter-java.wasm'),
  },
  {
    src: path.join(__dirname, '../node_modules/@repomix/tree-sitter-wasms/out/tree-sitter-cpp.wasm'),
    dest: path.join(targetDir, 'tree-sitter-cpp.wasm'),
  },
];

filesToCopy.forEach((file) => {
  if (fs.existsSync(file.src)) {
    fs.copyFileSync(file.src, file.dest);
    console.log(`Copied ${path.basename(file.src)} -> ${file.dest}`);
  } else {
    console.error(`Source file not found: ${file.src}`);
    process.exit(1);
  }
});

console.log('WASM files copy complete.');
