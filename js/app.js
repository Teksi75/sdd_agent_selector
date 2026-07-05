/**
 * @file js/app.js
 * @description SDD Agent Selector V4 — bootstrap entry point.
 *
 * Pipeline (Phase 2a adds config-selector on top of the Phase 1 pilot):
 *   1. Load the 5 data/*.json files via data-loader (with sessionStorage cache).
 *   2. Mount the ref-table component into `#ref-table-mount`.
 *   3. Wire the config-selector into `#config-mount` so the user can
 *      pick a preset (economico / balanceado / maximo / hibrido / experimental).
 *      The 18-agent assignments are computed on click; downstream consumers
 *      (workflow-table + justification-ui, both Phase 2b/e) hook into
 *      the onSelect callback to re-render when the active config changes.
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
import {
  render as renderConfigSelector,
  setData as setSelectorData,
} from './components/config-selector.js';

// Boot signal — useful to confirm bundle loaded in the right order.
console.log('SDD Agent Selector V4 — boot');

/**
 * Mount the ref-table pilot section once data is available. Failure is
 * surfaced inline (instead of a thrown error) so the rest of the page
 * (e.g. the empty <main>) still renders something.
 *
 * @returns {Promise<void>}
 */
async function bootRefTable(data) {
  const mount = document.getElementById('ref-table-mount');
  if (!mount) {
    console.warn('js/app.js: #ref-table-mount not found in DOM — skipping ref-table render');
    return;
  }
  try {
    const summary = renderRefTable(mount, data.models);
    console.log(
      `js/app.js: ref-table rendered ${summary.rows} model(s), top=${summary.topKey}`
    );
  } catch (err) {
    console.error('js/app.js: ref-table mount failed', err);
    mount.innerHTML = `
      <div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">
        Error montando ref-table — revisá la consola. (${escapeHtml(String((err && err.message) || err))})
      </div>`;
  }
}

/**
 * Mount the config-selector (Phase 2a).
 *
 * Pipeline:
 *   1. Inject models + roleMatrix + profiles into config-selector via setData.
 *   2. render(5 buttons) into `#config-mount`.
 *   3. Wire the onSelect callback as a placeholder for the Phase 2b/e
 *      workflow-table + justification-ui re-render flow. Today it
 *      simply logs the assignment summary so we can eyeball the data.
 *
 * On InvalidConfigError (e.g., manipulated data triggers twin judge
 *   divergence), we surface the message inline and keep the previous
 *   active config selected (per spec "Scenario: Invalid config throws"
 *   "the UI shows the error message").
 *
 * @param {Object} data - composed payload from data-loader
 */
function bootConfigSelector(data) {
  const mount = document.getElementById('config-mount');
  if (!mount) {
    console.warn(
      'js/app.js: #config-mount not found in DOM — skipping config-selector render'
    );
    return;
  }

  try {
    setSelectorData({
      models: data.models,
      roleMatrix: data.roles,
      profiles: data.profiles,
    });
    renderConfigSelector(mount, data.configs, (assignments) => {
      // Placeholder workflow hook — Phase 2b (workflow-table) and
      //   Phase 2e (justification-ui) will subscribe here. For now we
      //   log the assignment counts so a manual click in DevTools is
      //   visibly traceable.
      const assigned = Object.values(assignments).filter(
        (a) => a && a.key
      ).length;
      console.log(
        `js/app.js: config selected — ${assigned}/${Object.keys(assignments).length} agents assigned`
      );
    });
    console.log(
      `js/app.js: config-selector rendered ${data.configs.length} button(s)`
    );
  } catch (err) {
    console.error('js/app.js: config-selector mount failed', err);
    mount.innerHTML = `
      <div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">
        Error montando config-selector — revisá la consola. (${escapeHtml(String((err && err.message) || err))})
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

// --- Top-level boot orchestrator ---------------------------------------
//
// One `loadAll()` call serves all sections — the loader caches in
// sessionStorage so subsequent invocations are free. Each section's
// failure is caught individually so a broken component doesn't take
// down the others.

/**
 * Load data once, then mount the ref-table (Phase 1) and config-selector
 * (Phase 2a) sections. Returns nothing — all visible state lives in the DOM.
 *
 * @returns {Promise<void>}
 */
async function bootAll() {
  let data;
  try {
    data = await loadAll();
  } catch (err) {
    // If the data layer is broken, EVERY section will fail to mount —
    //   surface that fact on every known mount point so users see it
    //   regardless of which section they're looking at.
    console.error('js/app.js: data load failed', err);
    const msg = escapeHtml(String((err && err.message) || err));
    for (const id of ['ref-table-mount', 'config-mount']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.innerHTML = `
        <div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">
          Error cargando data/*.json — revisá la consola. (${msg})
        </div>`;
    }
    return;
  }
  // Phase 1 pilot
  await bootRefTable(data);
  // Phase 2a — config selector (5 preset buttons with twin judge validation).
  //   The callback in `bootConfigSelector` re-renders the workflow-table
  //   + justification-ui sections in later PRs; today it is a placeholder
  //   that logs the assignment counts to the console.
  bootConfigSelector(data);
}

// Kick off the boot. We don't await at module top-level so import errors
//   (e.g. data files missing) surface in the catch above instead of
//   blocking the rest of the app.
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll, { once: true });
  } else {
    bootAll();
  }
}
