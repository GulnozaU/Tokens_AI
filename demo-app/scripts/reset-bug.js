#!/usr/bin/env node
/**
 * Reset demo-app to the buggy JWT state (Round 1 or Round 2 start).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const variant = process.argv[2] === 'fixed' ? 'fixed' : 'buggy';
const templateDir = path.join(root, 'templates', variant);

function copyRecursive(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(templateDir, path.join(root, 'src'));
console.log(`Reset demo-app to ${variant} state.`);
