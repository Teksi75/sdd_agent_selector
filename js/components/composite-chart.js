// js/components/composite-chart.js
// PR3 (benchlm-replace-custom-scoring) — composite-chart renders
// `benchlm.{score, verified, reliability}` per spec benchlm-rendering.
//
// Public API:
//   render(targetEl, models, _meta?)
//     models: Object<string, Model>  keyed by model id
//     _meta:  Object                  optional models.json _meta block
//                                       (used for BenchLM freshness badge)
//   resetForTests()                   — clears module-level cache
//
// Behavior (spec benchlm-rendering + design "Chart Rendering"):
//   - Reference-tier models (tier==='reference' OR isReference===true)
//     are INCLUDED with a rose-colored bar (--composite-tier-reference).
//   - Each row carries:
//     * a bar fill (width = score / maxScore %) inside a track
//     * a verified/estimated badge (verified=true → green, false → amber)
//     * a 5-dot reliability scale (`floor(reliability*5)` filled dots)
//   - Models with `compositeScore === null` render as an "unavailable"
//     placeholder row (NO bar fill, full-width text "unavailable",
//     data-unavailable="true"). Null rows append AFTER all scored rows.
//   - Sort: scored descending by benchlm.score; tie-break cheaper input
//     price. Unavailable rows appended last (preserves the descending
//     ordering of the scored pool).
//   - Freshness: when _meta.scrapers.benchlm.lastRun is older than 7 days,
//     render a "BenchLM stale" amber badge above the bars. When fresh (or
//     metadata absent), the badge is omitted.

import { compositeScore, isActive } from '../services/model-scorer.js';

const COMPOSITE_REFERENCE_ALLOWLIST = new Set(['gpt56sol', 'gpt56terra', 'gpt56luna']);

const _tokenCache = Object.create(null);
const STALE_THRESHOLD_DAYS = 7;

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
 * @param {'high'|'balanced'|'budget'|'reference'} tier
 * @returns {{ value: string, tw: string }} `value` is the resolved CSS
 *   color (or '' when absent); `tw` is the Tailwind class used as fallback.
 */
