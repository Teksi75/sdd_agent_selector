/**
 * @file js/app.js
 * @description SDD Agent Selector V4 — bootstrap entry point.
 *
 * Pipeline:
 *   1. Load the 5 data/*.json files via data-loader (cache via sessionStorage).
 *   2. Mount ref-table (#ref-table-mount), config-selector (#config-mount),
 *      workflow-table (#workflow-mount), cli-mirror-table (#cli-mirror-mount),
 *      justification-ui (#justification-mount), composite-chart
 *      (#composite-chart-mount), pricing-chart (#pricing-chart-mount),
 *      freshness-badge (#freshness-mount).
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
import { render as renderCompositeChart } from './components/composite-chart.js';
import { render as renderPricingChart } from './components/pricing-chart.js';
import { render as renderCliMirrorTable } from './components/cli-mirror-table.js';
import { render as renderFreshnessBadge } from './components/freshness-badge.js';
import { render as renderJustificationUI } from './components/justification-ui.js';

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
 * The onSelect callback re-renders the workflow-table (9 SDD phases),
 * the cli-mirror-table (all 18 agents), and the justification-ui
 * (per-agent cards) with the new assignment set.
 *
 * ID convention bridge: `data/phases.json` carries bare IDs (init,
 * explore, propose, ...), but the assignments object returned by
 * config-selector is keyed by agent IDs (sdd-init, sdd-explore, ...).
 * We bridge the two by (1) filtering the 18-agent assignment set to
 * the 9 SDD phase agents via the `sdd-` prefix, then (2) renaming
 * each key back to its bare phase id so the workflow-table component
 * stays decoupled from the agent-id naming convention.
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
  const renderCliMirror = makeCliMirrorRenderer(data);
  const renderJustification = makeJustificationRenderer(data);
  try {
    setSelectorData({ models: data.models, roleMatrix: data.roles, profiles: data.profiles });
    renderConfigSelector(mount, data.configs, (assignments) => {
      const phaseAssignments = {};
      for (const phase of data.phases || []) {
        const agentId = `sdd-${phase.id}`;
        if (assignments && assignments[agentId]) {
          phaseAssignments[phase.id] = assignments[agentId];
        }
      }
      renderWorkflow(phaseAssignments);
      renderCliMirror(assignments);
      renderJustification(assignments);
      const assigned = Object.values(phaseAssignments).filter((a) => a && a.key).length;
      console.log(
        `js/app.js: config selected — ${assigned}/${(data.phases || []).length} phase row(s) assigned`
      );
    });
    console.log(`js/app.js: config-selector rendered ${data.configs.length} button(s)`);
  } catch (err) {
    console.error('js/app.js: config-selector mount failed', err);
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando config-selector — revisá la consola.</div>`;
  }
}

/**
 * Make a renderer for the cli-mirror-table (Phase 2e). Returns a no-op if
 * the mount element is missing so production wiring stays simple.
 *
 * @param {Object} data
 * @returns {(assignments: Object) => void}
 */
function makeCliMirrorRenderer(data) {
  const mount = document.getElementById('cli-mirror-mount');
  if (!mount) {
    console.warn('js/app.js: #cli-mirror-mount not found in DOM — skipping cli-mirror-table render');
    return () => {};
  }
  // Initial empty-state paint (no assignment until selectConfig runs).
  try {
    renderCliMirrorTable(mount, {}, data.roles);
    console.log('js/app.js: cli-mirror-table mounted (empty state — awaiting config selection)');
  } catch (err) {
    console.error('js/app.js: cli-mirror-table initial render failed', err);
  }
  return (assignments) => {
    try {
      const summary = renderCliMirrorTable(mount, assignments, data.roles);
      console.log(
        `js/app.js: cli-mirror-table re-rendered ${summary.withAssignment}/18 agent(s) with assignment`
      );
    } catch (err) {
      console.error('js/app.js: cli-mirror-table render failed', err);
      mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando cli-mirror-table — revisá la consola.</div>`;
    }
  };
}

/**
 * Make a renderer for the justification-ui (Phase 2e). Initial empty-state
 * paint, then re-renders whenever selectConfig fires.
 *
 * @param {Object} data
 * @returns {(assignments: Object) => void}
 */
function makeJustificationRenderer(data) {
  const mount = document.getElementById('justification-mount');
  if (!mount) {
    console.warn('js/app.js: #justification-mount not found in DOM — skipping justification-ui render');
    return () => {};
  }
  try {
    renderJustificationUI(mount, {}, data.roles, data.models);
    console.log('js/app.js: justification-ui mounted (empty state — awaiting config selection)');
  } catch (err) {
    console.error('js/app.js: justification-ui initial render failed', err);
  }
  return (assignments) => {
    try {
      const summary = renderJustificationUI(mount, assignments, data.roles, data.models);
      console.log(
        `js/app.js: justification-ui re-rendered ${summary.withAssignment}/18 agent(s) with justification`
      );
    } catch (err) {
      console.error('js/app.js: justification-ui render failed', err);
      mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando justification-ui — revisá la consola.</div>`;
    }
  };
}

