const fs = require('fs');
const path = require('path');

const dirsToScan = ['app', 'components'];

const iconMap = {
  'Plus': 'Plus',
  'Trash2': 'Trash',
  'Check': 'Check',
  'ChevronsUpDown': 'CaretUpDown',
  'SearchIcon': 'MagnifyingGlass',
  'Search': 'MagnifyingGlass',
  'CheckIcon': 'Check',
  'ChevronDownIcon': 'CaretDown',
  'ChevronUpIcon': 'CaretUp',
  'X': 'X',
  'XIcon': 'X',
  'Menu': 'List',
  'Filter': 'Funnel',
  'ImageIcon': 'Image',
  'Image': 'Image',
  'Lock': 'Lock'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Find import { ... } from 'lucide-react'
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importsStr = match[1];
    const imports = importsStr.split(',').map(s => s.trim()).filter(s => s);
    
    let phosphorImports = [];
    let mappings = []; // { oldName, newName }

    imports.forEach(imp => {
      let oldName = imp;
      let alias = null;
      if (imp.includes(' as ')) {
        const parts = imp.split(' as ');
        oldName = parts[0].trim();
        alias = parts[1].trim();
      }

      const mappedName = iconMap[oldName];
      if (mappedName) {
        if (alias) {
           phosphorImports.push(`${mappedName} as ${alias}`);
           mappings.push({ oldName: alias, newName: alias, isAlias: true, realPhosphor: mappedName });
        } else {
           if (!phosphorImports.includes(mappedName)) phosphorImports.push(mappedName);
           mappings.push({ oldName: oldName, newName: mappedName });
        }
      } else {
        console.warn(`No mapping for ${oldName} in ${filePath}`);
      }
    });

    if (phosphorImports.length > 0) {
      const newImport = `import { ${phosphorImports.join(', ')} } from '@phosphor-icons/react'`;
      content = content.replace(match[0], newImport);
      changed = true;

      // Replace component usages
      mappings.forEach(m => {
        // Find <OldIcon ...> and replace with <NewIcon weight="duotone" ...>
        // Use a regex that catches <OldIcon/> or <OldIcon /> or <OldIcon className="..."/>
        const tagRegex = new RegExp(`<${m.oldName}(\\s|>)`, 'g');
        content = content.replace(tagRegex, `<${m.newName} weight="duotone"$1`);
      });
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Swapped icons in ${filePath}`);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

dirsToScan.forEach(scanDir);
console.log("Icon swapping complete.");
