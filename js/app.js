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
import { refresh as dataSyncRefresh, isStale } from './services/data-sync.js';

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
 * Returns a `reRender(freshData?)` function so the data-sync refresh
 * path can re-validate the active config without forcing the user to
 * re-click the button.
 *
 * @param {Object} data
 * @returns {(freshData?: Object) => void} reRender — re-renders with the
 *   current active config. `freshData` (optional) updates the data
 *   layer before re-rendering.
 */
function mountConfigSelector(data) {
  const mount = document.getElementById('config-mount');
  if (!mount) {
    console.warn('js/app.js: #config-mount not found in DOM — skipping config-selector render');
    return () => {};
  }
  let activeKey = null;
  const renderWorkflow = makeWorkflowRenderer(data);
  const renderCliMirror = makeCliMirrorRenderer(data);
  const renderJustification = makeJustificationRenderer(data);

  /**
   * Bridge assignments → render the three downstream sections.
   * Pulled out so the revalidate path can call it without re-doing the
   * ID-convention dance.
   *
   * @param {Object} assignments - keyed by agent id (sdd-init, jd-judge-a, ...)
   */
  function renderDownstream(assignments) {
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
      `js/app.js: config revalidated — ${assigned}/${(data.phases || []).length} phase row(s) assigned`
    );
  }

  try {
    setSelectorData({ models: data.models, roleMatrix: data.roles, profiles: data.profiles });
    renderConfigSelector(mount, data.configs, (assignments) => {
      // Capture which key produced this assignment set. The config-selector
      //   module stores _activeKey internally — we mirror it here so the
      //   reRender path can replay the same key.
      // The simplest way to know the key: each config button has
      //   data-config-key; we read it from the .active button. If the
      //   user hasn't clicked yet (initial paint), skip.
      const activeBtn = mount.querySelector('button.active[data-config-key]');
      if (activeBtn) activeKey = activeBtn.dataset.configKey;
      renderDownstream(assignments);
      const assigned = Object.keys(assignments || {}).filter(
        (k) => assignments[k] && assignments[k].key
      ).length;
      console.log(
        `js/app.js: config selected (${activeKey}) — ${assigned}/${Object.keys(data.roles || {}).length} agent(s) assigned`
      );
    });
    console.log(`js/app.js: config-selector rendered ${data.configs.length} button(s)`);
  } catch (err) {
    console.error('js/app.js: config-selector mount failed', err);
    mount.innerHTML = `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando config-selector — revisá la consola.</div>`;
    return () => {};
  }

  /**
   * Re-render the active config using the current (or fresh) data layer.
   * Called from data-sync refresh path so the user sees fresh assignments
   * without having to re-click.
   *
   * @param {Object} [freshData] - optional fresh payload from loadAll()
   * @returns {void}
   */
  return function reRender(freshData) {
    const d = freshData || data;
    // If freshData is supplied, re-inject it into config-selector so
    //   getBestFor picks up new prices/benchmarks.
    if (freshData) {
      try {
        setSelectorData({
          models: d.models,
          roleMatrix: d.roles,
          profiles: d.profiles,
        });
      } catch (err) {
        console.warn('js/app.js: reRender setData failed', err);
        return;
      }
    }
    if (!activeKey) return; // user hasn't picked a config yet
    const btn = mount.querySelector(`button[data-config-key="${activeKey}"]`);
    if (btn) {
      // Trigger the same click handler config-selector wired up.
      btn.click();
    }
  };
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
 * Mount the freshness badge (Phase 3 wiring). The data-loader strips
 * `_meta` from the loaded payload (intentional, to keep the boot payload
 * clean), so we re-fetch `data/models.json` once just to read the
 * `_meta.lastSynced` stamp. The badge exposes a manual refresh button
 * wired to `dataSync.refresh()`; after a successful refresh we re-validate
 * the active config and re-render the justification-ui (in case the
 * reference model price changed and the cost ceilings shifted).
 *
 * Forced-refresh on boot: if the cached meta is stale (>7 days), we run
 * ONE refresh attempt per session so the user sees fresh data without
 * having to click the button. Failures are silent (console.warn only)
 * — the cached data stays usable.
 *
 * @param {Object} data - composed payload from data-loader
 * @param {() => void} [revalidate] - callback to re-run selectConfig with
 *   the currently active key (so justification + workflow re-render after
 *   a refresh). Wired by bootAll.
 */
