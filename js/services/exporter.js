// js/services/exporter.js
// Phase V5 — exporter service. Pure functions to format section data
// as JSON or markdown, plus browser-utility wrappers for clipboard copy
// and file download with toast feedback.
//
// Two layers:
//   - Format functions (pure): toJSON, toMarkdown
//     Each takes a section's data and returns a string. Pure so they
//     can be unit-tested in jsdom without touching the DOM.
//   - Browser actions (side-effecting): copyToClipboard, downloadFile,
//     showToast. Wired to navigator.clipboard / Blob / a small toast
//     element appended to body.
//
// Toast contract (per impeccable craft-floor "States"):
//   - Success: "Copiado al portapapeles" / "Descarga iniciada" (2.5s)
//   - Error:   "Error al copiar — usá Ctrl+C"           (4s, dismissable)
//   - Click the toast body to dismiss early.
//
// All copy is in rioplatense Spanish to match the rest of the page.

/* ─────────────────────────── format functions ─────────────────────────── */

/**
 * Pretty-print a value as JSON with stable key ordering. Falls back to
 * a stringified version on circular refs (shouldn't happen, but safer).
 *
 * @param {any} value
 * @returns {string}
 */
export function toJSON(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    },
    2
  );
}

/**
 * Build a markdown table from headers + rows. Escapes pipe characters
 * in cell values. Empty cells render as a literal space (so the table
 * stays well-formed).
 *
 * @param {string[]} headers
 * @param {Array<Array<string|number|null|undefined>>} rows
 * @returns {string}
 */
export function markdownTable(headers, rows) {
  const escCell = (c) => {
    if (c === null || c === undefined) return ' ';
    return String(c).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || ' ';
  };
  const sep = headers.map(() => '---');
  const lines = [];
  lines.push(`| ${headers.map(escCell).join(' | ')} |`);
  lines.push(`| ${sep.join(' | ')} |`);
  for (const row of rows) {
    lines.push(`| ${row.map(escCell).join(' | ')} |`);
  }
  return lines.join('\n');
}

/**
 * Build a markdown "agent assignment" block (paste-ready into
 * gentle-ai's `agents/*.md`).
 *
 * Format per agent:
 *   ### sdd-apply
 *   **Claude Opus 4.8** (`reference` · 78.3 · $0.000113/req)
 *   _role:_ implementador  ·  _score:_ 78.3 ≥ 70 ✓  ·  _cost:_ $0.000113 ≤ $0.000150 ✓
 *
 * @param {Array<{key: string, role?: string, model?: {name?: string, tier?: string, benchlm?: {score?: number}}, score?: number, cost?: number, effectiveMaxCost?: number, softFallback?: boolean}>} assignments
 * @param {{ now?: Date }} [options]
 * @returns {string}
 */
export function agentsMarkdown(assignments, options) {
  const opts = options || {};
  const today = opts.now instanceof Date ? opts.now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const blocks = [];
  for (const a of assignments || []) {
    const m = a.model || {};
    const name = m.name || (a.key ? `(sin modelo: ${a.key})` : '(sin modelo)');
    const tier = m.tier || '—';
    const score = a.score;
    const cost = a.cost;
    const max = a.effectiveMaxCost;
    const role = a.role || '—';
    const scoreStr = Number.isFinite(score) ? score.toFixed(1) : '—';
    const costStr = Number.isFinite(cost) ? `$${cost.toFixed(6)}`.replace(/0+$/, '').replace(/\.$/, '') : '—';
    const maxStr = Number.isFinite(max) ? `$${max.toFixed(6)}`.replace(/0+$/, '').replace(/\.$/, '') : '—';
    const scoreCheck = Number.isFinite(score) ? `${scoreStr} ✓` : '—';
    const costCheck = Number.isFinite(cost) && Number.isFinite(max) ? `${costStr} ≤ ${maxStr} ✓` : '—';
    const fallback = a.softFallback ? '  ·  _soft fallback_' : '';
    blocks.push(
      `### ${a.key}\n` +
      `**${name}** (${tier} · ${scoreStr} · ${costStr}/req)\n` +
      `_role:_ ${role}  ·  _score:_ ${scoreCheck}  ·  _cost:_ ${costCheck}${fallback}`
    );
  }
  return `# SDD Agent Assignments (${today})\n\n${blocks.join('\n\n')}\n`;
}

