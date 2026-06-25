const fs = require('fs');
const path = require('path');

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;

      // 1. Replace Colors
      content = content.replace(/#EB6824/gi, '#D4521A');
      content = content.replace(/#E8581A/gi, '#D4521A');

      // 2. Replace Phosphor icon weights
      content = content.replace(/weight="bold"/g, 'weight="duotone"');
      content = content.replace(/weight='bold'/g, 'weight="duotone"');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, '../src'));
