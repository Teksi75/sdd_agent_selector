// js/components/ref-table.js
// Phase 1 — pilot section.
//
// Pure render of the reference model table (one row per non-reference model,
// sorted by composite score descending). This is the first V4 section to be
// rebuilt from the modular pipeline; it confirms the data layer +
// model-scorer are wired correctly before the larger refactor (Phase 2+).
//
// Contract (per design.md "Components — ref-table"):
//   render(targetEl, models)
//     - targetEl: HTMLElement to mount into (caller supplies; the function
//         does not look it up by id so it stays pure / testable).
//     - models:   { [key]: model } keyed by model id (e.g. 'glm52'),
//                 in the shape returned by data/models.json.
//     - returns:  { rows: number, topKey: string | null }
//
// Excluded models: tier === 'reference' OR isReference === true.
//   Reference models are still surfaced in V3 (the "ChatGPT Plus" view) but
//   are dropped here because this table's job is to compare the *active*
//   selection pool. Reference models are reported separately as the
//   `referenceModel` key on the returned summary.
//
// Source badges: a model gets a badge per benchmark it actually has:
//   arena (LMSYS), swe (SWE-Pro), sweVer (SWE-Verified), term (Term-Bench),
//   price (input + output). Missing benchmarks render as a muted "—".
//
// No global side effects: the function does not touch document.body, fetch,
// sessionStorage, or globals. It only mutates `targetEl`. Tailwind classes
// mirror the V3 ref-table so the visual diff stays minimal until Phase 4
// bundles Tailwind offline.

import { compositeScore } from '../services/model-scorer.js';

/**
 * Format a numeric value for display. Numbers render as-is; null/undefined
 * becomes a muted em-dash. Numbers ≥ 100 render without decimals; smaller
 * numbers render up to 2 decimals (matches the V3 table's column widths).
 *
 * @param {number|null|undefined} value
 * @param {number} [decimals=0]
 * @returns {string}
 */
function fmt(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return decimals === 0 ? String(value) : value.toFixed(decimals);
}

/**
 * Format a USD price ($/1M tokens). Always two decimals to keep the column
 * visually aligned with the V3 table.
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
function fmtPrice(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

/**
 * Build a single source badge `<span>`.
 *
 * @param {string} kind  - one of 'arena', 'swePro', 'sweVer', 'term', 'price', 'new'
 * @param {string} label - the text inside the badge
 * @returns {string} HTML
 */
function badge(kind, label) {
  // Mute "missing" badges so the eye skips them in the comparison view.
  const toneClass =
    kind === 'none' ? 'src-badge src-none' :
    kind === 'arena' ? 'src-badge src-arena' :
    kind === 'swePro' ? 'src-badge src-swe' :
    kind === 'sweVer' ? 'src-badge src-swe-ver' :
    kind === 'term' ? 'src-badge src-term' :
    kind === 'price' ? 'src-badge src-price' :
    kind === 'new' ? 'src-badge src-new' :
    'src-badge';
  return `<span class="${toneClass}">${label}</span>`;
}

/**
 * Build the source-badges cell for a model. Returns a small string of
 * HTML spans — one per benchmark the model has, plus a NEW badge if
 * `isNew: true` is set.
 *
 * @param {Object} m
 * @returns {string} HTML
 */
function sourceBadges(m) {
  const parts = [];
  if (m.arena !== null && m.arena !== undefined) parts.push(badge('arena', String(m.arena)));
  if (m.swePro !== null && m.swePro !== undefined) parts.push(badge('swePro', `${fmt(m.swePro)}%`));
  if (m.sweVer !== null && m.sweVer !== undefined) parts.push(badge('sweVer', `${fmt(m.sweVer)}%`));
  if (m.term !== null && m.term !== undefined) parts.push(badge('term', `${fmt(m.term)}%`));
  if (m.input !== null && m.input !== undefined) parts.push(badge('price', fmtPrice(m.input)));
  if (m.isNew === true) parts.push(badge('new', 'NEW'));
  return parts.length > 0 ? parts.join(' ') : badge('none', '—');
}