function barColor(doc, tier) {
  const slug = tier === 'high' ? 'high' : tier === 'budget' ? 'budget' : tier === 'reference' ? 'reference' : 'balanced';
  const twClass =
    tier === 'high' ? 'bg-emerald-500' :
    tier === 'budget' ? 'bg-amber-500' :
    tier === 'reference' ? 'bg-rose-500/80' :
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
 * field is missing or unrecognized. Reference-tier models are returned
 * as 'reference' so the bar color and data-tier attribute reflect it.
 *
 * @param {Object} m
 * @returns {'high'|'balanced'|'budget'|'reference'}
 */
function tierOf(m) {
  const t = m && m.tier;
  if (t === 'high' || t === 'balanced' || t === 'budget' || t === 'reference') return t;
  return 'balanced';
}

/**
 * Partition all models into scored and unavailable groups.
 *
 * Active models participate directly. Non-active models in the
 * COMPOSITE_REFERENCE_ALLOWLIST are also included as scored rows
 * (so specific reference models can appear in the main ranking for
 * comparison). All other non-active models are excluded entirely.
 *
 * Scored sorted descending (cheaper input tie-break).
 * Unavailable appended after scored.
 *
 * @param {Object<string, Object>} models
 * @returns {{ scored: Array, unavailable: Array }}
 */
function rowsFor(models) {
  const entries = Object.entries(models || {}).filter(([, m]) => m);

  const scored = [];
  const unavailable = [];
  for (const [k, m] of entries) {
    const allowlisted = COMPOSITE_REFERENCE_ALLOWLIST.has(k);
    if (!isActive(m) && !allowlisted) {
      continue;
    }
    const score = compositeScore(m);
    if (score == null || !Number.isFinite(score)) {
      unavailable.push([k, m]);
    } else {
      scored.push([k, m, score]);
    }
  }
  scored.sort((a, b) => {
    if (b[2] !== a[2]) return b[2] - a[2];
    const ca = Number.isFinite(a[1]?.input) ? a[1].input : Infinity;
    const cb = Number.isFinite(b[1]?.input) ? b[1].input : Infinity;
    return ca - cb;
  });
  return { scored, unavailable };
}

/**
 * Compute the CSS width% for a bar. Anchored to the best (top)
 * scored row in the rendered set. Floor at MIN_PCT so a zero-scoring
 * model (rare on a real chart but possible in fixtures) still shows
 * a sliver.
 *
 * @param {number} score
 * @param {number} maxScore
 * @returns {number} [MIN_PCT, 100] rounded to 1 decimal.
 */
function widthPct(score, maxScore) {
  const MIN_PCT = 4;
  if (!Number.isFinite(maxScore) || maxScore <= 0) return MIN_PCT;
  const raw = (score / maxScore) * 100;
  const clamped = Math.max(MIN_PCT, Math.min(100, raw));
  return Math.round(clamped * 10) / 10;
}

/**
 * Build the verified/estimated badge HTML. The badge color is
 * green (emerald) when verified=true, amber when verified=false.
 *
 * @param {{verified?: boolean}} benchlm
 * @returns {string} HTML
 */
function badgeHtml(benchlm) {
  const verified = !!(benchlm && benchlm.verified);
  const cls = verified
    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  const label = verified ? 'verified' : 'estimated';
  return `<span class="${cls} px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" data-badge="${label}">${label}</span>`;
}

/**
 * Render the 5-dot reliability scale. `floor(reliability * 5)`
 * filled dots out of 5 total.
 *
 * @param {number} reliability - [0, 1]
 * @returns {string} HTML
 */
function reliabilityDotsHtml(reliability) {
  const r = Number.isFinite(reliability) ? Math.max(0, Math.min(1, reliability)) : 0;
  const filled = Math.min(5, Math.floor(r * 5));
  const empty = 5 - filled;
  let html = `<span data-reliability-dots data-reliability="${r.toFixed(2)}" class="inline-flex gap-0.5 ml-1.5 align-middle" aria-label="reliability ${(filled / 5 * 100).toFixed(0)}%">`;
  for (let i = 0; i < filled; i++) {
    html += `<span data-dot="filled" class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>`;
  }
  for (let i = 0; i < empty; i++) {
    html += `<span data-dot="empty" class="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block"></span>`;
  }
  html += `</span>`;
  return html;
}

/** Build one SCORED row's HTML. */
function barRowHtml(key, m, score, width, bgClass, bgValue) {
  const newBadge =
    m.isNew === true
      ? ' <span class="src-badge src-new ml-1">NEW</span>'
      : '';
  const tierLabel = esc(tierOf(m));
  const fillStyle = bgValue ? ` style="width:${width}%;background-color:${esc(bgValue)}"` : ` style="width:${width}%"`;
  const fillClass = bgValue ? 'bar-fill' : `bar-fill ${bgClass}`;
  const badge = badgeHtml(m.benchlm);
  const dots = reliabilityDotsHtml(m.benchlm?.reliability);
  const verifiedAttr = m.benchlm?.verified === true ? 'true' : 'false';
  const reliabilityAttr = Number.isFinite(m.benchlm?.reliability)
    ? m.benchlm.reliability.toFixed(2)
    : '0';
  return `
    <div class="flex items-center gap-3" data-model-key="${esc(key)}" data-score="${score.toFixed(2)}" data-width="${width}" data-tier="${tierLabel}" data-verified="${verifiedAttr}" data-reliability="${reliabilityAttr}">
      <div class="w-32 md:w-40 text-xs font-medium text-slate-200 truncate">${esc(m.name || key)}${newBadge}</div>
      <div class="flex items-center gap-2">${badge}${dots}</div>
      <div class="flex-1 bar-track rounded-full bg-slate-800/60 overflow-hidden h-3">
        <div class="${fillClass} h-3 rounded-full"${fillStyle}></div>
      </div>
      <div class="w-14 text-right text-xs font-mono text-emerald-300">${score.toFixed(1)}</div>
    </div>`;
}

/** Build one UNAVAILABLE row's HTML. NO bar fill, "unavailable" label. */
function unavailableRowHtml(key, m) {
  return `
    <div class="flex items-center gap-3 opacity-60" data-model-key="${esc(key)}" data-unavailable="true" data-score="0">
      <div class="w-32 md:w-40 text-xs font-medium text-slate-400 truncate">${esc(m.name || key)}</div>
      <div class="flex-1 bar-track rounded-full bg-slate-800/40 overflow-hidden h-3">
        <span class="text-[10px] uppercase tracking-wider text-slate-500 pl-2 leading-3" data-test="unavailable-label">— unavailable —</span>
      </div>
      <div class="w-14 text-right text-xs font-mono text-slate-500">—</div>
    </div>`;
}

/**
 * Compute days since `lastRun` ISO string. Returns Infinity when
 * the timestamp is missing or unparseable (treat as "we don't know
 * how stale it is, so don't show the warning").
 *
 * @param {string|undefined|null} lastRun
 * @param {Date} [now]
 * @returns {number}
 */
function daysSince(lastRun, now = new Date()) {
  if (!lastRun || typeof lastRun !== 'string') return Infinity;
  const t = Date.parse(lastRun);
  if (!Number.isFinite(t)) return Infinity;
  const diffMs = now.getTime() - t;
  return diffMs / (24 * 60 * 60 * 1000);
}

/**
 * Decide whether the BenchLM freshness badge should appear.
 *
 * @param {Object} meta
 * @param {Date} [now]
 * @returns {boolean}
 */
function isBenchlmStale(meta, now = new Date()) {
  if (!meta || typeof meta !== 'object') return false;
  const scrapers = meta.scrapers;
  if (!scrapers || typeof scrapers !== 'object') return false;
  const benchlm = scrapers.benchlm;
  if (!benchlm || typeof benchlm !== 'string' && typeof benchlm !== 'object') return false;
  const lastRun = typeof benchlm === 'string' ? benchlm : benchlm.lastRun;
  const days = daysSince(lastRun, now);
  if (!Number.isFinite(days)) return false;
  return days > STALE_THRESHOLD_DAYS;
}

/**
 * Build the freshness badge HTML or empty string.
 *
 * @param {Object} meta
 * @param {Date} [now]
 * @returns {string}
 */
function staleBadgeHtml(meta, now = new Date()) {
  if (!isBenchlmStale(meta, now)) return '';
  return `<div data-test="benchlm-stale" role="status" class="text-[11px] text-amber-300 mb-3 rounded-md border border-amber-700 bg-amber-900/30 px-2 py-1 inline-flex items-center gap-1.5"><span aria-hidden="true">⚠</span><span>BenchLM data is stale (&gt; ${STALE_THRESHOLD_DAYS} days); scores may be outdated.</span></div>`;
}

/**
 * Render the composite-score bar chart into `targetEl`. Pure render.
 *
 * @param {HTMLElement} targetEl - mount point
 * @param {Object<string, Object>} models - keyed by model id
 * @param {Object} [_meta] - optional data/models.json _meta block; used
 *                            for the BenchLM freshness badge.
 * @returns {{ scored: number, unavailable: number, maxScore: number|null }}
 */
export function render(targetEl, models, _meta) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('composite-chart.render: targetEl must be an HTMLElement');
  }
  if (!models || typeof models !== 'object') {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay datos de modelos para graficar.
      </div>`;
    return { scored: 0, unavailable: 0, maxScore: null };
  }

  const { scored, unavailable } = rowsFor(models);
  if (scored.length === 0 && unavailable.length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay modelos activos para mostrar.
      </div>`;
    return { scored: 0, unavailable: 0, maxScore: null };
  }

  const maxScore = scored.length > 0 ? scored[0][2] : null;
  const doc = targetEl.ownerDocument ?? document;
  const scoredBody = scored
    .map(([key, m, score]) => {
      const { value: bgValue, tw: twClass } = barColor(doc, tierOf(m));
      const width = widthPct(score, maxScore);
      return barRowHtml(key, m, score, width, twClass, bgValue);
    })
    .join('');
  const unavailableBody = unavailable
    .map(([key, m]) => unavailableRowHtml(key, m))
    .join('');

  const stale = staleBadgeHtml(_meta);

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-200">Composite benchmark</h3>
        <span class="text-[11px] text-slate-500">${scored.length + unavailable.length} models · BenchLM (0-100)</span>
      </div>
      ${stale}
      <div class="space-y-2.5" data-test="composite-bars">
        ${scoredBody}${unavailableBody}
      </div>
      <p class="mt-3 text-[11px] text-slate-500">
        Scores y badges vienen de BenchLM (<code>benchlm</code> con score/verified/reliability);
        fallback a Tailwind cuando el token no está definido.
      </p>
    </div>`;

  return { scored: scored.length, unavailable: unavailable.length, maxScore };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  _resetTokenCache();
}
