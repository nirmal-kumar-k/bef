const fs = require('fs');
const path = require('path');

const root = 'd:\\BEF';

// 1. Create directories
const dirs = [
  'src',
  'src/app',
  'src/domains/orders/components',
  'src/domains/orders/data',
  'src/domains/patterns/components',
  'src/domains/patterns/data',
  'src/domains/products/components',
  'src/domains/products/data',
  'src/domains/customers',
  'src/domains/production',
  'src/domains/reports',
  'src/shared/ui',
  'src/shared/layouts',
  'src/shared/lib',
  'src/infrastructure'
];

dirs.forEach(d => {
  const p = path.join(root, d);
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
});

function move(srcPath, destPath) {
  const s = path.join(root, srcPath);
  const d = path.join(root, destPath);
  if (fs.existsSync(s)) {
    if (!fs.existsSync(path.dirname(d))) {
        fs.mkdirSync(path.dirname(d), { recursive: true });
    }
    fs.cpSync(s, d, { recursive: true });
    fs.rmSync(s, { recursive: true, force: true });
    console.log(`Moved ${srcPath} to ${destPath}`);
  }
}

// 2. Move things
move('components/ui', 'src/shared/ui');
move('components/sidebar.tsx', 'src/shared/layouts/sidebar.tsx');
move('components/topbar.tsx', 'src/shared/layouts/topbar.tsx');
move('app/app-layout.tsx', 'src/shared/layouts/app-layout.tsx');
move('components/ingot-loader.tsx', 'src/shared/ui/ingot-loader.tsx');
move('components/empty-state.tsx', 'src/shared/ui/empty-state.tsx');

move('components/orders', 'src/domains/orders/components');
move('components/patterns', 'src/domains/patterns/components');
move('components/products', 'src/domains/products/components');

move('lib', 'src/shared/lib');

// move app files
if (fs.existsSync(path.join(root, 'app'))) {
    const appFiles = fs.readdirSync(path.join(root, 'app'));
    appFiles.forEach(f => {
        move(`app/${f}`, `src/app/${f}`);
    });
}

// Update tsconfig
const tsconfigPath = path.join(root, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
    let tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    tsconfig.compilerOptions.paths = {
      "@/shared/*": ["./src/shared/*"],
      "@/domains/*": ["./src/domains/*"],
      "@/infrastructure/*": ["./src/infrastructure/*"],
      "@/*": ["./src/*"]
    };
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    console.log("Updated tsconfig.json");
}

// Update components.json
const compjsonPath = path.join(root, 'components.json');
if (fs.existsSync(compjsonPath)) {
    let compjson = JSON.parse(fs.readFileSync(compjsonPath, 'utf8'));
    if (compjson.tailwind) {
        compjson.tailwind.css = "src/app/globals.css";
    }
    compjson.aliases = {
        components: "@/shared",
        utils: "@/shared/lib/utils",
        ui: "@/shared/ui",
        lib: "@/shared/lib",
        hooks: "@/shared/hooks"
    };
    fs.writeFileSync(compjsonPath, JSON.stringify(compjson, null, 2));
    console.log("Updated components.json");
}

console.log("Initial file structure migration complete.");
