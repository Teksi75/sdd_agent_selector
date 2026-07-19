// js/components/ref-table.js
// PR3 (benchlm-replace-custom-scoring) — ref-table cutover.
//
// Public API:
//   render(targetEl, models)  → { rows, topKey, referenceModel }
//
// Contract (PR3, per spec benchlm-data-model + spec "UI Component —
// Reference Table"):
//   - Every non-reference model renders as one `<tr>` carrying:
//       Modelo | Tier | Score | BenchLM (badge + reliability) |
//       Input $ | Output $ | Sources
//   - The score column reads `benchlm.score` directly (1 decimal).
//   - The BenchLM column shows a verified/estimated badge PLUS a
//     5-dot reliability scale. Null score → "—" placeholder; no
//     badge or dots.
//   - Legacy `arena`/`swePro`/`sweVer`/`term` columns are REMOVED.
//   - The sources cell still surfaces pricing sources + a NEW badge.
//   - Reference-tier rows (tier === 'reference' OR isReference === true)
//     sink to the bottom of the table.
//
// Fail-soft (spec benchlm-fail-soft): when a model has no `benchlm`
// block, the row still renders with a "—" score and no badge/dots so
// the user can see the model exists but BenchLM hasn't ingested it.

import { compositeScore } from '../services/model-scorer.js';

/**
 * Format a numeric value for display. Numbers render as-is; null /
 * undefined / non-finite → '—'.
 */
function fmt(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return decimals === 0 ? String(value) : value.toFixed(decimals);
}

