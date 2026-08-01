// js/components/export-button.js
// Phase V5 — export button. UI shell that hosts a small dropdown of
// export actions per section. Caller supplies the formats and content;
// the component handles the click → action → toast flow.
//
// Design (per impeccable craft-floor "States" + "Copy"):
//   - Button is the single entry point: "Exportar ▾"
//   - Click toggles a dropdown listing the available formats
//   - Each format is a small action button; click runs the action and
//     shows a toast (success / error) before closing the dropdown
//   - Click outside the dropdown closes it (no modal, no focus trap)
//   - Rioplatense Spanish copy: "Exportar", "Copiar", "Descargar"
//
// Pure rendering helper exports for tests; the side-effecting wiring
// (click → format action → toast) lives in render().
//
// Public API:
//   renderButton(options) → string  (HTML for the button + dropdown shell)
//   render(targetEl, options) → { formats, mounted, opened }
//   resetForTests() → void

import {
  copyToClipboard,
  downloadFile,
  showToast,
} from '../services/exporter.js';

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * Resolve the side effect for a format. Returns a function that runs the
 * format's action (copy or download) and reports the result.
 *
 * @param {{ id: string, label: string, content: string, filename?: string, mime?: string }} format
 * @param {{ copyMessage?: string, downloadMessage?: string }} [messages]
 * @returns {Promise<boolean>}
 */
async function runFormat(format, messages) {
  const msgs = messages || {};
  if (format.id.startsWith('copy-')) {
    const ok = await copyToClipboard(format.content);
    showToast(
      ok ? (msgs.copyMessage || 'Copiado al portapapeles') : 'Error al copiar — usá Ctrl+C',
      { kind: ok ? 'success' : 'error' }
    );
    return ok;
  }
  if (format.id.startsWith('download-')) {
    const ok = downloadFile(
      format.content,
      format.filename || `sdd-export-${Date.now()}.txt`,
      format.mime || (format.id.endsWith('-json') ? 'application/json' : 'text/markdown')
    );
    showToast(
      ok ? (msgs.downloadMessage || 'Descarga iniciada') : 'Error al iniciar descarga',
      { kind: ok ? 'success' : 'error' }
    );
    return ok;
  }
  showToast('Acción de export no reconocida', { kind: 'error' });
  return false;
}

/**
 * Build the HTML for a single format option row inside the dropdown.
 *
 * @param {{ id: string, label: string }} format
 * @param {string} sectionId
 * @returns {string}
 */
function formatRowHtml(format, sectionId) {
  const icon = format.id.startsWith('copy-') ? '⧉' : '↓';
  return `
    <button
      type="button"
      role="menuitem"
      data-action="export-format"
      data-format-id="${esc(format.id)}"
      data-section-id="${esc(sectionId)}"
      class="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700/80 focus:bg-slate-700/80 focus:outline-none transition-colors"
    >
      <span aria-hidden="true" class="text-slate-400 w-3 text-center">${esc(icon)}</span>
      <span>${esc(format.label)}</span>
    </button>`;
}

/**
 * Build the dropdown shell HTML. The actual menu items are populated
 * from `options.formats` so the component has zero knowledge of the
 * section's data shape.
 *
 * @param {{ sectionId: string, formats: Array }} options
 * @returns {string} HTML for the button + the (initially hidden) dropdown
 */
export function renderButton(options) {
  const opts = options || {};
  const sectionId = opts.sectionId || 'unknown';
  const formats = Array.isArray(opts.formats) ? opts.formats : [];
  if (formats.length === 0) {
    return ''; // nothing to export
  }

  const rows = formats.map((f) => formatRowHtml(f, sectionId)).join('');
  const dropdownId = `export-dd-${sectionId}`;

  return `
    <div class="relative inline-block" data-test="export-button" data-section-id="${esc(sectionId)}">
      <button
        type="button"
        data-action="toggle-export-dropdown"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-controls="${esc(dropdownId)}"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition"
      >
        <span aria-hidden="true">↓</span>
        <span>Exportar</span>
        <span aria-hidden="true" class="text-slate-400 text-[10px]">▾</span>
      </button>
      <div
        id="${esc(dropdownId)}"
        role="menu"
        aria-label="Opciones de export para ${esc(sectionId)}"
        data-test="export-dropdown"
        class="hidden absolute right-0 mt-1 z-30 min-w-[180px] rounded-md border border-slate-700 bg-slate-900/95 shadow-lg py-1"
      >
        ${rows}
      </div>
    </div>`;
}

/**
 * Mount the export button into `targetEl` and wire up the click handlers.
 *
 * Behavior:
 *   - Click the toggle → open/close the dropdown
 *   - Click a format option → run the format's action, close the dropdown, show toast
 *   - Click outside the export button → close the dropdown
 *   - Press Escape → close the dropdown
 *
 * @param {HTMLElement|null} targetEl
 * @param {{ sectionId: string, formats: Array, copyMessage?: string, downloadMessage?: string }} options
 * @returns {{ html: string, mounted: boolean, formats: number, opened: boolean }}
 */
