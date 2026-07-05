/**
 * @file js/app.js
 * @description SDD Agent Selector V4 — bootstrap entry point.
 *
 * Pipeline:
 *   1. Load the 5 data/*.json files via data-loader (cache via sessionStorage).
 *   2. Mount ref-table (#ref-table-mount) and config-selector (#config-mount).
 *
 * Source of truth (single source of truth):
 *   openspec/changes/2026-07-04-sdd-model-picker-refactor/
 *     ├─ proposal.md   — qué se está construyendo y por qué
 *     ├─ design.md     — arquitectura y module dependency graph
 *     ├─ tasks.md      — fases 0-4 con dependencias blocking
 *     ├─ state.yaml    — estado vivo del change (SDD engine)
 *     └─ specs/model-picker/spec.md — Given/When/Then scenarios (RFC 2119)
 *
 * Convenciones de stack: pnpm, esbuild, Tailwind 3.4, vitest + jsdom, TDD strict.
 */

import { loadAll } from './services/data-loader.js';
import { render as renderRefTable } from './components/ref-table.js';
import {
  render as renderConfigSelector,
  setData as setSelectorData,
} from './components/config-selector.js';
import { render as renderWorkflowTable } from './components/workflow-table.js';

// Boot signal — useful to confirm bundle loaded in the right order.
console.log('SDD Agent Selector V4 — boot');

/**
 * Mount the ref-table pilot section. Failure is surfaced inline (instead of
 * a thrown error) so the rest of the page still renders something.
 *
 * @param {Object} data - composed payload from data-loader
 */
function mountRefTable(data) {
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
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando ref-table — revisá la consola.</div>`;
  }
}

/**
 * Mount the workflow-table (Phase 2b). Wired into the config-selector
 * onSelect callback so it re-renders whenever the active config changes.
 *
 * @param {Object} data
 * @returns {(assignments: Object) => void} callback to render the table for a given assignment set
 */
function makeWorkflowRenderer(data) {
  const mount = document.getElementById('workflow-mount');
  if (!mount) {
    console.warn('js/app.js: #workflow-mount not found in DOM — skipping workflow-table render');
    return () => {};
  }
  return (assignments) => {
    try {
      const summary = renderWorkflowTable(mount, assignments, data.models, data.phases);
      console.log(`js/app.js: workflow-table rendered ${summary.rows} phase row(s)`);
    } catch (err) {
      console.error('js/app.js: workflow-table render failed', err);
      mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando workflow-table — revisá la consola.</div>`;
    }
  };
}

/**
 * Mount the config-selector (Phase 2a).
 *
 * Pipeline: setData({models, roleMatrix, profiles}) + render(mount, configs, onSelect).
 * The onSelect callback re-renders the workflow-table with the 9-phase
 * subset of the 18-agent assignment set.
 *
 * @param {Object} data
 */
function mountConfigSelector(data) {
  const mount = document.getElementById('config-mount');
  if (!mount) {
    console.warn('js/app.js: #config-mount not found in DOM — skipping config-selector render');
    return;
  }
  const renderWorkflow = makeWorkflowRenderer(data);
  try {
    setSelectorData({ models: data.models, roleMatrix: data.roles, profiles: data.profiles });
    renderConfigSelector(mount, data.configs, (assignments) => {
      const phaseIds = new Set((data.phases || []).map((p) => p.id));
      const phaseAssignments = {};
      for (const [agent, a] of Object.entries(assignments || {})) {
        if (phaseIds.has(agent)) phaseAssignments[agent] = a;
      }
      renderWorkflow(phaseAssignments);
      const assigned = Object.values(phaseAssignments).filter((a) => a && a.key).length;
      console.log(
        `js/app.js: config selected — ${assigned}/${phaseIds.size} phase row(s) assigned`
      );
    });
    console.log(`js/app.js: config-selector rendered ${data.configs.length} button(s)`);
  } catch (err) {
    console.error('js/app.js: config-selector mount failed', err);
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando config-selector — revisá la consola.</div>`;
  }
}

/** Minimal HTML escaper — used only for the error messages above. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Top-level orchestrator — load data once, mount both sections.
 * @returns {Promise<void>}
 */
async function bootAll() {
  try {
    const data = await loadAll();
    mountRefTable(data);
    mountConfigSelector(data);
  } catch (err) {
    console.error('js/app.js: data load failed', err);
  }
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
