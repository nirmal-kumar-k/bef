const fs = require('fs');
const path = require('path');

const dirsToScan = ['app', 'components'];
const replacements = [
  { from: /#E8581A/gi, to: '#D4521A' }, // Primary Orange
  { from: /#0B101A/gi, to: '#050810' }, // Main background
  { from: /#121A2B/gi, to: '#0C1221' }, // Card background
  { from: /#0D1220/gi, to: '#070B16' }, // Sidebar background
  { from: /#F5712E/gi, to: '#EB6824' }, // Hover Orange (adjusting slightly cooler)
];

function scanAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanAndReplace(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const { from, to } of replacements) {
        if (content.match(from)) {
          content = content.replace(from, to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

dirsToScan.forEach(scanAndReplace);
console.log("Global color replacement complete.");
