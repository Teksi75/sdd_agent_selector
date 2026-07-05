// js/components/pricing-chart.js
// Phase 2d — pricing-chart: horizontal bar chart of costEstimate.
// Contract per spec.md "UI Component - Pricing Chart":
//   render(targetEl, models) — bars sorted by cost ASCENDING (cheapest first),
//   reference tier excluded, USD label (e.g. `$0.00028`), tier-based colors
//   from --pricing-tier-{high,balanced,budget} tokens with Tailwind fallback.

import { costEstimate } from '../services/model-scorer.js';

// Cache of CSS-token lookups per tier so we don't re-read getComputedStyle
// on every render. Only populated during a real run with a <styles> link
// in place — jsdom returns empty strings and we fall back to Tailwind.
const _tokenCache = Object.create(null);

function _resetTokenCache() {
  for (const k of Object.keys(_tokenCache)) delete _tokenCache[k];
}

/** Minimum bar width% so the cheapest model (e.g. $0.00028) still shows a sliver. */
const MIN_PCT = 4;

/**
 * Decimal places used for the currency label. 6 decimal places + trailing-zero
 * trim ensures spec value `$0.00028` renders exactly (toFixed(4) would round
 * 0.00028 to 0.0003 via IEEE-754 noise).
 */
const COST_DECIMALS = 6;

/**
 * Resolve the bar fill color for a tier via the `--pricing-tier-{tier}`
 * CSS custom property; fall back to a Tailwind utility class.
 *
 * @returns {{ value: string, tw: string }}
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
        `--pricing-tier-${slug}`
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

/** Minimal HTML escaper. Keeps model names safe against XSS. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/** Format a USD cost with `$` prefix; 6-decimal precision + trailing-zero trim. */
function fmtCost(cost) {
  const n = Number.isFinite(cost) ? cost : 0;
  const s = n.toFixed(COST_DECIMALS).replace(/0+$/, '').replace(/\.$/, '');
  return `$${s}`;
}

/**
 * Pick the tier tag for a model. Falls back to 'balanced' when the field
 * is missing or unrecognized — keeps the chart visually consistent.
 *
 * @param {Object} m
 * @returns {'high'|'balanced'|'budget'}
 */
function tierOf(m) {
  const t = m && m.tier;
  if (t === 'high' || t === 'balanced' || t === 'budget') return t;
  return 'balanced';
}

/** Filter out reference-tier models and sort the remainder by costEstimate ASCENDING. */
function rowsFor(models) {
  return Object.entries(models || {})
    .filter(([, m]) => m && m.tier !== 'reference' && m.isReference !== true)
    .map(([k, m]) => [k, m, costEstimate(m)])
    .sort((a, b) => {
      if (a[2] !== b[2]) return a[2] - b[2];
      const ca = Number.isFinite(a[1]?.input) ? a[1].input : Infinity;
      const cb = Number.isFinite(b[1]?.input) ? b[1].input : Infinity;
      return ca - cb;
    });
}

/** Width% anchored to maxCost, floored to MIN_PCT so cheap bars stay visible. */
function widthPct(cost, maxCost) {
  if (maxCost <= 0) return MIN_PCT;
  const raw = (cost / maxCost) * 100;
  const clamped = Math.max(MIN_PCT, Math.min(100, raw));
  return Math.round(clamped * 10) / 10;
}

/** Build one row's HTML. Pulled out for testability + readability. */
function barRowHtml(key, m, cost, width, bgClass, bgValue) {
  const newBadge =
    m.isNew === true
      ? ' <span class="src-badge src-new ml-1">NEW</span>'
      : '';
  const tierLabel = esc(tierOf(m));
  const fillStyle = bgValue ? ` style="width:${width}%;background-color:${esc(bgValue)}"` : ` style="width:${width}%"`;
  const fillClass = bgValue ? 'bar-fill' : `bar-fill ${bgClass}`;
  return `
    <div class="flex items-center gap-3" data-model-key="${esc(key)}" data-cost="${cost.toFixed(COST_DECIMALS)}" data-width="${width}" data-tier="${tierLabel}">
      <div class="w-36 md:w-44 text-xs font-medium text-slate-200 truncate">${esc(m.name || key)}${newBadge}</div>
      <div class="flex-1 bar-track rounded-full bg-slate-800/60 overflow-hidden h-3">
        <div class="${fillClass} h-3 rounded-full"${fillStyle}></div>
      </div>
      <div class="w-20 text-right text-xs font-mono text-emerald-300">${fmtCost(cost)}</div>
    </div>`;
}

/** Render the cost-per-default-request bar chart into `targetEl`. Pure render. */
export function render(targetEl, models) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('pricing-chart.render: targetEl must be an HTMLElement');
  }
  if (!models || typeof models !== 'object') {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay datos de modelos para graficar.
      </div>`;
    return { bars: 0, maxCost: null };
  }

  const rows = rowsFor(models);
  if (rows.length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay modelos activos para mostrar.
      </div>`;
    return { bars: 0, maxCost: null };
  }

  const maxCost = rows[rows.length - 1][2]; // highest cost after ascending sort
  const minCost = rows[0][2];
  const doc = targetEl.ownerDocument ?? document;
  const body = rows
    .map(([key, m, cost]) => {
      const { value: bgValue, tw: twClass } = barColor(doc, tierOf(m));
      const width = widthPct(cost, maxCost);
      return barRowHtml(key, m, cost, width, twClass, bgValue);
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-200">Pricing por request (default)</h3>
        <span class="text-[11px] text-slate-500">${rows.length} modelos · USD/request (default profile 1000/500 tokens)</span>
      </div>
      <div class="space-y-2.5" data-test="pricing-bars">
        ${body}
      </div>
      <p class="mt-3 text-[11px] text-slate-500">
        Colores desde <code>tokens.css</code> (--pricing-tier-{high,balanced,budget});
        fallback a Tailwind cuando el token no está definido. Formato USD con ${COST_DECIMALS} decimales.
      </p>
    </div>`;

  return { bars: rows.length, maxCost, minCost };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  _resetTokenCache();
}
