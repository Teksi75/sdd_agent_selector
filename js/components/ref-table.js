// js/components/ref-table.js
// PR3 (benchlm-replace-custom-scoring) — ref-table cutover.
//
// Public API:
//   render(targetEl, models)  → { rows, topKey, referenceModel }
//
// Contract (PR3, per spec benchlm-data-model + spec "UI Component —
// Reference Table"):
//   - Every non-reference model renders as one `<tr>` carrying:
//       Modelo | Esfuerzo | Score | BenchLM (badge + reliability) |
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

import { compositeScore, lifecycleOf } from '../services/model-scorer.js';
import { splitByAaSignal } from '../services/aa-signal.js';
import { render as renderExportButton } from './export-button.js';
import { toJSON, markdownTable, exportFilename, exportHeader } from '../services/exporter.js';
import { effortTagHtml, effortLabel } from './effort-tag.js';

const REFERENCE_DISPLAY_ORDER = ['gpt56sol', 'opus48', 'gpt56terra', 'gpt56luna'];

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
 * Build the optional first-class effort badge for a model row via the
 * shared renderer (PR-B effort-only): missing or out-of-vocabulary effort
 * falls back to the em-dash placeholder, never an invented label.
 */
function effortCellHtml(effort) {
  return effortTagHtml(effort) || '—';
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
 * Sort models: active rows first (V5 follow-up — `isNew === true` rows are
 * pinned to the top of the active group, then compositeScore desc; cheaper
 * input breaks ties), non-active rows appended after (sorted among themselves
 * the same way, reference display order first).
 *
 * @param {Object<string, Object>} models
 * @returns {{ active: Array<[string, Object]>, nonActive: Array<[string, Object]> }}
 */
export function rowsFor(models) {
  const entries = Object.entries(models || {}).filter(([, m]) => m);
  const active = [];
  const nonActive = [];
  for (const entry of entries) {
    const lc = lifecycleOf(entry[1]);
    if (lc === 'active') active.push(entry);
    else if (lc !== 'legacy') nonActive.push(entry);
  }
  const compareScore = (a, b) => {
    const sa = compositeScore(a[1]);
    const sb = compositeScore(b[1]);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sb !== sa) return sb - sa;
    const ca = Number.isFinite(a[1].input) ? a[1].input : Infinity;
    const cb = Number.isFinite(b[1].input) ? b[1].input : Infinity;
    return ca - cb;
  };
  // V5 follow-up (v5-fup-acquire-003): the pin is scoped to the active group —
  // every `isNew` row leads, so null-score newcomers stop sinking to the bottom;
  // non-active rows keep the existing reference ordering untouched.
  const compareActive = (a, b) => {
    const aNew = a[1].isNew === true;
    const bNew = b[1].isNew === true;
    if (aNew !== bNew) return aNew ? -1 : 1;
    return compareScore(a, b);
  };
  active.sort(compareActive);
  const orderIndex = new Map(REFERENCE_DISPLAY_ORDER.map((k, i) => [k, i]));
  nonActive.sort((a, b) => {
    const ai = orderIndex.has(a[0]) ? orderIndex.get(a[0]) : Infinity;
    const bi = orderIndex.has(b[0]) ? orderIndex.get(b[0]) : Infinity;
    if (ai !== bi) return ai - bi;
    return compareScore(a, b);
  });
  return { active, nonActive };
}

/**
 * Order rows for display/export: Con-AA first, Sin-AA second, active before
 * non-active inside each block. Shared by render() and the export builders so
 * the file mirrors exactly the eligible set the user saw.
 *
 * @param {Object<string, Object>} models
 * @returns {Object}
 */