/** Format a USD price ($/1M tokens). */
function fmtPrice(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

/** Build a single source badge `<span>`. */
function badge(kind, label) {
  let cls;
  let dataAttr = '';
  if (kind === 'none') cls = 'src-badge src-none';
  else if (kind === 'price') cls = 'src-badge src-price';
  else if (kind === 'new') cls = 'src-badge src-new';
  else if (kind === 'benchlm-verified') {
    cls = 'src-badge bg-emerald-500/20 text-emerald-300';
    dataAttr = ' data-badge="verified"';
  } else if (kind === 'benchlm-estimated') {
    cls = 'src-badge bg-amber-500/20 text-amber-300';
    dataAttr = ' data-badge="estimated"';
  } else {
    cls = 'src-badge';
  }
  return `<span class="${cls}"${dataAttr}>${label}</span>`;
}

/**
 * Build the BenchLM "provenance" cell for a model row: verified/estimated
 * badge + 5-dot reliability scale. Null score → '—' (no badge, no dots).
 *
 * @param {Object} m
 * @returns {string} HTML
 */
function benchlmProvenanceHtml(m) {
  const b = m && m.benchlm;
  if (!b || b.score == null || !Number.isFinite(b.score)) {
    return `<span class="text-slate-500" data-benchlm-cell="unavailable">—</span>`;
  }
  const verified = !!b.verified;
  const kind = verified ? 'benchlm-verified' : 'benchlm-estimated';
  const label = verified ? 'verified' : 'estimated';
  const r = Number.isFinite(b.reliability) ? Math.max(0, Math.min(1, b.reliability)) : 0;
  const filled = Math.min(5, Math.floor(r * 5));
  const empty = 5 - filled;
  let dots = `<span data-reliability-dots data-reliability="${r.toFixed(2)}" class="inline-flex gap-0.5 ml-1.5 align-middle" aria-label="reliability ${(filled / 5 * 100).toFixed(0)}%">`;
  for (let i = 0; i < filled; i++) {
    dots += `<span data-dot="filled" class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>`;
  }
  for (let i = 0; i < empty; i++) {
    dots += `<span data-dot="empty" class="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block"></span>`;
  }
  dots += `</span>`;
  return `<div class="inline-flex items-center" data-benchlm-cell="scored" data-verified="${verified}">${badge(kind, label)}${dots}</div>`;
}

/**
 * Build the source-badges cell. After PR3 we drop the per-benchmark
 * badges (arena / swePro / sweVer / term) — BenchLM is now the source
 * of truth. Pricing + NEW flag remain.
 *
 * @param {Object} m
 * @returns {string} HTML
 */
function sourceBadges(m) {
  const parts = [];
  if (m.input != null || m.output != null) {
    parts.push(badge('price', fmtPrice(m.input)));
  }
  if (m.isNew === true) parts.push(badge('new', 'NEW'));
  return parts.length > 0 ? parts.join(' ') : badge('none', '—');
}

/**
 * Sort models: active rows first (by compositeScore desc; cheaper input
 * breaks ties), reference rows appended after (sorted among themselves
 * the same way).
 *
 * @param {Object<string, Object>} models
 * @returns {Array<[string, Object]>}
 */
function rowsFor(models) {
  return Object.entries(models || {})
    .filter(([, m]) => m)
    .sort((a, b) => {
      const aRef = a[1].tier === 'reference' || a[1].isReference === true;
      const bRef = b[1].tier === 'reference' || b[1].isReference === true;
      if (aRef !== bRef) return aRef ? 1 : -1;
      const sa = compositeScore(a[1]);
      const sb = compositeScore(b[1]);
      // Nulls sort AFTER any numeric score within the same tier group.
      if (sa == null && sb == null) return 0;
      if (sa == null) return 1;
      if (sb == null) return -1;
      if (sb !== sa) return sb - sa;
      const ca = Number.isFinite(a[1].input) ? a[1].input : Infinity;
      const cb = Number.isFinite(b[1].input) ? b[1].input : Infinity;
      return ca - cb;
    });
}

/**
 * Render the reference table into `targetEl`. Pure render.
 *
 * @param {HTMLElement} targetEl
 * @param {Object<string, Object>} models
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
      const cs = compositeScore(m);
      const score = cs == null ? '—' : cs.toFixed(1);
      const isRef = m.tier === 'reference' || m.isReference === true;
      const newBadge = m.isNew === true
        ? ' <span class="src-badge src-new">NEW</span>'
        : '';
      const tierCell = isRef
        ? `<span class="src-badge" style="background:rgba(244,63,94,.15);color:#fda4af;">REFERENCE</span>`
        : escapeHtml(m.tier || '—');
      const rowClass = isRef
        ? 'opacity-80 bg-slate-900/30'
        : 'hover:bg-slate-800/30 transition';
      return `
        <tr class="${rowClass}" data-model-key="${escapeAttr(key)}" data-verified="${m.benchlm && m.benchlm.verified === true ? 'true' : 'false'}" ${cs == null ? 'data-unavailable="true"' : ''}>
          <td class="py-2.5 px-3 font-medium">${escapeHtml(m.name || key)}${newBadge}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs">${tierCell}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs" data-score="${cs == null ? '0' : cs.toFixed(2)}">${score}</td>
          <td class="py-2.5 px-3 text-center">${benchlmProvenanceHtml(m)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.input)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.output)}</td>
          <td class="py-2.5 px-3 text-center text-[11px] space-x-1">${sourceBadges(m)}</td>
        </tr>`;
    })
    .join('');

  const activeCount = rows.filter(([, m]) => m.tier !== 'reference' && m.isReference !== true).length;
  const refCount = rows.length - activeCount;

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table class="w-full text-left text-sm text-slate-200">
        <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th class="py-2.5 px-3 font-semibold">Modelo</th>
            <th class="py-2.5 px-3 font-semibold text-center">Tier</th>
            <th class="py-2.5 px-3 font-semibold text-center">Score</th>
            <th class="py-2.5 px-3 font-semibold text-center">BenchLM</th>
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
      Showing ${activeCount} active model${activeCount === 1 ? '' : 's'}${refCount > 0 ? ` + ${refCount} reference` : ''} ·
      sorted by BenchLM score (desc) ·
      reference rows appear at the bottom for comparison baseline ·
      rows without BenchLM data show "—" (awaiting first scrape).
    </p>
  `;

  return {
    rows: rows.length,
    topKey: rows[0]?.[0] ?? null,
    referenceModel,
  };
}

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
