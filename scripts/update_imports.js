const fs = require('fs');
const path = require('path');

const srcDir = path.join('d:\\BEF', 'src');

function updateImportsInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Direct alias mappings
    const mappings = [
        { from: /@\/components\/ui/g, to: '@/shared/ui' },
        { from: /@\/components\/sidebar/g, to: '@/shared/layouts/sidebar' },
        { from: /@\/components\/topbar/g, to: '@/shared/layouts/topbar' },
        { from: /@\/components\/ingot-loader/g, to: '@/shared/ui/ingot-loader' },
        { from: /@\/components\/empty-state/g, to: '@/shared/ui/empty-state' },
        { from: /@\/components\/orders/g, to: '@/domains/orders/components' },
        { from: /@\/components\/patterns/g, to: '@/domains/patterns/components' },
        { from: /@\/components\/products/g, to: '@/domains/products/components' },
        { from: /@\/lib/g, to: '@/shared/lib' },

        // Handle specific relative paths (e.g. from layout.tsx)
        { from: /from\s+['"]\.\/app-layout['"]/g, to: 'from "@/shared/layouts/app-layout"' },

        // Handle deep relative imports like ../../components/ui/button
        { from: /['"](\.\.\/)+components\/ui/g, to: '"@/shared/ui' },
        { from: /['"](\.\.\/)+components\/orders/g, to: '"@/domains/orders/components' },
        { from: /['"](\.\.\/)+components\/patterns/g, to: '"@/domains/patterns/components' },
        { from: /['"](\.\.\/)+components\/products/g, to: '"@/domains/products/components' },
        { from: /['"](\.\.\/)+lib/g, to: '"@/shared/lib' },
    ];

    mappings.forEach(m => {
        content = content.replace(m.from, m.to);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated imports in', filePath);
    }
}

function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            updateImportsInFile(fullPath);
        }
    }
}

scanDir(srcDir);
console.log("Import updates complete.");
