/**
 * @file js/app.js
 * @description SDD Agent Selector V5 — bootstrap entry point + render transaction.
 *
 * Pipeline (V5 Slice 3):
 *   1. Load the 6 data/*.json files via data-loader (cache via sessionStorage).
 *   2. Mount the subscription selector (Tier-1 sticky) and register the
 *      `sdd-provider-filter-change` listener BEFORE mounting it.
 *   3. One `recompute(reason)` per state change (boot / filter-change / data
 *      refresh):
 *        a. derive `eligibleModels` ONCE with `applyProviderFilter`;
 *        b. inject exactly that object into config-selector;
 *        c. compute the 18 assignments with the twin judge gate BEFORE any
 *           visible state mutates;
 *        d. re-render every mount (selector count, hero, tables, charts,
 *           workflow, CLI, justification, export content) — `innerHTML`
 *           overwrite, so no stale result survives.
 *
 * Source of truth (single source of truth):
 *   openspec/changes/2026-09-12-v5-subscription-selector/
 *     ├─ proposal.md   — qué se está construyendo y por qué
 *     ├─ design.md     — arquitectura y module dependency graph
 *     ├─ tasks.md      — slices con dependencias blocking
 *     └─ specs/model-picker/spec.md — Given/When/Then scenarios (RFC 2119)
 *
 * Convenciones de stack: pnpm, esbuild, Tailwind 3.4, vitest + jsdom, TDD strict.
 */

import { loadAll } from './services/data-loader.js';
import { applyProviderFilter } from './services/provider-filter.js';
import { render as renderRefTable } from './components/ref-table.js';
import {
  render as renderConfigSelector,
  setData as setSelectorData,
  selectConfig,
  recomputeActiveConfig,
  getActiveKey,
} from './components/config-selector.js';
import {
  render as renderSubscriptionSelector,
  getEnabled as getEnabledProviders,
  setVisibleCount,
  setEmptyState,
} from './components/subscription-selector.js';
import { render as renderWorkflowTable } from './components/workflow-table.js';
import { render as renderCompositeChart } from './components/composite-chart.js';
import { render as renderPricingChart } from './components/pricing-chart.js';
import { render as renderCliMirrorTable } from './components/cli-mirror-table.js';
import { render as renderFreshnessBadge } from './components/freshness-badge.js';
import { render as renderJustificationUI } from './components/justification-ui.js';
import { render as renderHeroStats } from './components/hero-stats.js';
import { refresh as dataSyncRefresh, isStale, DEFAULT_DATA_URL } from './services/data-sync.js';
// V5+ critique v2 — P2 eficiencia: keyboard shortcuts. The module
// self-registers a `keydown` listener at the document level and
// wires `?` to the help overlay, `g+i/j/k` to tier scrolling, `r`
// to the refresh button, and `Esc` to close the overlay. See
// js/components/keyboard-shortcuts.js for the full contract.
import { mount as mountKeyboardShortcuts } from './components/keyboard-shortcuts.js';
// V5+ KI-2: showToast is the user feedback channel for the freshness-badge
// "Actualizar ahora" button. Before this wiring, clicking the button ran
// the fetch but emitted no UI feedback at all — failures (including the
// 404 because Teksi75/sdd-data does not exist yet) were silent console.warn.
import { showToast } from './services/exporter.js';

// V5+ KI-P0-1: default config key to pre-select on first load. The
// `configs.json` entry for this key has description "punto de partida
// recomendado". Kept as a hardcoded constant here (not in configs.json)
// so a future refactor doesn't accidentally swap it — the pre-select
// is a UX decision about which strategy to show by default, and that's
// not a property the data layer should own.
export const DEFAULT_CONFIG_KEY = 'balanceado';

/**
 * Create an app instance. The production boot uses the defaults; tests inject
 * a fixture loader (`load`) and disable the optional wiring (shortcuts /
 * freshness badge) so the transaction runs hermetically in jsdom.
 *
 * @param {{
 *   load?: () => Promise<Object>,
 *   document?: Document,
 *   wireShortcuts?: boolean,
 *   wireFreshness?: boolean,
 * }} [options]
 * @returns {{ boot: Function, recompute: Function, applyData: Function, setEnabledSet: Function, getState: Function, destroy: Function }}
 */
