// js/components/ref-table.js
// S3d (aa-only-scoring verify remediation) — delta column/row contract.
//
// Public API:
//   render(targetEl, models)  → { rows, topKey, referenceModel }
//
// Contract (delta "UI Component — Reference Table"):
//   - One row per II-covered eligible non-reference model:
//       Modelo | Esfuerzo | Score | Arena | SWE-Pro | SWE-Ver | Term |
//       Input $ | Output $ | Sources (10 columns, no Tier).
//   - The score column reads `intelligenceIndex` directly (1 decimal),
//     sorted II-desc with the cheaper-input tie-break and the `isNew` pin.
//   - Benchmark value cells + source badges are informational only
//     (phase-1 convention) — never sort keys. Null benchmark → "—".
//   - Reference/legacy/benchmark-only rows never reach the ranked DOM
//     (design §6 ranked projection: active + finite II). The
//     `rowsFor`/`orderRows` non-active path stays for the export builders
//     (load-bearing full-catalog scope) — DOM only shows rankedActive.
//   - The sources cell surfaces benchmark badges + pricing + NEW flag.

import { compositeScore, lifecycleOf } from '../services/model-scorer.js';
import { buildIiRankingContext, formatHiddenIiNote } from '../services/ii-ranking.js';
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
  if (kind === 'none') cls = 'src-badge src-none';
  else if (kind === 'price') cls = 'src-badge src-price';
  else if (kind === 'new') cls = 'src-badge src-new';
  else if (kind === 'arena') cls = 'src-badge src-arena';
  else if (kind === 'swePro') cls = 'src-badge src-swe';
  else if (kind === 'sweVer') cls = 'src-badge src-swe-ver';
  else if (kind === 'term') cls = 'src-badge src-term';
  else cls = 'src-badge';
  return `<span class="${cls}">${label}</span>`;
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
 * Build the source-badges cell: benchmark badges (informational only,
 * phase-1 convention — never sort keys) + pricing + NEW flag.
 * A null/absent benchmark shows no badge (delta scenario).
 *
 * @param {Object} m
 * @returns {string} HTML
 */
