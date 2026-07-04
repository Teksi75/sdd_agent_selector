// esbuild.config.js
// Bundle placeholder para Phase 0. El build completo (con Tailwind,
// inlining de CSS y HTML self-contained) viene en Phase 4 — ver
// openspec/changes/2026-07-04-sdd-model-picker-refactor/tasks.md.

import { build, context } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [resolve(__dirname, 'js/app.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  outfile: resolve(__dirname, 'dist/bundle.js'),
  loader: {
    '.css': 'css',
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
  },
  logLevel: 'info',
  metafile: true,
};

mkdirSync(dirname(options.outfile), { recursive: true });

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[esbuild] watching js/app.js — output: dist/bundle.js');
} else {
  const result = await build(options);
  console.log('[esbuild] build complete — dist/bundle.js');
  if (result.metafile) {
    // Phase 4 va a usar esto para size budgets.
  }
}