export function createApp(options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const load = options.load || loadAll;
  const wireShortcuts = options.wireShortcuts !== false;
  const wireFreshness = options.wireFreshness !== false;

  // V5 Slice 3 — explicit state. `eligibleModels` is the single projection
  // shared by scoring, tables, charts, hero and export.
  const state = {
    data: null,
    enabledSet: [],
    eligibleModels: null,
    activeConfigKey: null,
    assignments: null,
    filterRevision: 0,
  };
  let inTransaction = false;
  let destroyed = false;
  let boundFilterChange = null;
  let boundHintClick = null;

  function mountEl(id) {
    return doc ? doc.getElementById(id) : null;
  }

  function errorCard(label) {
    return `<div class="rounded-xl border border-rose-800 bg-rose-900/40 p-4 text-sm text-rose-200">Error montando ${label} — revisá la consola.</div>`;
  }

  function renderInto(id, label, fn) {
    const el = mountEl(id);
    if (!el) return null;
    try {
      return fn(el);
    } catch (err) {
      console.error(`js/app.js: ${id} render failed`, err);
      el.innerHTML = errorCard(label);
      return null;
    }
  }

  function registryIds() {
    return new Set(((state.data && state.data.providers) || []).map((p) => p.id));
  }

  function enabledIdsFromRegistry(enabledMap, providers) {
    return (providers || [])
      .filter((p) => enabledMap && enabledMap[p.id] === true)
      .map((p) => p.id);
  }

  /** Export metadata for the CURRENT filter state (active providers + ts). */
  function buildExportContext() {
    const providers = (state.data && state.data.providers) || [];
    const enabled = new Set(state.enabledSet);
    const active = providers.filter((p) => enabled.has(p.id));
    return {
      providerIds: active.map((p) => p.id),
      providerNames: active.map((p) => p.name),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Bridge the 18-agent assignment set to the 9 phase-keyed rows the
   * workflow-table expects (`sdd-<phase-id>` → bare `<phase-id>`).
   */
  function phaseAssignments() {
    const out = {};
    const phases = (state.data && state.data.phases) || [];
    for (const phase of phases) {
      const a = state.assignments && state.assignments[`sdd-${phase.id}`];
      if (a) out[phase.id] = a;
    }
    return out;
  }

  /** Re-render the assignment-dependent surfaces (workflow / CLI / justif). */
  function renderAssignmentSurfaces() {
    if (!state.data || !state.eligibleModels) return;
    const exportContext = buildExportContext();
    renderInto('workflow-mount', 'workflow-table', (el) =>
      renderWorkflowTable(el, phaseAssignments(), state.eligibleModels, state.data.phases || [])
    );
    renderInto('cli-mirror-mount', 'cli-mirror-table', (el) =>
      renderCliMirrorTable(el, state.assignments || {}, state.data.roles, { exportContext })
    );
    renderInto('justification-mount', 'justification-ui', (el) =>
      renderJustificationUI(
        el,
        state.assignments || {},
        state.data.roles,
        state.eligibleModels,
        { exportContext }
      )
    );
  }

  /** Re-render EVERY mount. `innerHTML` overwrite kills stale results. */
  function renderAll() {
    if (!state.data) return;
    const eligible = state.eligibleModels || {};
    const eligibleCount = Object.keys(eligible).length;
    const exportContext = buildExportContext();

    // Subscription selector: live count + empty-state CTA.
    setVisibleCount(eligibleCount);
    setEmptyState(eligibleCount === 0);

    renderInto('hero-stats-mount', 'hero-stats', (el) =>
      renderHeroStats(el, {
        models: state.data.models,
        eligibleModels: eligible,
        roles: state.data.roles,
      })
    );
    renderInto('ref-table-mount', 'ref-table', (el) =>
      renderRefTable(el, eligible, {
        exportContext,
        fullCatalogModels: state.data.models,
      })
    );
    renderInto('composite-chart-mount', 'composite-chart', (el) =>
      renderCompositeChart(el, eligible, undefined, { exportContext })
    );
    renderInto('pricing-chart-mount', 'pricing-chart', (el) =>
      renderPricingChart(el, eligible, { exportContext })
    );
    renderAssignmentSurfaces();
  }

  /**
   * Single render transaction. Boot, `sdd-provider-filter-change` and data
   * refresh all funnel through here.
   *
   * @param {'boot'|'filter-change'|'refresh'|'external'} reason
   * @returns {{ ok: boolean, eligibleCount?: number, filterRevision?: number, error?: Error }}
   */
  function recompute(reason) {
    if (!state.data) return { ok: false, reason: 'no-data' };
    const data = state.data;

    // 1. ONE projection for every surface.
    const eligibleModels = applyProviderFilter(data.models, data.availability, state.enabledSet);
    const previousEligible = state.eligibleModels;
    const previousAssignments = state.assignments;
    const previousConfigKey = state.activeConfigKey;

    // 2. Inject exactly that object into config-selector.
    setSelectorData({ models: eligibleModels, roleMatrix: data.roles, profiles: data.profiles });

    // 3+4. Compute + twin check happen inside config-selector BEFORE any
    // visible mutation; onSelect only captures the confirmed assignments.
    inTransaction = true;
    try {
      if (!state.activeConfigKey) {
        selectConfig(DEFAULT_CONFIG_KEY, { silent: true });
      } else {
        recomputeActiveConfig({ silent: true });
      }
    } catch (err) {
      state.eligibleModels = previousEligible;
      state.assignments = previousAssignments;
      state.activeConfigKey = previousConfigKey;
      // Restore the module data set to the last visible projection.
      setSelectorData({
        models: previousEligible || data.models,
        roleMatrix: data.roles,
        profiles: data.profiles,
      });
      console.error(`js/app.js: recompute(${reason}) config gate failed`, err);
      if (previousEligible === null) {
        // First boot with a broken config: paint the empty state so the page
        // is usable instead of leaving the skeletons forever.
        state.eligibleModels = eligibleModels;
        state.assignments = state.assignments || {};
        renderAll();
      }
      return { ok: false, error: err };
    } finally {
      inTransaction = false;
    }

    // 5. Confirm state.
    state.eligibleModels = eligibleModels;
    state.activeConfigKey = getActiveKey();
    state.filterRevision += 1;

    // 6. Re-render every mount.
    renderAll();
    const assigned = Object.values(state.assignments || {}).filter((a) => a && a.key).length;
    console.log(
      `js/app.js: recompute(${reason}) — ${Object.keys(eligibleModels).length} elegible(s), ${assigned}/18 asignados`
    );
    return {
      ok: true,
      eligibleCount: Object.keys(eligibleModels).length,
      filterRevision: state.filterRevision,
    };
  }

  /** Mount the config-selector buttons and capture assignments on select. */
  function mountConfigSelector() {
    const mount = mountEl('config-mount');
    if (!mount) {
      console.warn('js/app.js: #config-mount not found in DOM — skipping config-selector render');
      return;
    }
    try {
      renderConfigSelector(mount, state.data.configs || [], (assignments) => {
        state.assignments = assignments;
        state.activeConfigKey = getActiveKey();
        // A direct user click must repaint the assignment surfaces now;
        // during the recompute transaction renderAll() owns the repaint.
        if (!inTransaction) renderAssignmentSurfaces();
      });
      console.log(`js/app.js: config-selector rendered ${(state.data.configs || []).length} button(s)`);
    } catch (err) {
      console.error('js/app.js: config-selector mount failed', err);
      mount.innerHTML = errorCard('config-selector');
    }
  }

  /**
   * Top-level orchestrator — load data once, mount all sections, run the
   * first `recompute('boot')`.
   *
   * @returns {Promise<{ ok: boolean, state?: Object, error?: Error }>}
   */
  async function boot() {
    if (!doc) {
      console.error('js/app.js: no document available — skipping boot');
      return { ok: false };
    }
    let data;
    try {
      data = await load();
    } catch (err) {
      console.error('js/app.js: data load failed', err);
      return { ok: false, error: err };
    }
    if (destroyed) return { ok: false };
    state.data = data;

    // Register the filter-change listener BEFORE mounting the selector so the
    // first state and every later change share the same recompute entry point.
    boundFilterChange = (evt) => {
      const detail = (evt && evt.detail) || {};
      const known = registryIds();
      state.enabledSet = Array.isArray(detail.enabledIds)
        ? detail.enabledIds.filter((id) => known.has(id))
        : state.enabledSet;
      recompute('filter-change');
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('sdd-provider-filter-change', boundFilterChange);
    }

    const selectorMount = mountEl('subscription-selector-mount');
    if (selectorMount && Array.isArray(data.providers) && data.providers.length > 0) {
      try {
        renderSubscriptionSelector(selectorMount, data.providers);
        state.enabledSet = enabledIdsFromRegistry(getEnabledProviders(), data.providers);
        console.log(
          `js/app.js: subscription-selector rendered ${data.providers.length} provider(s) — ${state.enabledSet.length} enabled`
        );
      } catch (err) {
        console.error('js/app.js: subscription-selector mount failed', err);
        selectorMount.innerHTML = errorCard('subscription-selector');
        state.enabledSet = [];
      }
    } else {
      // No selector mount / no registry → fail closed, never assume access.
      state.enabledSet = [];
    }

    // Keyboard shortcuts register once; idempotent.
    if (wireShortcuts) mountKeyboardShortcuts();

    mountConfigSelector();
    // Single entry point for the first full render.
    recompute('boot');

    if (wireFreshness) mountFreshnessBadge();

    // V5+ critique v2 — P0-1 2da mitad: hide the onboarding hint once the
    // user clicks any strategy button. The pre-select is silent (no DOM
    // click), so this listener is the clean separator.
    const configMount = mountEl('config-mount');
    const hint = mountEl('hero-onboarding-hint');
    if (configMount && hint) {
      boundHintClick = (e) => {
        if (e.target.closest('button[data-config-key]')) hint.style.display = 'none';
      };
      configMount.addEventListener('click', boundHintClick);
    }
    return { ok: true, state: getState() };
  }

  /**
   * Data-refresh entry point (used by the freshness badge after a successful
   * sync): stage the fresh payload and recompute through the same pipeline.
   * A gate failure rolls the staged payload back.
   *
   * @param {Object} nextData
   * @returns {{ ok: boolean, error?: Error }}
   */
  function applyData(nextData) {
    if (!nextData || typeof nextData !== 'object') {
      return { ok: false, reason: 'invalid-data' };
    }
    const previous = state.data;
    state.data = nextData;
    const result = recompute('refresh');
    if (!result.ok) state.data = previous;
    return result;
  }

  /**
   * Programmatic filter change (tests / future URL state). Validates ids
   * against the registry and recomputes.
   */
  function setEnabledSet(ids) {
    const known = registryIds();
    state.enabledSet = Array.isArray(ids) ? ids.filter((id) => known.has(id)) : [];
    return recompute('external');
  }

  /** Snapshot of the explicit app state. */
  function getState() {
    return {
      data: state.data,
      enabledSet: state.enabledSet.slice(),
      eligibleModels: state.eligibleModels,
      activeConfigKey: state.activeConfigKey,
      assignments: state.assignments,
      filterRevision: state.filterRevision,
    };
  }

  /** Remove the listeners registered by boot(). Idempotent. */
  function destroy() {
    destroyed = true;
    if (boundFilterChange && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('sdd-provider-filter-change', boundFilterChange);
      boundFilterChange = null;
    }
    if (boundHintClick) {
      const configMount = mountEl('config-mount');
      if (configMount) configMount.removeEventListener('click', boundHintClick);
      boundHintClick = null;
    }
  }

  /**
   * Mount the freshness badge. The data-loader strips `_meta` from the loaded
   * payload (intentional, to keep the boot payload clean), so we re-fetch
   * `data/models.json` once just to read the `_meta.lastSynced` stamp. The
   * badge exposes a manual refresh button wired to `dataSync.refresh()`; after
   * a successful refresh we stage the fresh payload via `applyData()` so the
   * whole transaction (eligible → assignments → mounts) re-runs.
   *
   * Forced-refresh on boot: if the cached meta is stale (>7 days), we run ONE
   * refresh attempt per session. Failures are silent (console.warn only) —
   * the cached data stays usable.
   */
  function mountFreshnessBadge() {
    const mount = mountEl('freshness-mount');
    if (!mount) {
      console.warn('js/app.js: #freshness-mount not found in DOM — skipping freshness-badge render');
      return;
    }

    /** Pull `lastSynced` from a raw models.json payload. */
    function metaFromRaw(raw) {
      if (raw && raw._meta && typeof raw._meta.lastSynced === 'string') {
        return { lastSynced: raw._meta.lastSynced };
      }
      return { lastSynced: new Date().toISOString().slice(0, 10) };
    }

    /** Local fetch of the raw models.json (NOT the data-sync upstream URL). */
    async function fetchRawMeta() {
      try {
        const r = await fetch('data/models.json');
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    }

    /** Re-render the badge after a state change. */
    async function repaintBadge() {
      const raw = await fetchRawMeta();
      renderFreshnessBadge(mount, metaFromRaw(raw), { onRefresh: handleRefreshClick });
    }

    /**
     * Click handler for the refresh button. Delegates to data-sync. On
     * success: stage the fresh payload through applyData() (same recompute
     * transaction as boot/filter-change) and repaint the badge.
     */
    async function handleRefreshClick() {
      console.log('js/app.js: refresh clicked — calling dataSync.refresh()');
      const btn = mount.querySelector('button[data-action="refresh"]');
      const setBusy = (busy) => {
        if (!btn) return;
        btn.disabled = busy;
        btn.setAttribute('aria-busy', busy ? 'true' : 'false');
        const label = btn.querySelector('span:last-child');
        if (label) label.textContent = busy ? 'Actualizando…' : 'Actualizar ahora';
      };
      setBusy(true);
      try {
        const result = await dataSyncRefresh({
          onProgress: (evt) => {
            if (typeof showToast !== 'function') return;
            if (evt.phase === 'start') {
              showToast('Actualizando datos…', { kind: 'success', durationMs: 1500 });
            } else if (evt.phase === 'success') {
              const dateSuffix = evt.lastSynced ? ` · sync ${evt.lastSynced}` : '';
              showToast(`Datos actualizados · ${evt.files} archivos${dateSuffix}`, {
                kind: 'success',
              });
            } else if (evt.phase === 'failure') {
              // Special-case the 404 on the upstream repo: tell the user
              // explicitly that the source repo doesn't exist (yet) and the
              // page is using the version baked in by the last deploy.
              const is404 = /\b404\b/.test(evt.error || '');
              const isRepoMissing = is404 && /sdd-data/.test(evt.source || DEFAULT_DATA_URL);
              const message = isRepoMissing
                ? 'No se pudo conectar al repo de datos — usando la versión local (actualizada en cada deploy)'
                : 'No se pudo actualizar — usando la versión local (cache)';
              showToast(message, { kind: 'error', durationMs: 4500 });
            }
          },
        });
        if (result.ok) {
          console.log(`js/app.js: dataSync.refresh() OK — ${result.files} files updated`);
          try {
            const fresh = await load();
            applyData(fresh);
          } catch (err) {
            console.warn('js/app.js: re-load after refresh failed', err);
          }
        } else {
          console.warn(`js/app.js: dataSync.refresh() failed (${result.error}) — keeping cached data`);
        }
      } finally {
        await repaintBadge();
        setBusy(false);
      }
    }

    // First paint of the badge. Then, if the meta is stale, fire ONE forced
    // refresh per session.
    (async () => {
      const raw = await fetchRawMeta();
      const meta = metaFromRaw(raw);
      renderFreshnessBadge(mount, meta, { onRefresh: handleRefreshClick });
      console.log(`js/app.js: freshness-badge rendered (lastSynced=${meta.lastSynced})`);

      if (isStale(meta, 7)) {
        console.log(
          `js/app.js: data is stale — forcing one refresh per session (lastSynced=${meta.lastSynced})`
        );
        handleRefreshClick().catch((err) => {
          console.warn('js/app.js: forced refresh threw', err);
        });
      }
    })();
  }

  return { boot, recompute, applyData, setEnabledSet, getState, destroy };
}

/** Boot signal — useful to confirm bundle loaded in the right order. */
console.log('SDD Agent Selector V5 — boot');

/** Production boot: one app instance with the default wiring. */
export function bootAll() {
  return createApp().boot();
}

// Kick off the boot. We don't await at module top-level so import errors
//   (e.g. data files missing) surface in the catch inside boot() instead of
//   blocking the rest of the app.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bootAll(); }, { once: true });
  } else {
    bootAll();
  }
}