function mountFreshnessBadge(data, revalidate) {
  const mount = document.getElementById('freshness-mount');
  if (!mount) {
    console.warn('js/app.js: #freshness-mount not found in DOM — skipping freshness-badge render');
    return;
  }

  /**
   * Pull `lastSynced` from a raw models.json payload (the data-loader
   * strips `_meta` from the cached payload, so we need the raw form).
   *
   * @param {Object|null} raw
   * @returns {{lastSynced: string}}
   */
  function metaFromRaw(raw) {
    if (raw && raw._meta && typeof raw._meta.lastSynced === 'string') {
      return { lastSynced: raw._meta.lastSynced };
    }
    return { lastSynced: new Date().toISOString().slice(0, 10) };
  }

  /**
   * Fetch the raw models.json from disk (NOT the data-sync upstream URL).
   * This is local and synchronous-with-cache; used purely to read the
   * `_meta` block.
   *
   * @returns {Promise<Object|null>}
   */
  async function fetchRawMeta() {
    try {
      const r = await fetch('data/models.json');
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  /**
   * Re-render the badge after a state change (manual refresh or
   * forced-refresh). Pulls `_meta` from the freshest available source.
   */
  async function repaintBadge() {
    const raw = await fetchRawMeta();
    const meta = metaFromRaw(raw);
    renderFreshnessBadge(mount, meta, { onRefresh: handleRefreshClick });
  }

  /**
   * Click handler for the refresh button. Delegates to data-sync.
   * On success: repaint the badge + invoke the parent's revalidate
   * callback so the workflow + justification re-render with the
   * freshest data (e.g., if the reference model price changed and the
   * cost ceilings shifted).
   */
  async function handleRefreshClick() {
    console.log('js/app.js: refresh clicked — calling dataSync.refresh()');
    const result = await dataSyncRefresh();
    if (result.ok) {
      console.log(`js/app.js: dataSync.refresh() OK — ${result.files} files updated`);
      try {
        const fresh = await loadAll();
        // Re-inject the fresh data into the selectors so getBestFor uses the
        //   new prices/benchmarks.
        setSelectorData({ models: fresh.models, roleMatrix: fresh.roles, profiles: fresh.profiles });
        if (typeof revalidate === 'function') revalidate(fresh);
      } catch (err) {
        console.warn('js/app.js: re-load after refresh failed', err);
      }
    } else {
      console.warn(`js/app.js: dataSync.refresh() failed (${result.error}) — keeping cached data`);
    }
    await repaintBadge();
  }

  // First paint of the badge. Then, if the meta is stale, fire ONE
  // forced refresh per session.
  (async () => {
    const raw = await fetchRawMeta();
    const meta = metaFromRaw(raw);
    renderFreshnessBadge(mount, meta, { onRefresh: handleRefreshClick });
    console.log(
      `js/app.js: freshness-badge rendered (lastSynced=${meta.lastSynced})`
    );

    if (isStale(meta, 7)) {
      console.log(
        `js/app.js: data is stale — forcing one refresh per session (lastSynced=${meta.lastSynced})`
      );
      // Fire-and-forget; the handleRefreshClick path is reused so the
      //   repaint + revalidate happen automatically on success.
      handleRefreshClick().catch((err) => {
        console.warn('js/app.js: forced refresh threw', err);
      });
    }
  })();
}

/**
 * Top-level orchestrator — load data once, mount all sections.
 *
 * Phase 3 wiring: mountConfigSelector returns a `reRender()` function
 * (the active selectConfig + onSelect chain) so the freshness-badge
 * forced-refresh path can re-validate the active config and re-render
 * workflow + cli-mirror + justification without forcing the user to
 * re-click the config button.
 *
 * @returns {Promise<void>}
 */
async function bootAll() {
  try {
    const data = await loadAll();
    const reRender = mountConfigSelector(data);
    const revalidate = (freshData) => {
      if (typeof reRender === 'function') {
        try {
          reRender(freshData);
        } catch (err) {
          console.warn('js/app.js: revalidate after refresh failed', err);
        }
      }
    };
    mountRefTable(data);
    mountCompositeChart(data);
    mountPricingChart(data);
    mountFreshnessBadge(data, revalidate);
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
