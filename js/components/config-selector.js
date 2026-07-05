// js/components/config-selector.js
// Phase 2a — config-selector component.
//
// Contract (per design.md "Components — config-selector" + spec.md
//   "Configuration Management — selectConfig" + "Twin Judge Constraint"):
//
//   setData({ models, roleMatrix, profiles })
//     — inject the data layer (one-time or per refresh).
//
//   render(targetEl, configs, onSelect)
//     — paints one button per config (data-config-key, data-config-name,
//       data-config-strategy), wires click handlers → selectConfig.
//     — the buttons start with NO .active class until selectConfig fires.
//
//   selectConfig(key)
//     — 1. validates the config exists in `configs`
//     — 2. resolves the config's `strategy`
//     — 3. for each of the 18 agents in `roleMatrix`, calls getBestFor
//            to compute the {key, model, score, cost, ...} assignment
//     — 4. validates twin judge: jd-judge-a.key === jd-judge-b.key
//            (throws InvalidConfigError with the spec-pinned message)
//     — 5. on success: updates DOM (.active on the chosen button;
//            removes it from siblings) + invokes onSelect(assignments)
//     — idempotent: re-selecting the active config is a no-op (no
//       re-render, no callback re-fire)
//
// Exports:
//   InvalidConfigError — class extending Error, name === 'InvalidConfigError'
//   render             — function (targetEl, configs, onSelect)
//   selectConfig       — function (key)
//   setData            — function ({ models, roleMatrix, profiles })
//   resetForTests      — internal helper, exported for test isolation
//
// State is stored in a single module-level object so the public functions
// don't grow to 5 positional arguments. The component is deliberately
// NOT a class — keeping it as plain exports matches the style of
// ref-table.js and lets app.js wire it into a stateless bootstrap.
//
// Idempotency rule (spec "Scenario: Idempotent selection"):
//   "calling selectConfig twice with the same key produces the same
//    DOM state and assignments" — and the test in this PR pins
//   "no unnecessary re-renders occur" by asserting the onSelect
//   callback fires exactly once. We early-return when the requested
//   key matches the currently active one.
//
// Error message (spec "Twin Judge Constraint"):
//   The string must match exactly:
//     'jd-judge-a and jd-judge-b must resolve to the same model
//      (twin judge constraint violated)'
//   Do NOT reformat (e.g., lowercase, add periods) — spec pins the
//   verbatim text and tests assert it byte-for-byte.

import { getBestFor } from '../services/model-scorer.js';

/**
 * Error thrown when a config cannot be selected because of a hard
 * constraint violation (twin judge mismatch, unknown config key, etc.).
 * The `name` is set so `err.name === 'InvalidConfigError'` lets callers
 * `instanceof`-discriminate without depending on the class identity
 * across module re-evaluation (relevant for tests that hot-reload).
 */
export class InvalidConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

/**
 * Module-level state for the component. Kept as a single object so
 * tests can reset it via `resetForTests` and so the public functions
 * can stay argument-minimal (only `selectConfig(key)` per the spec).
 *
 * Shape:
 *   {
 *     targetEl:    HTMLElement | null,
 *     configs:     Array<{key, name, strategy, ...}> | null,
 *     onSelect:    Function | null,
 *     models:      Object | null,      // {key: model}
 *     roleMatrix:  Object | null,      // {agent: {minReasoning, costRatio, role}}
 *     profiles:    Object | null,      // {agent: {inputTokens, outputTokens}}
 *     activeKey:   string | null,      // currently selected config key
 *     lastAssignments: Object | null,  // memoized assignments for idempotency check
 *   }
 *
 * @type {Object}
 */
const state = {
  targetEl: null,
  configs: null,
  onSelect: null,
  models: null,
  roleMatrix: null,
  profiles: null,
  activeKey: null,
  lastAssignments: null,
};

/**
 * Inject the data layer. Called once by the bootstrap (or by tests).
 * The component does NOT fetch on its own — separation of concerns
 * keeps this file sync-free and easy to unit-test.
 *
 * @param {{models: Object, roleMatrix: Object, profiles: Object}} data
 */
