// js/components/composite-chart.js
// Phase 2c — composite-chart: horizontal bar chart of compositeScore.
//
// Public API (per spec.md "UI Component - Composite Chart" +
//   design.md "Components — composite-chart"):
//     render(targetEl, models)
//     resetForTests() — clears the module-level cache between jsdom tests
//
// Contract:
//   - Reference models (tier === 'reference' OR isReference === true) are
//     excluded — matches the same rule used by ref-table.js.
//   - Bars are sorted by compositeScore descending (spec scenario:
//     "Bars sorted descending").
//   - Each bar carries the model name and the composite score (1 decimal),
//     plus a CSS-driven bar-fill whose width is proportional to the score
//     relative to the best score in the rendered set.
//   - Tier-based bar colors: high → emerald, balanced → indigo,
//     budget → amber. Colors are sourced from tokens.css when the
//     --composite-tier-{...} CSS vars are defined; otherwise we fall back
//     to Tailwind bg-* classes so the chart still looks correct in tests
//     and in production before tokens.css ships.
//
// No global side effects: no fetch, no sessionStorage, no DOM lookups by id.

import { compositeScore } from '../services/model-scorer.js';

// Cache of CSS-token lookups per tier so we don't re-read getComputedStyle
// on every render. Only populated during a real run with a <styles> link
// in place — jsdom returns empty strings and we fall back to Tailwind.
const _tokenCache = Object.create(null);

function _resetTokenCache() {
  for (const k of Object.keys(_tokenCache)) delete _tokenCache[k];
}

/**
 * Resolve the bar fill color for a tier. Tries the
 * `--composite-tier-{tier}` CSS custom property first (defined in
 * tokens.css), then falls back to a Tailwind utility class so the
 * chart renders correctly even when tokens.css has not been linked.
 *
 * @param {Document} doc
 * @param {'high'|'balanced'|'budget'} tier
 * @returns {{ value: string, tw: string }} `value` is the resolved CSS
 *   color (or '' when absent); `tw` is the Tailwind class used as fallback.
 */
function barColor(doc, tier) {
  const slug = tier === 'high' ? 'high' : tier === 'budget' ? 'budget' : 'balanced';
  const twClass =
    tier === 'high' ? 'bg-emerald-500' :
    tier === 'budget' ? 'bg-amber-500' :
    'bg-indigo-500';
  const cacheKey = `${slug}|${doc === document ? 'dom' : 'test'}`;
  if (cacheKey in _tokenCache) return _tokenCache[cacheKey];
  let value = '';
  try {
    const root = doc.documentElement ?? doc.body ?? null;
    if (root) {
      const cssVar = getComputedStyle(root).getPropertyValue(
        `--composite-tier-${slug}`
      );
      value = cssVar ? cssVar.trim() : '';
    }
  } catch {
    // jsdom + computed-style fallback; keep empty.
  }
  const out = { value, tw: twClass };
  _tokenCache[cacheKey] = out;
  return out;
}

/** Minimal HTML escaper. Keeps model names + tier names safe against XSS. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * Pick the tier tag for a model. Falls back to 'balanced' when the
 * field is missing or unrecognized — keeps the chart visually consistent.
 *
 * @param {Object} m
 * @returns {'high'|'balanced'|'budget'}
 */
function tierOf(m) {
  const t = m && m.tier;
  if (t === 'high' || t === 'balanced' || t === 'budget') return t;
  return 'balanced';
}

/**
 * Filter out reference-tier models and sort the remainder by
 * compositeScore descending. Ties break toward the model with the
 * cheaper `input` price (deterministic + matches the ref-table contract).
 *
 * @param {Object<string, Object>} models
 * @returns {Array<[string, Object, number]>}
 */
function rowsFor(models) {
  return Object.entries(models || {})
    .filter(([, m]) => m && m.tier !== 'reference' && m.isReference !== true)
    .map(([k, m]) => [k, m, compositeScore(m)])
    .sort((a, b) => {
      if (b[2] !== a[2]) return b[2] - a[2];
      const ca = Number.isFinite(a[1]?.input) ? a[1].input : Infinity;
      const cb = Number.isFinite(b[1]?.input) ? b[1].input : Infinity;
      return ca - cb;
    });
}

