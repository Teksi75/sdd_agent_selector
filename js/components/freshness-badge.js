// js/components/freshness-badge.js
// Phase 2e — freshness-badge: textual indicator of data staleness,
//   plus a manual refresh button (placeholder handler — real refresh
//   wires in Phase 3 when data-sync.js ships).
//
// Contract (per spec.md "UI Component - Freshness Badge" +
//   design.md "Components — freshness-badge"):
//   render(targetEl, meta, options?)
//     - targetEl: HTMLElement to mount into.
//     - meta: { lastSynced: ISO date (YYYY-MM-DD), ... } — the
//         data/models.json `_meta` block. Required.
//     - options: { now?: Date|string, onRefresh?: () => void, thresholdDays?: number }
//         Optional. `now` overrides "today" for deterministic tests;
//         `onRefresh` is the click handler for the refresh button
//         (placeholder in Phase 2e; real handler in Phase 3);
//         `thresholdDays` defaults to 7.
//     - returns: { html: string, mounted: boolean, daysOld: number, warning: boolean }
//
// Strings use rioplatense Spanish:
//   "Datos del DD/MM/YYYY — hoy"
//   "Datos del DD/MM/YYYY — hace 1 día"
//   "Datos del DD/MM/YYYY — hace N días"   (N >= 2)
//
// A warning banner appears when daysOld > thresholdDays (default 7):
//   "Los benchmarks tienen más de 7 días. Verificá manualmente."

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * Format the "human age" suffix in rioplatense Spanish.
 *  - daysOld = 0  → "hoy"
 *  - daysOld = 1  → "hace 1 día"
 *  - daysOld >= 2 → "hace N días"
 *
 * @param {number} daysOld
 * @returns {string}
 */
export function ageLabel(daysOld) {
  if (!Number.isFinite(daysOld) || daysOld < 0) return 'hace ? días';
  if (daysOld === 0) return 'hoy';
  if (daysOld === 1) return 'hace 1 día';
  return `hace ${Math.round(daysOld)} días`;
}

/**
 * Compute whole-day difference between `now` and an ISO date string.
 * Uses the UTC midnight of each date to avoid DST off-by-one errors and to
 * stay timezone-independent (matches `data-sync.getStalenessDays`).
 *
 * `now` accepts a `Date` instance or an ISO date string. Invalid / missing
 * values fall back to `new Date()` so render paths never throw.
 *
 * @param {string} lastSynced - ISO date (YYYY-MM-DD)
 * @param {Date|string} [now]
 * @returns {number} integer day delta (>= 0 for "today" or earlier)
 */
export function daysOld(lastSynced, now) {
  if (!lastSynced || typeof lastSynced !== 'string') return 0;
  const sync = new Date(`${lastSynced}T00:00:00Z`);
  if (Number.isNaN(sync.getTime())) return 0;

  // Normalize `now`: Date stays, ISO string → Date, missing/invalid → new Date().
  let today;
  if (now instanceof Date) {
    today = now;
  } else if (typeof now === 'string') {
    const parsed = new Date(now);
    today = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    today = new Date();
  }

  // UTC-aware date math: matches data-sync.getStalenessDays so the badge
  // stays in sync with the underlying staleness contract.
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const diffMs = todayUtc.getTime() - sync.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Format an ISO date `YYYY-MM-DD` as `DD/MM/YYYY`. Throws on invalid input.
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatDateEs(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Build the badge HTML string. Exposed for tests so they can assert on the
 * inner shape without going through a mount.
 *
 * @param {string} lastSynced
 * @param {{ now?: Date|string, thresholdDays?: number }} [options]
 * @returns {{ html: string, daysOld: number, warning: boolean }}
 */
export function buildBadge(lastSynced, options) {
  const opts = options || {};
  const now = opts.now;
  const threshold = Number.isFinite(opts.thresholdDays) ? opts.thresholdDays : 7;
  const days = daysOld(lastSynced, now);
  const dateStr = formatDateEs(lastSynced);
  const age = ageLabel(days);
  const warning = days > threshold;

  const warningBanner = warning
    ? `<div class="rounded-lg border border-amber-700 bg-amber-900/40 p-2.5 text-xs text-amber-200 flex items-start gap-2" role="alert" data-test="freshness-warning">
        <span aria-hidden="true">⚠</span>
        <span>Los benchmarks tienen más de ${threshold} días. Verificá manualmente.</span>
      </div>`
    : '';

  const refreshBtn = `<button type="button" class="freshness-refresh inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 transition" data-action="refresh">
    <span aria-hidden="true">↻</span>
    <span>Actualizar ahora</span>
  </button>`;

  const html = `
    <div class="flex flex-wrap items-center gap-3" data-test="freshness-badge" data-days-old="${days}" data-warning="${warning}">
      <span class="text-xs text-slate-400">Datos del <span class="font-mono text-slate-200">${esc(dateStr)}</span> — ${esc(age)}</span>
      ${refreshBtn}
    </div>
    ${warningBanner}`;

  return { html, daysOld: days, warning };
}

/**
 * Render the freshness badge into `targetEl`. Wires the refresh button
 * click to `options.onRefresh` when supplied.
 *
 * @param {HTMLElement|null} targetEl
 * @param {{ lastSynced: string, [k: string]: any }} meta
 * @param {{ now?: Date|string, onRefresh?: () => void, thresholdDays?: number }} [options]
 * @returns {{ html: string, mounted: boolean, daysOld: number, warning: boolean }}
 */
export function render(targetEl, meta, options) {
  const lastSynced = meta && meta.lastSynced;
  const opts = options || {};
  const out = buildBadge(lastSynced, opts);

  if (targetEl && typeof targetEl.innerHTML === 'string') {
    targetEl.innerHTML = out.html;
    if (typeof opts.onRefresh === 'function') {
      const btn = targetEl.querySelector('button[data-action="refresh"]');
      if (btn) btn.addEventListener('click', opts.onRefresh);
    }
    return { html: out.html, mounted: true, daysOld: out.daysOld, warning: out.warning };
  }
  return { html: out.html, mounted: false, daysOld: out.daysOld, warning: out.warning };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state — placeholder for parity with other components */
}