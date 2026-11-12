// Builds dist/esm (ESM + .d.ts) and dist/cjs (CommonJS + .d.ts) from src/.
// The engine is bundled into one file per format; the library has no runtime
// dependencies.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

const banner = { js: '/*! @kovapdf/krutidev-unicode | MIT | Built by KovaPDF, https://www.kovapdf.com */' };
const common = { entryPoints: [path.join(root, 'src/index.ts')], bundle: true, platform: 'neutral', target: 'es2018', banner, legalComments: 'none', logLevel: 'warning' };
await build({ ...common, format: 'esm', outfile: path.join(dist, 'esm/index.js') });
await build({ ...common, format: 'cjs', outfile: path.join(dist, 'cjs/index.js') });

// type declarations (ESM), copied for CommonJS: each folder's package.json says which module system its files use
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
// explicit .js on relative imports, so "moduleResolution": "node16" / "nodenext" consumers resolve them
for (const f of fs.readdirSync(path.join(dist, 'esm'), { recursive: true })) {
  if (!String(f).endsWith('.d.ts')) continue;
  const p = path.join(dist, 'esm', String(f));
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/(from\s+')(\.\.?\/[^']+?)(')/g, (m, a, spec, b) => (/\.[cm]?js$/.test(spec) ? m : a + spec + '.js' + b)));
}
fs.cpSync(path.join(dist, 'esm'), path.join(dist, 'cjs'), { recursive: true, filter: (p) => fs.statSync(p).isDirectory() || p.endsWith('.d.ts') });
fs.writeFileSync(path.join(dist, 'esm/package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(dist, 'cjs/package.json'), '{ "type": "commonjs" }\n');
console.log('built dist/esm and dist/cjs');