function sourceBadges(m) {
  const parts = [];
  if (m.arena != null) parts.push(badge('arena', String(m.arena)));
  if (m.swePro != null) parts.push(badge('swePro', `${fmt(m.swePro)}%`));
  if (m.sweVer != null) parts.push(badge('sweVer', `${fmt(m.sweVer)}%`));
  if (m.term != null) parts.push(badge('term', `${fmt(m.term)}%`));
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
 * Order rows for display/export: ranked (finite II) only, active before
 * non-active. II-less rows are hidden, never rendered (S3b hide rule).
 * S3c removed the broad Con-AA/Sin-AA split by `aa-signal.js` — finite II
 * is the sole ranking predicate (design §7/§12). Shared by render() and
 * the export builders so the file mirrors exactly the eligible set the
 * user saw.
 *
 * @param {Object<string, Object>} models
 * @returns {Object}
 */
function orderRows(models) {
  const { active, nonActive } = rowsFor(models);
  const isRanked = ([, mm]) => compositeScore(mm) != null;
  const rankedActive = active.filter(isRanked);
  const rankedNonActive = nonActive.filter(isRanked);
  return {
    active,
    nonActive,
    activeCount: active.length,
    nonActiveCount: nonActive.length,
    rankedActive,
    rankedNonActive,
    groupedRows: [...rankedActive, ...rankedNonActive],
  };
}

/** Build the export rows (name/effort/lifecycle/score/prices). Full-catalog scope only. */
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

/** Plain-text Sources cell for the filtered export (mirrors sourceBadges text). */
function sourceText(m) {
  const parts = [];
  if (m.arena != null) parts.push(String(m.arena));
  if (m.swePro != null) parts.push(`${fmt(m.swePro)}%`);
  if (m.sweVer != null) parts.push(`${fmt(m.sweVer)}%`);
  if (m.term != null) parts.push(`${fmt(m.term)}%`);
  if (m.input != null || m.output != null) parts.push(fmtPrice(m.input));
  if (m.isNew === true) parts.push('NEW');
  return parts.length > 0 ? parts.join(' ') : '—';
}

/**
 * Build the filtered-export rows: the visible ranked set only
 * (rankedActive, 10 DOM contract columns, no Lifecycle).
 */
function filteredExportRowsFrom(rankedActive) {
  return rankedActive.map(([key, m]) => {
    const sc = compositeScore(m);
    return [
      m.name || key,
      effortLabel(m.effort) || '—',
      Number.isFinite(sc) ? sc.toFixed(1) : '—',
      m.arena != null ? String(m.arena) : '—',
      m.swePro != null ? `${fmt(m.swePro)}%` : '—',
      m.sweVer != null ? `${fmt(m.sweVer)}%` : '—',
      m.term != null ? `${fmt(m.term)}%` : '—',
      Number.isFinite(m.input) ? `$${m.input.toFixed(2)}` : '—',
      Number.isFinite(m.output) ? `$${m.output.toFixed(2)}` : '—',
      sourceText(m),
    ];
  });
}

const FILTERED_EXPORT_HEADERS = ['Modelo', 'Esfuerzo', 'Score', 'Arena', 'SWE-Pro', 'SWE-Ver', 'Term', 'Input $', 'Output $', 'Sources'];

/** Build the filtered/full-catalog markdown + JSON payloads. */
function buildExportPayload(order, context, scope) {
  const ctx = { ...(context || {}), scope };
  // S3e: the default (filtered) export reproduces the visible ranked set
  // (rankedActive, 10 contract columns, no Lifecycle). The full-catalog
  // scope keeps its existing projection untouched.
  const isFiltered = scope === 'filtered';
  const exportedRows = isFiltered ? order.rankedActive : order.groupedRows;
  const rows = isFiltered ? filteredExportRowsFrom(exportedRows) : exportRowsFrom(exportedRows);
  const md =
    `${exportHeader(ctx)}\n# SDD Models (${order.activeCount} active + ${order.nonActiveCount} non-active)\n\n` +
    markdownTable(
      isFiltered ? FILTERED_EXPORT_HEADERS : ['Modelo', 'Esfuerzo', 'Lifecycle', 'Score', 'Input $', 'Output $'],
      rows
    ) +
    '\n';
  const json = toJSON(
    {
      active: order.activeCount,
      nonActive: order.nonActiveCount,
      ranked: exportedRows.length,
      models: exportedRows.map(([k, m]) => [k, m]),
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
  const filtered = buildExportPayload(orderRows(models || {}), context, 'filtered'); const rankForExport = (opts && opts.rankingContext) || buildIiRankingContext(models || {}, (opts && opts.modelsMeta) || undefined); const noteForExport = formatHiddenIiNote(rankForExport.hiddenCount, rankForExport.asOfDate || new Date().toISOString().slice(0, 10)); if (noteForExport) { const nl = String.fromCharCode(10); const parts = filtered.md.split(nl); parts.splice(1, 0, noteForExport); filtered.md = parts.join(nl); }
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
 * Build one table row's HTML (ranked row: active + finite II).
 * Benchmark cells are informational only (never sort keys).
 *
 * @param {string} key
 * @param {Object} m
 * @returns {string} HTML
 */
function rowHtml(key, m) {
  const cs = compositeScore(m);
  const score = cs == null ? '—' : cs.toFixed(1);
  const newBadge = m.isNew === true
    ? ' <span class="src-badge src-new">NEW</span>'
    : '';
  return `
        <tr class="hover:bg-slate-800/30 transition" data-model-key="${escapeAttr(key)}" data-lifecycle="active">
          <td class="py-2.5 px-3 font-medium">${escapeHtml(m.name || key)}${newBadge}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs">${effortCellHtml(m.effort)}</td>
          <td class="py-2.5 px-3 text-center font-mono text-xs" data-score="${cs == null ? '0' : cs.toFixed(2)}">${score}</td>
          <td class="py-2.5 px-3 text-center">${badge('arena', m.arena ?? '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('swePro', m.swePro != null ? `${fmt(m.swePro)}%` : '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('sweVer', m.sweVer != null ? `${fmt(m.sweVer)}%` : '—')}</td>
          <td class="py-2.5 px-3 text-center">${badge('term', m.term != null ? `${fmt(m.term)}%` : '—')}</td>
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
  // S3d F2: the ranked DOM is the design §6 ranked projection only
  // (active + finite II). orderRows keeps the non-active path for the
  // load-bearing export builders — render never shows it.
  const visibleRows = ordered.rankedActive;
  const referenceModel =
    Object.values(models).find((m) => m && lifecycleOf(m) === 'reference') ||
    null;

  if (visibleRows.length === 0) {
    // S3d F3: the empty state hides nothing by itself, but an all-II-less
    // set has hiddenCount N = total > 0 — the shared note is required here.
    const emptyCtx = (typeof options !== 'undefined' && options && options.rankingContext) || buildIiRankingContext(models, (typeof options !== 'undefined' && options && options.modelsMeta) || undefined);
    const emptyNote = formatHiddenIiNote(emptyCtx.hiddenCount, emptyCtx.asOfDate || new Date().toISOString().slice(0, 10));
    const emptyNoteHtml = emptyNote ? '<p class="mt-2 text-xs text-slate-400" data-test="hidden-ii-note">' + emptyNote + '</p>' : '';
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/60">
          <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold" data-test="ref-table-empty-count">0 activos</span>
          <div data-test="ref-table-export"></div>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400" data-test="empty-state">
          No hay modelos elegibles con estas suscripciones.
        </div>
      </div>
      ${emptyNoteHtml}`;
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

  const rankedCount = visibleRows.length;
  const rankingCtx = (typeof options !== 'undefined' && options && options.rankingContext) || buildIiRankingContext(models, (typeof options !== 'undefined' && options && options.modelsMeta) || undefined);
  const hiddenNote = formatHiddenIiNote(rankingCtx.hiddenCount, rankingCtx.asOfDate || new Date().toISOString().slice(0, 10));
  const hiddenNoteHtml = hiddenNote ? '<p class="mt-2 text-xs text-slate-400" data-test="hidden-ii-note">' + hiddenNote + '</p>' : '';

  // S3d F2: single ranked table (finite-II active only). Reference rows
  // and the BenchLM/Lifecycle columns are gone per the delta contract.
  function rankedTableHtml({ activeRows }) {
    const activeBody = activeRows
      .map(([key, m]) => rowHtml(key, m))
      .join('');
    return `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-200">
            <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" class="py-2.5 px-3 font-semibold">Modelo</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Esfuerzo</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Score</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Arena</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">SWE-Pro</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">SWE-Ver</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Term</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-right">Input $</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-right">Output $</th>
                <th scope="col" class="py-2.5 px-3 font-semibold text-center">Sources</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60" data-test="active-rows">
              ${activeBody || `<tr><td colspan="10" class="py-3 px-3 text-center text-xs text-slate-500">Sin modelos activos en esta vista.</td></tr>`}
            </tbody>
          </table>
        </div>`;
  }

  // V5 Slice 3 — the default export is the filtered view; the full catalog
  // is an explicit action inside the menu (never inferred).
  const exportFormats = buildExportFormats(models, options);

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/60">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">${rankedCount} activos</span>
        <div data-test="ref-table-export"></div>
      </div>
      ${rankedTableHtml({ activeRows: visibleRows })}
    </div>
    ${hiddenNoteHtml}
        <p class="mt-3 text-xs text-slate-500">
      Showing ${rankedCount} active model${rankedCount === 1 ? '' : 's'},
      sorted by Artificial Analysis Intelligence Index (desc);
      rows without Intelligence Index are hidden (see note).
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
    rows: visibleRows.length,
    topKey: visibleRows[0]?.[0] ?? null,
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