/**
 * Filter out reference-tier models and sort the remaining rows by
 * composite score descending. Deterministic tie-breaker: cheaper models
 * win ties (matches the V3 sort order in the source).
 *
 * @param {Object<string, Object>} models
 * @returns {Array<[string, Object]>}
 */
function rowsFor(models) {
  return Object.entries(models)
    .filter(([, m]) => m && m.tier !== 'reference' && m.isReference !== true)
    .sort((a, b) => {
      const sa = compositeScore(a[1]);
      const sb = compositeScore(b[1]);
      if (sb !== sa) return sb - sa;
      // Tie-breaker: prefer cheaper input price.
      const ca = Number.isFinite(a[1].input) ? a[1].input : Infinity;
      const cb = Number.isFinite(b[1].input) ? b[1].input : Infinity;
      return ca - cb;
    });
}

/**
 * Render the reference table into `targetEl`. Pure render — does not look
 * up DOM elements by id, does not mutate globals, and does not log.
 *
 * @param {HTMLElement} targetEl - mount point
 * @param {Object<string, Object>} models - keyed by model id
 * @returns {{ rows: number, topKey: string|null, referenceModel: Object|null }}
 */
export function render(targetEl, models) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('ref-table.render: targetEl must be an HTMLElement');
  }
  if (!models || typeof models !== 'object') {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No model data available.
      </div>`;
    return { rows: 0, topKey: null, referenceModel: null };
  }

  const rows = rowsFor(models);
  // Identify the reference model (first reference-tier entry) so the caller
  //   can also display the "ChatGPT Plus" row from V3 if desired.
  const referenceModel =
    Object.values(models).find((m) => m && (m.tier === 'reference' || m.isReference === true)) ||
    null;

  if (rows.length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No non-reference models in the dataset.
      </div>`;
    return { rows: 0, topKey: null, referenceModel };
  }

  const body = rows
    .map(([key, m]) => {
      const score = compositeScore(m).toFixed(1);
      const newBadge = m.isNew === true
        ? ' <span class="src-badge src-new">NEW</span>'
        : '';
      return `
        <tr class="hover:bg-slate-800/30 transition" data-model-key="${escapeAttr(key)}">
          <td class="py-2.5 px-3 font-medium">${escapeHtml(m.name || key)}${newBadge}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs">${escapeHtml(m.tier || '—')}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs">${score}</td>
          <td class="py-2.5 px-3 text-center">${badge('arena', m.arena ?? '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('swePro', m.swePro != null ? `${fmt(m.swePro)}%` : '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('sweVer', m.sweVer != null ? `${fmt(m.sweVer)}%` : '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('term', m.term != null ? `${fmt(m.term)}%` : '—')}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.input)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.output)}</td>
          <td class="py-2.5 px-3 text-center text-[11px] space-x-1">${sourceBadges(m)}</td>
        </tr>`;
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table class="w-full text-left text-sm text-slate-200">
        <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th class="py-2.5 px-3 font-semibold">Modelo</th>
            <th class="py-2.5 px-3 font-semibold text-center">Tier</th>
            <th class="py-2.5 px-3 font-semibold text-center">Score</th>
            <th class="py-2.5 px-3 font-semibold text-center">Arena</th>
            <th class="py-2.5 px-3 font-semibold text-center">SWE-Pro</th>
            <th class="py-2.5 px-3 font-semibold text-center">SWE-Ver</th>
            <th class="py-2.5 px-3 font-semibold text-center">Term</th>
            <th class="py-2.5 px-3 font-semibold text-right">Input $</th>
            <th class="py-2.5 px-3 font-semibold text-right">Output $</th>
            <th class="py-2.5 px-3 font-semibold text-center">Sources</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${body}
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-slate-500">
      Showing ${rows.length} active model${rows.length === 1 ? '' : 's'} · sorted by composite score (desc) ·
      reference models excluded.
    </p>
  `;

  return {
    rows: rows.length,
    topKey: rows[0]?.[0] ?? null,
    referenceModel,
  };
}

/**
 * Minimal HTML escapers — keep us safe against the (untrusted) `notes`
 * field on a model record without pulling in a full sanitizer.
 *
 * @param {string} s
 * @returns {string}
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