function orderRows(models) {
  const { active, nonActive } = rowsFor(models);
  const groupedActive = splitByAaSignal(active, ([, m]) => m);
  const groupedNonActive = splitByAaSignal(nonActive, ([, m]) => m);
  const withAaRows = [...groupedActive.withAa, ...groupedNonActive.withAa];
  const withoutAaRows = [...groupedActive.withoutAa, ...groupedNonActive.withoutAa];
  return {
    active,
    nonActive,
    groupedActive,
    groupedNonActive,
    activeCount: active.length,
    nonActiveCount: nonActive.length,
    withAa: withAaRows.length,
    withoutAa: withoutAaRows.length,
    groupedRows: [...withAaRows, ...withoutAaRows],
  };
}

/** Build the export rows (name/effort/lifecycle/score/prices). */
function exportRowsFrom(groupedRows) {
  return groupedRows.map(([key, m]) => {
    const sc = compositeScore(m);
    return [
      m.name || key,
      effortLabel(m.effort) || '—',
      lifecycleOf(m),
      Number.isFinite(sc) ? sc.toFixed(1) : '—',
      Number.isFinite(m.input) ? `$${m.input.toFixed(2)}` : '—',
      Number.isFinite(m.output) ? `$${m.output.toFixed(2)}` : '—',
    ];
  });
}

/** Build the filtered/full-catalog markdown + JSON payloads. */
function buildExportPayload(order, context, scope) {
  const ctx = { ...(context || {}), scope };
  const rows = exportRowsFrom(order.groupedRows);
  const md =
    `${exportHeader(ctx)}\n# SDD Models (${order.activeCount} active + ${order.nonActiveCount} non-active)\n\n` +
    markdownTable(
      ['Modelo', 'Esfuerzo', 'Lifecycle', 'Score', 'Input $', 'Output $'],
      rows
    ) +
    '\n';
  const json = toJSON(
    {
      active: order.activeCount,
      nonActive: order.nonActiveCount,
      withAa: order.withAa,
      withoutAa: order.withoutAa,
      models: order.groupedRows.map(([k, m]) => [k, m]),
    },
    ctx
  );
  return { md, json };
}

/**
 * Build the export formats for `models` (the eligible/visible view). The full
 * catalog is added ONLY when `options.fullCatalogModels` is supplied — an
 * explicit opt-in action, never inferred from an empty filtered set.
 *
 * @param {Object<string, Object>} models - visible (filtered) models
 * @param {{ exportContext?: Object, fullCatalogModels?: Object }} [options]
 * @returns {Array<Object>}
 */
export function buildExportFormats(models, options) {
  const opts = options || {};
  const context = opts.exportContext || {};
  const filtered = buildExportPayload(orderRows(models || {}), context, 'filtered');
  const formats = [
    { id: 'copy-md', label: 'Copiar markdown', description: 'Tabla de modelos visibles', content: filtered.md, scope: 'filtered' },
    {
      id: 'download-md',
      label: 'Descargar markdown',
      description: 'Archivo .md con la vista filtrada',
      content: filtered.md,
      filename: exportFilename('ref-table', 'md'),
      scope: 'filtered',
    },
    {
      id: 'download-json',
      label: 'Descargar JSON',
      description: 'Snapshot filtrado · fuente de verdad',
      content: filtered.json,
      filename: exportFilename('ref-table', 'json'),
      mime: 'application/json',
      scope: 'filtered',
    },
  ];
  if (opts.fullCatalogModels) {
    const full = buildExportPayload(orderRows(opts.fullCatalogModels), context, 'full-catalog');
    formats.push({
      id: 'copy-md-full-catalog',
      label: 'Copiar catálogo completo',
      description: 'Ignora el filtro de suscripciones',
      content: full.md,
      scope: 'full-catalog',
    });
    formats.push({
      id: 'download-md-full-catalog',
      label: 'Descargar catálogo completo',
      description: 'Archivo .md con todos los modelos',
      content: full.md,
      filename: exportFilename('ref-table-full', 'md'),
      scope: 'full-catalog',
    });
    formats.push({
      id: 'download-json-full-catalog',
      label: 'Descargar JSON completo',
      description: 'Snapshot completo · ignora el filtro',
      content: full.json,
      filename: exportFilename('ref-table-full', 'json'),
      mime: 'application/json',
      scope: 'full-catalog',
    });
  }
  return formats;
}