export function setData({ models, roleMatrix, profiles }) {
  state.models = models && typeof models === 'object' ? models : null;
  state.roleMatrix =
    roleMatrix && typeof roleMatrix === 'object' ? roleMatrix : null;
  state.profiles = profiles && typeof profiles === 'object' ? profiles : null;
}

/**
 * Internal: clear all state. Exported so tests can isolate cases.
 * Does NOT touch the DOM — callers (or tests) control that lifecycle.
 *
 * @returns {void}
 */
export function resetForTests() {
  state.targetEl = null;
  state.configs = null;
  state.onSelect = null;
  state.models = null;
  state.roleMatrix = null;
  state.profiles = null;
  state.activeKey = null;
  state.lastAssignments = null;
}

/**
 * Verify the data layer is injected before any computation runs.
 * Throws InvalidConfigError (rather than a generic TypeError) because
 * a missing data injection is a config-time failure from the caller's
 * perspective, and the wording helps debugging.
 */
function requireData() {
  if (!state.models || !state.roleMatrix || !state.profiles) {
    throw new InvalidConfigError(
      'config-selector: setData({models, roleMatrix, profiles}) must be called before selectConfig'
    );
  }
}

/**
 * Look up a config by `key`. Returns the config object or `null`.
 * Centralized here so selectConfig and the click handlers share
 * the same resolution semantics.
 *
 * @param {string} key
 * @returns {Object|null}
 */
function findConfig(key) {
  if (!state.configs) return null;
  for (const cfg of state.configs) {
    if (cfg && cfg.key === key) return cfg;
  }
  return null;
}

/**
 * Apply .active class changes in one pass. Always called AFTER the
 * twin judge check has succeeded — so it's safe to mutate.
 */
function paintActive(key) {
  if (!state.targetEl) return;
  const buttons = state.targetEl.querySelectorAll('button[data-config-key]');
  for (const btn of buttons) {
    if (btn.getAttribute('data-config-key') === key) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  }
}

/**
 * Compute assignments for every agent in the role matrix using the
 * given strategy. Pure helper (no state mutation, no DOM) — exposed
 * via tests and reused by selectConfig.
 *
 * @param {string} strategy
 * @returns {Object<string, Object>} keyed by agent id
 */
function computeAssignments(strategy) {
  const agents = Object.keys(state.roleMatrix);
  const assignments = {};
  for (const agent of agents) {
    assignments[agent] = getBestFor(
      agent,
      state.models,
      state.roleMatrix,
      state.profiles,
      strategy
    );
  }
  return assignments;
}

/**
 * Select a config by `key`. Implements the spec flow:
 *
 *   1. Validate config exists.
 *   2. Resolve strategy from the config.
 *   3. Compute per-agent assignments via getBestFor (18 agents).
 *   4. Validate twin judge (jd-judge-a.key === jd-judge-b.key).
 *      Mismatch → throw InvalidConfigError with the spec-pinned message,
 *      with NO DOM mutation (per spec "Scenario: Twin judges would
 *      resolve to different models" — "no UI state is mutated").
 *   5. Update DOM (.active on the chosen button).
 *   6. Fire the onSelect callback with the assignments.
 *
 * Idempotent: if `key === state.activeKey`, return without firing
 * the callback or repainting. Spec "Scenario: Idempotent selection":
 * "calling selectConfig twice with the same key produces the same
 *  DOM state and assignments" + "no unnecessary re-renders occur".
 *
 * @param {string} key
 * @returns {void}
 * @throws {InvalidConfigError}
 */