/** Minimal HTML escaper — used only for the error messages above. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Mount the composite-score bar chart (Phase 2c). Pure render — does not
 * depend on the active config, so it runs once after data load.
 *
 * @param {Object} data
 */
function mountCompositeChart(data) {
  const mount = document.getElementById('composite-chart-mount');
  if (!mount) {
    console.warn('js/app.js: #composite-chart-mount not found in DOM — skipping composite-chart render');
    return;
  }
  try {
    const summary = renderCompositeChart(mount, data.models);
    console.log(
      `js/app.js: composite-chart rendered ${summary.bars} bar(s), maxScore=${summary.maxScore?.toFixed?.(2) ?? 'n/a'}`
    );
  } catch (err) {
    console.error('js/app.js: composite-chart mount failed', err);
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando composite-chart — revisá la consola.</div>`;
  }
}

/**
 * Mount the pricing bar chart (Phase 2d). Pure render — does not depend
 * on the active config, so it runs once after data load. Uses
 * `costEstimate(model)` from the scoring service with the default profile
 * `{ inputTokens: 1000, outputTokens: 500 }`.
 *
 * @param {Object} data
 */
function mountPricingChart(data) {
  const mount = document.getElementById('pricing-chart-mount');
  if (!mount) {
    console.warn('js/app.js: #pricing-chart-mount not found in DOM — skipping pricing-chart render');
    return;
  }
  try {
    const summary = renderPricingChart(mount, data.models);
    console.log(
      `js/app.js: pricing-chart rendered ${summary.bars} bar(s), maxCost=${summary.maxCost?.toFixed?.(6) ?? 'n/a'}`
    );
  } catch (err) {
    console.error('js/app.js: pricing-chart mount failed', err);
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando pricing-chart — revisá la consola.</div>`;
  }
}

/**
 * Mount the freshness badge (Phase 2e). The data-loader strips `_meta`
 * from the loaded payload (intentional, to keep the boot payload clean),
 * so we re-fetch `data/models.json` once just to read the `_meta.lastSynced`
 * stamp. The Phase 3 data-sync service will own this properly; for now a
 * direct fetch is acceptable because the badge is purely informational.
 *
 * @param {Object} data - composed payload from data-loader (currently unused)
 */
function mountFreshnessBadge(data) {
  const mount = document.getElementById('freshness-mount');
  if (!mount) {
    console.warn('js/app.js: #freshness-mount not found in DOM — skipping freshness-badge render');
    return;
  }
  const onRefresh = () => {
    // Phase 2e: placeholder. Real dataSync.refresh() wires in Phase 3.
    console.log('js/app.js: refresh clicked (Phase 3 wiring pending)');
  };
  // Fetch the raw models.json (re-uses sessionStorage cache transparently).
  fetch('data/models.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((raw) => {
      const meta = (raw && raw._meta) || { lastSynced: new Date().toISOString().slice(0, 10) };
      const summary = renderFreshnessBadge(mount, meta, { onRefresh });
      console.log(
        `js/app.js: freshness-badge rendered (${summary.daysOld}d old, warning=${summary.warning})`
      );
    })
    .catch((err) => {
      console.error('js/app.js: freshness-badge meta fetch failed', err);
      // Fallback: render with today's date so the badge still appears.
      renderFreshnessBadge(mount, { lastSynced: new Date().toISOString().slice(0, 10) }, { onRefresh });
    });
}

/**
 * Top-level orchestrator — load data once, mount all sections.
 * @returns {Promise<void>}
 */
async function bootAll() {
  try {
    const data = await loadAll();
    mountRefTable(data);
    mountConfigSelector(data);
    mountCompositeChart(data);
    mountPricingChart(data);
    mountFreshnessBadge(data);
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