/**
 * Build one table row's HTML.
 *
 * @param {string} key
 * @param {Object} m
 * @param {boolean} isNonActive
 * @returns {string} HTML
 */
function rowHtml(key, m, isNonActive) {
  const cs = compositeScore(m);
  const score = cs == null ? '—' : cs.toFixed(1);
  const lc = lifecycleOf(m);
  const newBadge = m.isNew === true
    ? ' <span class="src-badge src-new">NEW</span>'
    : '';
  const lifecycleCell = isNonActive
    ? `<span class="font-mono text-xs text-slate-400">${escapeHtml(lc)}</span>`
    : `<span class="font-mono text-xs text-emerald-400">active</span>`;
  const rowClass = isNonActive
    ? 'opacity-60 bg-slate-900/30'
    : 'hover:bg-slate-800/30 transition';
  return `
        <tr class="${rowClass}" data-model-key="${escapeAttr(key)}" data-lifecycle="${escapeAttr(lc)}" data-verified="${m.benchlm && m.benchlm.verified === true ? 'true' : 'false'}" ${cs == null ? 'data-unavailable="true"' : ''}>
          <td class="py-2.5 px-3 font-medium">${escapeHtml(m.name || key)}${newBadge}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs">${effortCellHtml(m.effort)}</td>
          <td class="py-2.5 px-3 text-center">${lifecycleCell}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs" data-score="${cs == null ? '0' : cs.toFixed(2)}">${score}</td>
          <td class="py-2.5 px-3 text-center">${benchlmProvenanceHtml(m)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.input)}</td>
          <td class="py-2.5 px-3 text-right font-mono text-xs">${fmtPrice(m.output)}</td>
          <td class="py-2.5 px-3 text-center text-[11px] space-x-1">${sourceBadges(m)}</td>
        </tr>`;
}

/**
 * Render the reference table into `targetEl`. Pure render.
 *
 * @param {HTMLElement} targetEl
 * @param {Object<string, Object>} models
 * @returns {{ rows: number, topKey: string|null, referenceModel: Object|null }}
 */
