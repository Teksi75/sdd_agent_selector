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

  const close = () => {
    dropdown.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    out.opened = false;
  };
  const open = () => {
    dropdown.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    out.opened = true;
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('hidden')) {
      open();
    } else {
      close();
    }
  });

  // Delegate clicks on format options
  dropdown.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="export-format"]');
    if (!btn) return;
    e.stopPropagation();
    const formatId = btn.getAttribute('data-format-id');
    const format = (opts.formats || []).find((f) => f.id === formatId);
    if (!format) return;
    close();
    await runFormat(format, {
      copyMessage: opts.copyMessage,
      downloadMessage: opts.downloadMessage,
    });
  });

  // Click outside the root closes the dropdown
  const onDocClick = (e) => {
    if (root && !root.contains(e.target)) close();
  };
  document.addEventListener('click', onDocClick);

  // Escape closes
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  // Stash handlers on the element so resetForTests (or future re-render)
  // can clean up. The test isolation helper is intentionally lightweight.
  targetEl.__exportCleanup = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
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