export function selectConfig(key) {
  // Always look up the config in the live state — a missing config is
  //   a config-time error, NOT a runtime constraint violation, so we
  //   still throw InvalidConfigError for caller consistency (apps can
  //   catch a single type and decide what to do).
  const cfg = findConfig(key);
  if (!cfg) {
    throw new InvalidConfigError(`Unknown config key: "${key}"`);
  }

  // Idempotency guard: re-selecting the active config returns silently.
  // Memoized assignments let us short-circuit before the (relatively
  //   expensive) 18-agent getBestFor round-trip.
  if (key === state.activeKey) return;

  // Now we need real data — fail fast if it wasn't injected.
  requireData();

  // Compute assignments across the 18-agent matrix.
  const assignments = computeAssignments(cfg.strategy);

  // Twin judge constraint: same key required.
  const a = assignments['jd-judge-a']?.key ?? null;
  const b = assignments['jd-judge-b']?.key ?? null;
  if (a !== b) {
    // Spec pins this exact message — do NOT change.
    throw new InvalidConfigError(
      'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)'
    );
  }

  // Commit: paint + fire callback. Only reached when the constraint
  //   has succeeded AND the key actually changed (idempotency above).
  state.activeKey = key;
  state.lastAssignments = assignments;
  paintActive(key);

  if (typeof state.onSelect === 'function') {
    state.onSelect(assignments);
  }
}

/**
 * Render the config-selector buttons into `targetEl`.
 *
 * Pure-ish render — only side-effect within `targetEl` and the
 * module-level `state`. The click handler delegates to `selectConfig`,
 * which enforces the same validation flow as a direct call. Tests
 * can therefore call selectConfig directly (no click needed) and
 * assert the same outcome.
 *
 * Each button carries:
 *   - data-config-key     (the slug used by selectConfig)
 *   - data-config-strategy (debug + e2e selector)
 *   - data-config-name    (debug + e2e selector)
 *   - aria-pressed        ('true' | 'false'; updated on selection)
 *   - .active             (CSS class; mirrors aria-pressed)
 *
 * @param {HTMLElement} targetEl
 * @param {Array<{key: string, name: string, strategy: string}>} configs
 * @param {(assignments: Object) => void} onSelect
 * @returns {{ buttons: number }}
 */
export function render(targetEl, configs, onSelect) {
  if (!targetEl || typeof targetEl.querySelector !== 'function') {
    throw new TypeError('config-selector.render: targetEl must be an HTMLElement');
  }
  if (!Array.isArray(configs)) {
    throw new TypeError('config-selector.render: configs must be an array');
  }
  const safeOnSelect = typeof onSelect === 'function' ? onSelect : () => {};

  // Capture references for the click closures.
  state.targetEl = targetEl;
  state.configs = configs;
  state.onSelect = safeOnSelect;

  const html = configs
    .map((cfg) => {
      const key = escapeAttr(cfg.key);
      const name = escapeHtml(cfg.name);
      const description = escapeHtml(cfg.description || '');
      const strategy = escapeAttr(cfg.strategy || '');
      return `
        <button
          type="button"
          data-config-key="${key}"
          data-config-strategy="${strategy}"
          data-config-name="${escapeAttr(cfg.name || '')}"
          aria-pressed="false"
          title="${escapeAttr(cfg.description || cfg.name || '')}"
          class="config-btn rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700/60">
          <span class="block text-base">${name}</span>
          ${description ? `<span class="block text-xs text-slate-400 font-normal mt-0.5">${description}</span>` : ''}
        </button>`;
    })
    .join('');

  targetEl.innerHTML = `
    <div class="flex flex-wrap gap-2" role="group" aria-label="Selector de configuración">
      ${html}
    </div>
  `;

  // Wire the click handlers AFTER innerHTML so the buttons exist.
  const buttons = targetEl.querySelectorAll('button[data-config-key]');
  for (const btn of buttons) {
    const key = btn.getAttribute('data-config-key');
    btn.addEventListener('click', () => {
      try {
        selectConfig(key);
      } catch (err) {
        // Surface the error to the console so users with DevTools open
        //   see what went wrong (e.g., twin judge violation on dev data).
        // We deliberately do NOT swallow the error: callers / tests
        //   detect it via the throw from selectConfig directly.
        // eslint-disable-next-line no-console
        console.error('config-selector: selectConfig threw', err);
        throw err;
      }
    });
  }

  return { buttons: buttons.length };
}

/**
 * Minimal HTML escapers (mirroring ref-table.js — both files share
 * the same risk model: arbitrary config names + descriptions from
 * data/configs.json rendered via innerHTML).
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}