export function render(targetEl, models, options) {
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

  const ordered = orderRows(models);
  const allRows = ordered.groupedRows;
  const referenceModel =
    Object.values(models).find((m) => m && lifecycleOf(m) === 'reference') ||
    null;

  if (allRows.length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/60">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold" data-test="ref-table-empty-count">0 activos · 0 Con-AA / 0 Sin-AA</span>
          <div data-test="ref-table-export"></div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400" data-test="empty-state">
          No hay modelos elegibles con estas suscripciones.
        </div>
      </div>`;
    // The default export stays available (empty set + filtered metadata);
    // the full catalog is still only inside the explicit menu action.
    const emptyExportMount = targetEl.querySelector('[data-test="ref-table-export"]');
    if (emptyExportMount) {
      renderExportButton(emptyExportMount, {
        sectionId: 'ref-table',
        formats: buildExportFormats(models, options),
        copyMessage: 'Tabla copiada al portapapeles',
        downloadMessage: 'Descarga iniciada',
      });
    }
    return { rows: 0, topKey: null, referenceModel };
  }

  const activeCount = ordered.activeCount;
  const nonActiveCount = ordered.nonActiveCount;
  const groupedActive = ordered.groupedActive;
  const groupedNonActive = ordered.groupedNonActive;
  const withAaRows = [...groupedActive.withAa, ...groupedNonActive.withAa];
  const withoutAaRows = [...groupedActive.withoutAa, ...groupedNonActive.withoutAa];
  const groupedRows = ordered.groupedRows;

  function tableSectionHtml({ title, rows, activeRows, nonActiveRows, testId }) {
    if (rows.length === 0) {
      return `
      <details class="border-t border-slate-800/60 first:border-t-0" open data-test="${testId}">
        <summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800/40">
          ${title} <span class="ml-2 text-[11px] font-normal text-slate-500">0 modelos</span>
        </summary>
        <p class="px-4 pb-4 text-xs text-slate-500">No hay modelos en esta sección.</p>
      </details>`;
    }
    const activeBody = activeRows
      .map(([key, m]) => rowHtml(key, m, false))
      .join('');
    const nonActiveBody = nonActiveRows
      .map(([key, m]) => rowHtml(key, m, true))
      .join('');
    const activeTestId = testId === 'ref-table-without-aa' ? 'active-rows' : `${testId}-active-rows`;
    const nonActiveTestId = testId === 'ref-table-without-aa' ? 'non-active-rows' : `${testId}-non-active-rows`;
    const nonActiveSection = nonActiveRows.length > 0 ? `
          <tbody class="divide-y divide-slate-800/30 border-t-2 border-slate-700/50" data-test="${nonActiveTestId}">
            ${nonActiveBody}
          </tbody>` : '';
    return `
      <details class="border-t border-slate-800/60 first:border-t-0" open data-test="${testId}">
        <summary class="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800/40">
          ${title} <span class="ml-2 text-[11px] font-normal text-slate-500">${rows.length} modelos</span>
        </summary>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-200">
            <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" class="py-2.5 px-3 font-semibold">Modelo</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Esfuerzo</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Lifecycle</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Score</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">BenchLM</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-right">Input $</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-right">Output $</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Sources</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60" data-test="${activeTestId}">
              ${activeBody || `<tr><td colspan="8" class="py-3 px-3 text-center text-xs text-slate-500">Sin modelos activos en esta sección.</td></tr>`}
            </tbody>
            ${nonActiveSection}
          </table>
        </div>
      </details>`;
  }

  // V5 Slice 3 — the default export is the filtered view; the full catalog
  // is an explicit action inside the menu (never inferred).
  const exportFormats = buildExportFormats(models, options);

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/60">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">${activeCount} activos${nonActiveCount > 0 ? ` + ${nonActiveCount} reference` : ''} · ${withAaRows.length} Con-AA / ${withoutAaRows.length} Sin-AA</span>
        <div data-test="ref-table-export"></div>
      </div>
      ${tableSectionHtml({ title: 'Con valoración en AA', rows: withAaRows, activeRows: groupedActive.withAa, nonActiveRows: groupedNonActive.withAa, testId: 'ref-table-with-aa' })}
      ${tableSectionHtml({ title: 'Sin valoración en AA', rows: withoutAaRows, activeRows: groupedActive.withoutAa, nonActiveRows: groupedNonActive.withoutAa, testId: 'ref-table-without-aa' })}
    </div>
    <p class="mt-3 text-xs text-slate-500">
      Showing ${activeCount} active model${activeCount === 1 ? '' : 's'}${nonActiveCount > 0 ? ` + ${nonActiveCount} non-active (reference)` : ''} ·
      grouped by Artificial Analysis signal ·
      sorted by BenchLM score (desc) inside each lifecycle bucket ·
      rows without BenchLM data show "—" (awaiting first scrape).
    </p>
  `;

  // Mount the export button into the placeholder container. The
  // destroy() at the start of renderExportButton.render() is idempotent,
  // so re-renders of ref-table don't leak document listeners.
  const exportMount = targetEl.querySelector('[data-test="ref-table-export"]');
  if (exportMount) {
    renderExportButton(exportMount, {
      sectionId: 'ref-table',
      formats: exportFormats,
      copyMessage: 'Tabla copiada al portapapeles',
      downloadMessage: 'Descarga iniciada',
    });
  }

  return {
    rows: allRows.length,
    topKey: groupedRows[0]?.[0] ?? null,
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