/**
 * Compute the CSS width% for a bar. We anchor width to the best (top)
 * score in the rendered set so the chart visually conveys "this is the
 * best", but use a small min-floor so a zero-scoring model still shows
 * something. The same algorithm runs in jsdom tests + production; only
 * the CSS variable substitution differs.
 *
 * @param {number} score - compositeScore for the bar
 * @param {number} maxScore - the highest compositeScore in the rendered set
 * @returns {number} integer in [MIN_PCT, 100]
 */
function widthPct(score, maxScore) {
  const MIN_PCT = 4;
  if (maxScore <= 0) return MIN_PCT;
  const raw = (score / maxScore) * 100;
  const clamped = Math.max(MIN_PCT, Math.min(100, raw));
  return Math.round(clamped * 10) / 10; // 1 decimal so the data-width attr is readable
}

/** Build one row's HTML. Pulled out for testability + readability. */
function barRowHtml(key, m, score, width, bgClass, bgValue) {
  const newBadge =
    m.isNew === true
      ? ' <span class="src-badge src-new ml-1">NEW</span>'
      : '';
  const tierLabel = esc(tierOf(m));
  // When the token value is present, prefer it via inline style — but still
  // keep a Tailwind fallback class so the chart survives a missing tokens.css.
  const fillStyle = bgValue ? ` style="width:${width}%;background-color:${esc(bgValue)}"` : ` style="width:${width}%"`;
  const fillClass = bgValue ? 'bar-fill' : `bar-fill ${bgClass}`;
  return `
    <div class="flex items-center gap-3" data-model-key="${esc(key)}" data-score="${score.toFixed(2)}" data-width="${width}" data-tier="${tierLabel}">
      <div class="w-36 md:w-44 text-xs font-medium text-slate-200 truncate">${esc(m.name || key)}${newBadge}</div>
      <div class="flex-1 bar-track rounded-full bg-slate-800/60 overflow-hidden h-3">
        <div class="${fillClass} h-3 rounded-full"${fillStyle}></div>
      </div>
      <div class="w-14 text-right text-xs font-mono text-emerald-300">${score.toFixed(1)}</div>
    </div>`;
}

/**
 * Render the composite-score bar chart into `targetEl`. Pure render — does
 * not look up DOM by id, fetch, or mutate globals beyond clearing the
 * internal token cache.
 *
 * @param {HTMLElement} targetEl - mount point
 * @param {Object<string, Object>} models - keyed by model id
 * @returns {{ bars: number, maxScore: number|null }}
 */
export function render(targetEl, models) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('composite-chart.render: targetEl must be an HTMLElement');
  }
  if (!models || typeof models !== 'object') {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay datos de modelos para graficar.
      </div>`;
    return { bars: 0, maxScore: null };
  }

  const rows = rowsFor(models);
  if (rows.length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay modelos activos para mostrar.
      </div>`;
    return { bars: 0, maxScore: null };
  }

  const maxScore = rows[0][2]; // top score after sort
  const doc = targetEl.ownerDocument ?? document;
  const body = rows
    .map(([key, m, score]) => {
      const { value: bgValue, tw: twClass } = barColor(doc, tierOf(m));
      const width = widthPct(score, maxScore);
      return barRowHtml(key, m, score, width, twClass, bgValue);
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-200">Composite benchmark</h3>
        <span class="text-[11px] text-slate-500">${rows.length} modelos · score compuesto (0-100)</span>
      </div>
      <div class="space-y-2.5" data-test="composite-bars">
        ${body}
      </div>
      <p class="mt-3 text-[11px] text-slate-500">
        Colores desde <code>tokens.css</code> (--composite-tier-{high,balanced,budget});
        fallback a Tailwind cuando el token no está definido.
      </p>
    </div>`;

  return { bars: rows.length, maxScore };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  _resetTokenCache();
}