/* ─────────────────────────── browser actions ─────────────────────────── */

/**
 * Copy `text` to the clipboard. Returns true on success, false on
 * failure (older browser, insecure context, user denied permission).
 *
 * Falls back to a hidden textarea + execCommand when navigator.clipboard
 * is unavailable (e.g. http:// during local testing).
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand fallback
    }
  }
  // Fallback for non-secure contexts
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * Trigger a browser download for `content` as `filename`. Uses Blob +
 * object URL. Returns true on success.
 *
 * @param {string} content
 * @param {string} filename
 * @param {string} [mime='text/plain']
 * @returns {boolean}
 */
export function downloadFile(content, filename, mime = 'text/plain') {
  try {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a date-suffixed filename like `sdd-models-ref-table-2026-07-31.json`.
 *
 * @param {string} sectionId
 * @param {string} extension - without the dot, e.g. 'json' or 'md'
 * @param {Date} [now]
 * @returns {string}
 */
export function exportFilename(sectionId, extension, now) {
  const date = (now instanceof Date ? now : new Date()).toISOString().slice(0, 10);
  return `sdd-${sectionId}-${date}.${extension}`;
}

/* ─────────────────────────── toast ─────────────────────────── */

let _toastEl = null;
let _toastTimer = null;

/**
 * Show a toast message. Auto-dismisses after `durationMs` (default 2500).
 * Subsequent calls replace the current toast. Click anywhere on the toast
 * to dismiss early.
 *
 * @param {string} message
 * @param {{ kind?: 'success' | 'error', durationMs?: number }} [options]
 */
export function showToast(message, options) {
  const opts = options || {};
  const kind = opts.kind === 'error' ? 'error' : 'success';
  const duration = Number.isFinite(opts.durationMs) ? opts.durationMs : (kind === 'error' ? 4000 : 2500);

  if (_toastEl && _toastEl.parentNode) {
    _toastEl.parentNode.removeChild(_toastEl);
  }
  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }

  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.dataset.test = 'export-toast';
  el.dataset.kind = kind;
  const bgClass = kind === 'error' ? 'bg-rose-900/90 border-rose-700 text-rose-100' : 'bg-emerald-900/90 border-emerald-700 text-emerald-100';
  el.className = `fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border ${bgClass} px-4 py-2.5 text-sm shadow-lg cursor-pointer select-none`;
  el.textContent = message;
  el.addEventListener('click', () => dismissToast());
  document.body.appendChild(el);
  _toastEl = el;
  _toastTimer = setTimeout(() => dismissToast(), duration);
}

/**
 * Dismiss any active toast. Safe to call when no toast is showing.
 */
export function dismissToast() {
  if (_toastTimer) {
    clearTimeout(_toastTimer);
    _toastTimer = null;
  }
  if (_toastEl && _toastEl.parentNode) {
    _toastEl.parentNode.removeChild(_toastEl);
  }
  _toastEl = null;
}

/**
 * Test-only: clear all module state. Exposed for jsdom test isolation.
 */
export function resetForTests() {
  dismissToast();
}

/* ─────────────────────────── helpers ─────────────────────────── */

/**
 * Run a single export action with toast feedback. Wraps the side-effecting
 * function and reports success/failure to the user via showToast.
 *
 * @param {() => Promise<boolean> | boolean} action
 * @param {{ successMessage: string, errorMessage: string }} messages
 */
export async function runExport(action, messages) {
  let ok = false;
  try {
    const result = action();
    ok = result instanceof Promise ? await result : !!result;
  } catch {
    ok = false;
  }
  if (ok) {
    showToast(messages.successMessage, { kind: 'success' });
  } else {
    showToast(messages.errorMessage, { kind: 'error' });
  }
  return ok;
}
