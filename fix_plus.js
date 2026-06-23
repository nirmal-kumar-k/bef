const fs = require('fs');

const filesToFix = [
  'd:\\BEF\\components\\patterns\\product-mapping-modal.tsx',
  'd:\\BEF\\components\\orders\\new-order-modal.tsx',
  'd:\\BEF\\app\\products\\page.tsx',
  'd:\\BEF\\app\\patterns\\page.tsx',
  'd:\\BEF\\app\\orders\\page.tsx'
];

filesToFix.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('<Plus weight="duotone"')) {
    content = content.replace(/<Plus weight="duotone"/g, '<Plus weight="bold"');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  }
});