export function render(targetEl, options) {
  const opts = options || {};
  const html = renderButton(opts);
  const out = { html, mounted: false, formats: (opts.formats || []).length, opened: false };

  if (!targetEl || typeof targetEl.innerHTML !== 'string') {
    return out;
  }

  // Tear down any previous mount's document listeners before re-rendering
  // into the same target. The component is idempotent across re-mounts.
  destroy(targetEl);

  targetEl.innerHTML = html;
  out.mounted = true;

  const root = targetEl.querySelector('[data-test="export-button"]');
  if (!root) return out;

  const toggle = root.querySelector('[data-action="toggle-export-dropdown"]');
  const dropdown = root.querySelector('[data-test="export-dropdown"]');
  if (!toggle || !dropdown) return out;

  // V5+ P2-3: roving tabindex on the menu items. Only the "active" item
  // (initially the first) has tabindex=0; the rest are tabindex=-1.
  // This makes Tab/Shift+Tab step OUT of the menu (closing it) and
  // keeps the menu items reachable by ArrowUp/Down inside the menu.
  // The WAI-ARIA Authoring Practices for menu pattern requires this;
  // without it, the dropdown traps keyboard users with Tab.
  const items = Array.from(dropdown.querySelectorAll('[role="menuitem"]'));
  if (items.length === 0) return out;
  // Initial roving state: first item is the active descendant.
  items.forEach((el, i) => {
    el.setAttribute('tabindex', i === 0 ? '0' : '-1');
  });
  dropdown.setAttribute('aria-activedescendant', items[0].id || '');

  // If the menu items don't have ids yet, assign them so aria-activedescendant
  // works (it requires an id, not an HTMLElement reference).
  items.forEach((el, i) => {
    if (!el.id) el.id = `${dropdown.id}-item-${i}`;
  });
  dropdown.setAttribute('aria-activedescendant', items[0].id);

  /**
   * Move focus to the menu item at `index` with wrap-around. ArrowUp
   * from the first item wraps to the last; ArrowDown from the last
   * wraps to the first. WAI-ARIA Authoring Practices menu pattern
   * recommends wrap-around (vs. clamping) because users expect
   * "previous" and "next" to be cyclic inside a closed menu.
   * @param {number} index
   */
  const focusItem = (index) => {
    let i;
    if (items.length === 0) return;
    if (index < 0) i = items.length - 1;
    else if (index >= items.length) i = 0;
    else i = index;
    items.forEach((el, j) => {
      el.setAttribute('tabindex', j === i ? '0' : '-1');
    });
    const target = items[i];
    dropdown.setAttribute('aria-activedescendant', target.id);
    if (typeof target.focus === 'function') target.focus();
  };

  const close = (returnFocus) => {
    dropdown.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    out.opened = false;
    if (returnFocus && typeof toggle.focus === 'function') {
      // WAI-ARIA menu: closing should return focus to the trigger
      // (so keyboard users know where they are).
      toggle.focus();
    }
  };
  const open = () => {
    dropdown.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    out.opened = true;
    // On open, focus the first item so ArrowDown immediately works.
    // Use a microtask so the dropdown is visible before focus is moved
    // (some browsers skip focus on hidden elements).
    setTimeout(() => focusItem(0), 0);
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('hidden')) {
      open();
    } else {
      close(true);
    }
  });

  // V5+ P2-3: keyboard navigation inside the menu (WAI-ARIA menu pattern).
  // Listens at the dropdown level (not the items) so we don't need to
  // re-attach when items change. The "current" item is determined by
  // document.activeElement, which is what `focusItem` updates. When the
  // menu has just opened and focus hasn't landed yet, document.activeElement
  // is <body> (or the toggle), so currentIdx is -1 — focusItem handles
  // the wrap-around from -1 by clamping to the last item on ArrowUp and
  // to 0 on ArrowDown, which is the behavior we want for "open menu,
  // immediately press ArrowUp".
  const onMenuKey = (e) => {
    if (dropdown.classList.contains('hidden')) return;
    const currentIdx = items.indexOf(document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(currentIdx + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(currentIdx - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        // Tab/Shift+Tab closes the menu and lets the browser move
        // focus to the next/prev focusable element. This is the
        // WAI-ARIA-recommended behavior (not focus-trap).
        close(false);
        break;
    }
  };
  dropdown.addEventListener('keydown', onMenuKey);

  // Delegate clicks on format options
  dropdown.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="export-format"]');
    if (!btn) return;
    e.stopPropagation();
    const formatId = btn.getAttribute('data-format-id');
    const format = (opts.formats || []).find((f) => f.id === formatId);
    if (!format) return;
    close(true);
    await runFormat(format, {
      copyMessage: opts.copyMessage,
      downloadMessage: opts.downloadMessage,
    });
  });

  // Click outside the root closes the dropdown
  const onDocClick = (e) => {
    if (root && !root.contains(e.target)) close(false);
  };
  document.addEventListener('click', onDocClick);

  // Escape closes (when focus is on the toggle button itself — the
  // dropdown's own keydown handler also handles Escape when the menu
  // has focus).
  const onKey = (e) => {
    if (e.key === 'Escape' && !dropdown.classList.contains('hidden')) {
      close(true);
    }
  };
  document.addEventListener('keydown', onKey);

  // Stash handlers on the element so resetForTests (or future re-render)
  // can clean up. The test isolation helper is intentionally lightweight.
  targetEl.__exportCleanup = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    dropdown.removeEventListener('keydown', onMenuKey);
  };

  return out;
}

/**
 * Tear down event listeners attached by a previous render() call on
 * `targetEl`. Safe to call when no listeners are attached.
 *
 * @param {HTMLElement|null} targetEl
 */
export function destroy(targetEl) {
  if (targetEl && typeof targetEl.__exportCleanup === 'function') {
    targetEl.__exportCleanup();
    targetEl.__exportCleanup = null;
  }
}

/** Reset module state. Exposed for jsdom test isolation. */
export function resetForTests() {
  /* no module-level state to reset; placeholder for parity with other components */
}
