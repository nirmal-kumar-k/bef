const fs = require('fs');
const path = require('path');

const colorMap = {
  // Backgrounds
  '#050810': '#F4F6FB', // App background
  '#0C1221': '#FFFFFF', // Cards / Modals
  '#1A263D': '#EEF2FF', // Hover Bg / Alternate rows
  '#1C2840': '#EEF2FF', // Sidebar Hover Bg
  '#162034': '#FFFFFF', // Topbar Search Bg
  'rgba(5,8,16,0.7)': 'rgba(244,246,251,0.7)', // Topbar bg translucent
  'rgba(5,8,16,1)': '#F4F6FB', // Bell border
  '#080C14': '#F8FAFC', // Deep dark -> Light gray
  '#070B16': '#F8FAFC', // Dark hover
  
  // Borders
  '#243050': '#E0E7FF', // Main borders
  '#3A4A68': '#C7D2FE', // Hover borders
  '#2E3C5C': '#C7D2FE', // Another hover border

  // Text
  '#EEF3FF': '#172554', // Primary text
  '#C4D2EE': '#0F172A', // Hover primary text
  '#8B9FC4': '#64748B', // Secondary text
  '#5A6E90': '#94A3B8', // Tertiary / Muted text

  // Accent (Orange -> Indigo)
  '#D4521A': '#4F46E5',

  // Specific translucent patterns
  'white/\\[0\\.06\\]': 'black/[0.04]',
  'white/\\[0\\.04\\]': 'black/[0.03]',
  'white/\\[0\\.02\\]': 'black/[0.02]',
  'white/5': 'black/5',
  'white/10': 'black/10',
  'white/20': 'black/20',
};

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    const dirent = fs.statSync(dirFile);
    if (dirent.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts') || dirFile.endsWith('.css') || dirFile.endsWith('.js')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
}

const files = walkSync(path.join(__dirname, '../src'));
let changedFilesCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  for (const [darkHex, lightHex] of Object.entries(colorMap)) {
    // For regex replacement, escape brackets if they are not already escaped keys
    const isEscapedKey = darkHex.includes('\\[');
    const escapedDarkHex = isEscapedKey ? darkHex : darkHex.replace(/[\[\]\(\)\.\,]/g, '\\$&');
    const regex = new RegExp(escapedDarkHex, 'gi'); // Case insensitive for hex
    content = content.replace(regex, lightHex);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    changedFilesCount++;
    console.log(`Updated ${file}`);
  }
}

console.log(`\nTwilight Glass theme swap complete! Updated ${changedFilesCount} files.`);
