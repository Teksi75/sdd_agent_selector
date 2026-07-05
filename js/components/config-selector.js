// js/components/config-selector.js
// Phase 2a — config-selector: 5 preset buttons + twin judge validation.
//
// Public API (per design.md "Components — config-selector" + spec
//   "Configuration Management — selectConfig" + "Twin Judge Constraint"):
//     InvalidConfigError  — Error subclass (name = 'InvalidConfigError')
//     setData({models, roleMatrix, profiles}) — data injection from data-loader
//     render(targetEl, configs, onSelect)    — paints buttons, wires clicks
//     selectConfig(key)                       — validate + compute + paint + fire
//
// Twin judge message is pinned byte-for-byte to the spec requirement.

import { getBestFor } from '../services/model-scorer.js';

export class InvalidConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

// Module-level state. Plain-export shape keeps the API minimal so the
// spec's `selectConfig(key)` signature is exactly a one-arg function.
let _targetEl = null;
let _configs = null;
let _onSelect = null;
let _models = null;
let _roleMatrix = null;
let _profiles = null;
let _activeKey = null;

/**
 * Inject the data layer. The component does NOT fetch on its own.
 * @param {{models: Object, roleMatrix: Object, profiles: Object}} data
 */
export function setData(data) {
  _models = data && data.models;
  _roleMatrix = data && data.roleMatrix;
  _profiles = data && data.profiles;
}

/** Reset all state — exported for test isolation only. */
export function resetForTests() {
  _targetEl = _configs = _onSelect = null;
  _models = _roleMatrix = _profiles = null;
  _activeKey = null;
}

/** Find a config by key. Returns null when no config registered or key missing. */
function findConfig(key) {
  if (!_configs) return null;
  for (const c of _configs) if (c.key === key) return c;
  return null;
}

/**
 * Paint .active on the chosen button (and remove it from siblings).
 * MUST be called only AFTER the twin judge check has succeeded.
 */
function paintActive(key) {
  for (const b of _targetEl.querySelectorAll('button[data-config-key]')) {
    b.classList.toggle('active', b.dataset.configKey === key);
  }
}

/**
 * Compute 18-agent assignments for the given strategy.
 * @param {string} strategy
 * @returns {Object<string, Object>}
 */
function computeAssignments(strategy) {
  const out = {};
  for (const agent of Object.keys(_roleMatrix)) {
    out[agent] = getBestFor(agent, _models, _roleMatrix, _profiles, strategy);
  }
  return out;
}

/**
 * Select a config by `key`. Implements the spec flow:
 *   1. validate config exists              → throw InvalidConfigError
 *   2. idempotency: same key → silent no-op
 *   3. compute 18-agent assignments via getBestFor
 *   4. twin judge: jd-judge-a.key === jd-judge-b.key; else throw (no DOM mutation)
 *   5. paint .active + invoke onSelect(assignments)
 * @param {string} key
 * @throws {InvalidConfigError}
 */
export function selectConfig(key) {
  const cfg = findConfig(key);
  if (!cfg) throw new InvalidConfigError(`Unknown config key: "${key}"`);
  if (key === _activeKey) return;     // idempotent: no work, no re-render

  if (!_models || !_roleMatrix || !_profiles) {
    throw new InvalidConfigError('config-selector: setData must be called before selectConfig');
  }

  const assignments = computeAssignments(cfg.strategy);
  const a = assignments['jd-judge-a']?.key ?? null;
  const b = assignments['jd-judge-b']?.key ?? null;
  if (a !== b) {
    throw new InvalidConfigError(
      'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)'
    );
  }

  _activeKey = key;
  paintActive(key);
  if (typeof _onSelect === 'function') _onSelect(assignments);
}

/**
 * Render the config-selector buttons into `targetEl` and wire click → selectConfig.
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
  _targetEl = targetEl;
  _configs = configs;
  _onSelect = typeof onSelect === 'function' ? onSelect : () => {};
  _activeKey = null;

  targetEl.innerHTML =
    '<div role="group" aria-label="Selector de configuración">' +
    configs
      .map(
        (c) =>
          `<button type="button" data-config-key="${esc(c.key)}" data-config-strategy="${esc(
            c.strategy || ''
          )}" class="config-btn">${esc(c.name)}</button>`
      )
      .join('') +
    '</div>';

  for (const btn of targetEl.querySelectorAll('button[data-config-key]')) {
    btn.addEventListener('click', () => {
      try {
        selectConfig(btn.dataset.configKey);
      } catch (err) {
        // Surface the error in DevTools so manual debugging is sane.
        // Re-throw so direct calls (tests, app code) see the throw too.
        // eslint-disable-next-line no-console
        console.error('config-selector: selectConfig threw', err);
        throw err;
      }
    });
  }
  return { buttons: configs.length };
}

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}
