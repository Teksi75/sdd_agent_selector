// js/components/keyboard-shortcuts.js
// V5+ critique v2 — P2 eficiencia: keyboard shortcuts for power users.
//
// Shortcuts:
//   ?       — show/hide the help overlay
//   g i     — jump to Tier 1 (Acción → resultado)
//   g j     — jump to Tier 2 (Datos de soporte)
//   g k     — jump to Tier 3 (Catálogo completo)
//   r       — click the "Actualizar ahora" button (if present)
//   Esc     — close the help overlay (the export-button.js dropdown
//             already handles its own Esc when focused)
//
// Implementation notes:
//   - Vim-style "g" prefix: when the user types `g`, we wait up to
//     1.2s for the second key. If the timeout fires, we drop the
//     prefix. The prefix is invisible to the user (no UI feedback)
//     and only used to avoid stomping on other keystrokes (e.g. the
//     `i` in a `text input` shouldn't trigger jump-to-tier-1).
//   - We only listen at the document level, NOT inside text inputs
//     or textareas (so typing "i" inside a future search field
//     doesn't jump to tier-1).
//   - The module exports `mount()` which wires the listeners and
//     `unmount()` for tests. Idempotent across multiple mount() calls.

const PREFIX_TIMEOUT_MS = 1200;
let _unmount = null;

/**
 * Test helper: returns true if `el` is a text-entry element where
 * keystrokes should be ignored. Inputs, textareas, selects, and any
 * element with `contenteditable` are excluded.
 *
 * @param {Element|null} el
 * @returns {boolean}
 */
export function isTextEntry(el) {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    // These types don't accept text — the keystroke should still trigger.
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'checkbox'
        || type === 'radio' || type === 'file' || type === 'color') return false;
    return true;
  }
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * Show or hide the help overlay. Flips `data-open` and `aria-hidden`
 * in sync so screen readers see the same state.
 *
 * @param {boolean} open
 * @param {HTMLElement|null} helpEl
 * @returns {void}
 */
export function setHelpOpen(open, helpEl) {
  if (!helpEl) return;
  if (open) {
    helpEl.setAttribute('data-open', 'true');
    helpEl.setAttribute('aria-hidden', 'false');
  } else {
    helpEl.setAttribute('data-open', 'false');
    helpEl.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Smooth-scroll to the section with the given id, if it exists.
 * Uses the global `scrollIntoView` (the same fallback the
 * config-selector's `scrollToFirstChange` uses). When the API is
 * missing (older browsers / jsdom), no-op silently.
 *
 * @param {string} id
 */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof el.scrollIntoView === 'function') {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      try { el.scrollIntoView(); } catch { /* ignore */ }
    }
  }
}

/**
 * Click the freshness-badge refresh button if it's mounted. We
 * don't import the component here to avoid the bundle pulling in
 * the data-sync chain — the button carries `data-action="refresh"`
 * as a stable selector contract, and the click handler is already
 * wired by freshness-badge.js / app.js's `onRefresh` option.
 */
function triggerRefresh() {
  const btn = document.querySelector('button[data-action="refresh"]');
  if (btn && typeof btn.click === 'function') btn.click();
}

/**
 * Mount the keyboard-shortcuts listener at the document level.
 * Idempotent: a second call unmounts the first and re-mounts.
 *
 * @returns {() => void} the unmount function (also stored on the module
 *   for test isolation via `resetForTests`)
 */
export function mount() {
  // Tear down any prior mount first — defensive against double-mount
  // (e.g. app.js being imported twice during a hot reload).
  if (typeof _unmount === 'function') _unmount();

  const helpEl = document.getElementById('kbd-shortcuts-help');
  let prefixActive = false;
  let prefixTimer = null;

  const clearPrefix = () => {
    prefixActive = false;
    if (prefixTimer) {
      clearTimeout(prefixTimer);
      prefixTimer = null;
    }
  };

  const onKey = (e) => {
    // Ignore shortcuts while typing in a text entry — the user is
    // mid-typing a query and we shouldn't hijack the keystroke.
    if (isTextEntry(document.activeElement)) return;
    // Ignore when a modifier is pressed — let the browser handle
    // Ctrl+R (reload), Ctrl+F (find), etc. unmodified.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Esc closes the help overlay unconditionally.
    if (e.key === 'Escape') {
      if (helpEl && helpEl.getAttribute('data-open') === 'true') {
        setHelpOpen(false, helpEl);
        e.preventDefault();
      }
      return;
    }

    // `?` toggles the help. The key is reported as "/" with shift
    // on most layouts — handle both for robustness.
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      if (!helpEl) return;
      const isOpen = helpEl.getAttribute('data-open') === 'true';
      setHelpOpen(!isOpen, helpEl);
      e.preventDefault();
      return;
    }

    // `r` triggers the refresh button — but only when the help
    // overlay is closed (so `r` doesn't also close the dialog).
    if (e.key === 'r' && (!helpEl || helpEl.getAttribute('data-open') !== 'true')) {
      triggerRefresh();
      e.preventDefault();
      return;
    }

    // `g` + i/j/k — vim-style jump to tier.
    if (prefixActive && (e.key === 'i' || e.key === 'j' || e.key === 'k')) {
      const map = { i: 'tier-1', j: 'tier-2', k: 'tier-3' };
      scrollToSection(map[e.key]);
      clearPrefix();
      e.preventDefault();
      return;
    }
    if (e.key === 'g') {
      prefixActive = true;
      if (prefixTimer) clearTimeout(prefixTimer);
      prefixTimer = setTimeout(clearPrefix, PREFIX_TIMEOUT_MS);
      return;
    }

    // Any other key cancels the `g` prefix.
    if (prefixActive) clearPrefix();
  };

  document.addEventListener('keydown', onKey);

  _unmount = () => {
    document.removeEventListener('keydown', onKey);
    clearPrefix();
    _unmount = null;
  };
  return _unmount;
}

/**
 * Unmount the listener. Exported for tests; also called internally
 * by `mount()` to keep the listener set size at 1.
 */
export function unmount() {
  if (typeof _unmount === 'function') _unmount();
}

/** Reset module state — exported for jsdom test isolation. */
export function resetForTests() {
  unmount();
}
