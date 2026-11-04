import { build, transform } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('dist', { recursive: true });
execFileSync('node_modules/.bin/tsc', ['--emitDeclarationOnly'], { stdio: 'inherit' });
await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'esm', target: 'es2020',
  outfile: 'dist/index.js', sourcemap: true });
for (const minify of [false, true]) {
  await build({ entryPoints: ['src/browser.ts'], bundle: true, format: 'iife', target: 'es2020',
    outfile: `dist/space2book${minify ? '.min' : ''}.js`, minify });
}
const css = await readFile('src/host.css', 'utf8');
await writeFile('dist/space2book.css', css);
await writeFile('dist/space2book.min.css', (await transform(css, { loader: 'css', minify: true })).code);
