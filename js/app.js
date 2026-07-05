/**
 * @file js/app.js
 * @description SDD Agent Selector V4 — bootstrap entry point.
 *
 * Pipeline (Phase 1 — pilot):
 *   1. Load the 5 data/*.json files via data-loader (with sessionStorage cache).
 *   2. Pull out `models` (the only payload the ref-table needs).
 *   3. Mount the ref-table component into `#ref-table-mount`.
 *
 * Source of truth (single source of truth):
 *   openspec/changes/2026-07-04-sdd-model-picker-refactor/
 *     ├─ proposal.md   — qué se está construyendo y por qué
 *     ├─ design.md     — arquitectura y module dependency graph
 *     ├─ tasks.md      — fases 0-4 con dependencias blocking
 *     ├─ state.yaml    — estado vivo del change (SDD engine)
 *     └─ specs/model-picker/spec.md — Given/When/Then scenarios (RFC 2119)
 *
 * Convenciones de stack:
 *   - pnpm (NO npm/yarn)
 *   - esbuild como bundler
 *   - Tailwind 3.4 + tokens.css custom (Phase 1)
 *   - vitest + jsdom para tests
 *   - TDD strict para módulos con lógica (model-scorer.js, data-loader.js, etc.)
 */

import { loadAll } from './services/data-loader.js';
import { render as renderRefTable } from './components/ref-table.js';

// Boot signal — useful to confirm bundle loaded in the right order.
console.log('SDD Agent Selector V4 — boot');

/**
 * Mount the ref-table pilot section once data is available. Failure is
 * surfaced inline (instead of a thrown error) so the rest of the page
 * (e.g. the empty <main>) still renders something.
 *
 * @returns {Promise<void>}
 */
async function bootRefTable() {
  const mount = document.getElementById('ref-table-mount');
  if (!mount) {
    console.warn('js/app.js: #ref-table-mount not found in DOM — skipping ref-table render');
    return;
  }
  try {
    const data = await loadAll();
    const summary = renderRefTable(mount, data.models);
    console.log(
      `js/app.js: ref-table rendered ${summary.rows} model(s), top=${summary.topKey}`
    );
  } catch (err) {
    console.error('js/app.js: ref-table mount failed', err);
    mount.innerHTML = `
      <div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">
        Error cargando data/*.json — revisá la consola. (${escapeHtml(String(err && err.message || err))})
      </div>`;
  }
}

/**
 * Minimal HTML escaper for the error message — avoids injecting a
 * template-string payload into the DOM via innerHTML.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Kick off the boot. We don't await at module top-level so import errors
//   (e.g. data files missing) surface in the catch above instead of
//   blocking the rest of the app.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRefTable, { once: true });
  } else {
    bootRefTable();
  }
}
