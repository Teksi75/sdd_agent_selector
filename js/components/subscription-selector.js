// js/components/subscription-selector.js
// V5 slice 2 — Tier-1 sticky subscription selector.
//
// Owns the `sdd-providers-v1` preference (separate from the loader's
// sessionStorage CACHE_KEY). Contract (delta spec "Provider Preference
// Persistence" + design "Preferencias de proveedor"):
//   - default all-enabled; one checkbox per registry provider (array order).
//   - persisted shape `{ version: 1, enabled: { "<id>": boolean } }` with
//     every known id present (including `false`).
//   - invalid JSON / wrong version / unknown id / missing known id /
//     non-boolean value → reset to all-enabled and rewrite known ids only.
//   - localStorage unavailable → in-memory session state, never throws.
//   - every change emits `sdd-provider-filter-change` on `window` with
//     `{ version, enabled, enabledIds }` AFTER state + storage are updated.
//   - `data-action="enable-all"` runs the exact same action as `all`.
//
// This module never reads the catalog and never infers availability.

export const STORAGE_KEY = 'sdd-providers-v1';
export const STORAGE_VERSION = 1;

let _providers = [];
let _enabled = {};
let _targetEl = null;

/** Resolve localStorage defensively (private mode → null, in-memory fallback). */
function storageBackend() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__sdd_providers_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

/** Closed all-enabled map for the current registry. */
function allEnabled(providers) {
  const enabled = {};
  for (const provider of providers) enabled[provider.id] = true;
  return enabled;
}

/**
 * Read + normalize the stored preference. Any deviation (corrupt JSON,
 * wrong version, unknown id, missing known id, non-boolean value) resets
 * to all-enabled — fail-open for preferences, never for catalog truth.
 */
function readEnabled(providers) {
  const fallback = allEnabled(providers);
  const backend = storageBackend();
  if (!backend) return fallback;
  const raw = backend.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== 'object') return fallback;
  if (parsed.version !== STORAGE_VERSION) return fallback;
  if (!parsed.enabled || typeof parsed.enabled !== 'object') return fallback;
  const known = new Set(providers.map((provider) => provider.id));
  for (const id of Object.keys(parsed.enabled)) {
    if (!known.has(id)) return fallback; // unknown id → reset
  }
  const normalized = {};
  for (const provider of providers) {
    const value = parsed.enabled[provider.id];
    if (typeof value !== 'boolean') return fallback; // missing / non-boolean → reset
    normalized[provider.id] = value;
  }
  return normalized;
}

/** Best-effort persistence; in-memory state stays correct if storage fails. */
function persist() {
  const backend = storageBackend();
  if (!backend) return;
  try {
    backend.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, enabled: { ..._enabled } })
    );
  } catch {
    /* quota / serialization — the session keeps working in memory */
  }
}

/** Repaint every checkbox from the canonical state. */
function syncControls() {
  if (!_targetEl) return;
  for (const box of _targetEl.querySelectorAll('input[data-provider-id]')) {
    box.checked = _enabled[box.dataset.providerId] === true;
  }
}

/** Emit the canonical filter-change event AFTER state + storage updates. */
function emitChange() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const detail = {
    version: STORAGE_VERSION,
    enabled: { ..._enabled },
    enabledIds: _providers.filter((provider) => _enabled[provider.id] === true).map((p) => p.id),
  };
  window.dispatchEvent(new CustomEvent('sdd-provider-filter-change', { detail }));
}

/** Commit a new state atomically: memory → storage → controls → event. */
function commit(next) {
  _enabled = next;
  persist();
  syncControls();
  emitChange();
}

/** Current canonical map (copy) — one boolean per known provider id. */
export function getEnabled() {
  return { ..._enabled };
}

/** Toggle a single provider. Unknown ids are ignored (fail-closed). */
export function setProviderEnabled(id, value) {
  if (!Object.prototype.hasOwnProperty.call(_enabled, id)) return;
  const next = value === true;
  if (_enabled[id] === next) return;
  commit({ ..._enabled, [id]: next });
}

/** Enable every registry provider (also the `enable-all` CTA action). */
export function enableAll() {
  commit(allEnabled(_providers));
}

/** Disable every registry provider. */
export function disableAll() {
  const next = {};
  for (const provider of _providers) next[provider.id] = false;
  commit(next);
}

/** Update the aria-live visible-model count owned by this selector. */
export function setVisibleCount(count) {
  const el = _targetEl && _targetEl.querySelector('[data-role="visible-count"]');
  if (el) el.textContent = `${count} modelos visibles`;
}

/** Toggle the empty-eligible-state message + CTA. */
export function setEmptyState(isEmpty) {
  const el = _targetEl && _targetEl.querySelector('[data-role="empty-state"]');
  if (el) el.hidden = !isEmpty;
}

/** Minimal HTML escaper (registry ids/names are engine-owned, but cheap). */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * Render the selector into `targetEl` for the given registry `providers`
 * (array order = UI order) and wire every control to the shared state.
 *
 * @param {HTMLElement} targetEl
 * @param {Array<{id: string, name: string}>} providers
 * @returns {{controls: number}}
 */
export function render(targetEl, providers) {
  if (!targetEl || typeof targetEl.querySelector !== 'function') {
    throw new TypeError('subscription-selector.render: targetEl must be an HTMLElement');
  }
  if (!Array.isArray(providers) || providers.length === 0) {
    throw new TypeError('subscription-selector.render: providers must be a non-empty array');
  }
  _targetEl = targetEl;
  _providers = providers.slice();
  _enabled = readEnabled(_providers);
  persist(); // normalize/rewrite so the key always holds known ids only

  targetEl.innerHTML =
    '<div class="provider-selector" role="group" aria-label="Suscripciones de modelos">' +
    '<div class="provider-selector-chips">' +
    _providers
      .map(
        (p) =>
          `<label class="provider-chip" for="provider-${esc(p.id)}">` +
          `<input type="checkbox" id="provider-${esc(p.id)}" data-provider-id="${esc(p.id)}"${
            _enabled[p.id] ? ' checked' : ''
          }>` +
          `<span>${esc(p.name)}</span></label>`
      )
      .join('') +
    '</div>' +
    '<div class="provider-selector-actions">' +
    '<button type="button" data-action="all">Todos</button>' +
    '<button type="button" data-action="none">Ninguno</button>' +
    '<span data-role="visible-count" aria-live="polite"></span>' +
    '</div>' +
    '<div data-role="empty-state" hidden>' +
    '<span>No hay modelos visibles con estas suscripciones.</span>' +
    '<button type="button" data-action="enable-all">Habilitar todos</button>' +
    '</div></div>';

  for (const box of targetEl.querySelectorAll('input[data-provider-id]')) {
    box.addEventListener('change', () => setProviderEnabled(box.dataset.providerId, box.checked));
  }
  const actions = { all: enableAll, none: disableAll, 'enable-all': enableAll };
  for (const btn of targetEl.querySelectorAll('button[data-action]')) {
    const action = actions[btn.dataset.action];
    if (action) btn.addEventListener('click', action);
  }
  return { controls: _providers.length };
}
