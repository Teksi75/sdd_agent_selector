// esbuild.config.js
// Phase 4 build pipeline — produces a single self-contained dist/index.html
// with CSS + JS inlined and minified. No runtime CDN, no external requests.
//
// Pipeline:
//   1. tailwindcss CLI:  css/tokens.css -> dist/_tailwind.css
//   2. esbuild bundle:   js/app.js -> dist/_bundle.js (ESM, minified)
//   3. inline pass:      read index.html, replace <!-- __INLINE_CSS__ -->
//                        and <!-- __INLINE_JS__ --> with <style>/<script>,
//                        write dist/index.html.
//   4. cleanup:          remove the _tailwind.css + _bundle.js intermediates.
//
// Watch mode (--watch) re-runs all 3 steps on any js/** or css/tokens.css
// change. The build refuses to write dist/index.html if any runtime CDN
// reference (<script src=http>, <link href=http>, @import url(http))
// slips through.
//
// Source of truth: openspec/changes/2026-07-04-sdd-model-picker-refactor/
//                   design.md (Phase 4) + tasks.md 4.1-4.7

import { build, context } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

const DIST = resolve(__dirname, 'dist');
const TW_INPUT = resolve(__dirname, 'css/tokens.css');
const TW_OUTPUT = resolve(DIST, '_tailwind.css');
const JS_INPUT = resolve(__dirname, 'js/app.js');
const JS_OUTPUT = resolve(DIST, '_bundle.js');
const HTML_INPUT = resolve(__dirname, 'index.html');
const HTML_OUTPUT = resolve(DIST, 'index.html');

mkdirSync(DIST, { recursive: true });

/** Run `tailwindcss` CLI: css/tokens.css -> dist/_tailwind.css (minified). */
function buildTailwind() {
  const cli = resolve(__dirname, 'node_modules/tailwindcss/lib/cli.js');
  const r = spawnSync(process.execPath, [
    cli, 'build',
    '-i', TW_INPUT,
    '-o', TW_OUTPUT,
    '--minify',
  ], { stdio: 'inherit', cwd: __dirname });
  if (r.status !== 0) {
    throw new Error(`tailwindcss build failed (exit ${r.status})`);
  }
}

/** Run esbuild: js/app.js + imports -> dist/_bundle.js (ESM, minified). */
async function buildJs() {
  await build({
    entryPoints: [JS_INPUT],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020'],
    outfile: JS_OUTPUT,
    loader: {
      '.css': 'css',
      '.svg': 'dataurl',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
    },
    logLevel: 'info',
    metafile: true,
  });
}

/** Read index.html, inline CSS + JS, write dist/index.html. */
function inlineHtml() {
  const css = readFileSync(TW_OUTPUT, 'utf8');
  const js = readFileSync(JS_OUTPUT, 'utf8');
  const html = readFileSync(HTML_INPUT, 'utf8');

  if (!html.includes('<!-- __INLINE_CSS__ -->')) {
    throw new Error('index.html missing <!-- __INLINE_CSS__ --> placeholder');
  }
  if (!html.includes('<!-- __INLINE_JS__ -->')) {
    throw new Error('index.html missing <!-- __INLINE_JS__ --> placeholder');
  }

  const out = html
    .replace('<!-- __INLINE_CSS__ -->', `<style>${css}</style>`)
    .replace('<!-- __INLINE_JS__ -->', `<script type="module">${js}</script>`);

  // Refuse to ship a page with runtime CDN references. Defense in depth
  // — the workflow also re-checks.
  if (/<script[^>]+src\s*=\s*["']https?:/i.test(out)) {
    throw new Error('dist/index.html still has remote <script src=> — refusing to write');
  }
  if (/<link[^>]+href\s*=\s*["']https?:/i.test(out)) {
    throw new Error('dist/index.html still has remote <link href=> — refusing to write');
  }
  if (/@import\s+url\(\s*["']?https?:/i.test(out)) {
    throw new Error('dist/index.html still has @import url(https://...) — refusing to write');
  }

  writeFileSync(HTML_OUTPUT, out, 'utf8');
  console.log(`[esbuild] inlined HTML written — ${HTML_OUTPUT}`);
}

/** Remove the intermediate _tailwind.css + _bundle.js (dist/ ships only index.html). */
function cleanup() {
  for (const f of [TW_OUTPUT, JS_OUTPUT]) {
    try { unlinkSync(f); } catch { /* ignore — file may not exist */ }
  }
}

/** Run the full pipeline once. */
async function runBuild() {
  console.log('[esbuild] step 1/3 — tailwindcss');
  buildTailwind();
  console.log('[esbuild] step 2/3 — esbuild bundle');
  await buildJs();
  console.log('[esbuild] step 3/3 — inline HTML');
  inlineHtml();
  cleanup();
  console.log('[esbuild] build complete — dist/index.html (self-contained)');
}

if (isWatch) {
  const ctx = await context({
    entryPoints: [JS_INPUT],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    outdir: DIST,
    loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' },
    logLevel: 'info',
  });
  await ctx.watch();
  console.log('[esbuild] watching js/app.js — output: dist/index.html');
  // Run once on startup so dist/ is populated even before any edit.
  await runBuild();
} else {
  await runBuild();
}