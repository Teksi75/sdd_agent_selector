// js/components/model-card.js
// Phase 2e — reusable model card. Used by cli-mirror-table (assigned-model
// cell) and by justification-ui (per-agent assigned-model block). Always
// pure: render() takes a targetEl and a model record, returns a summary.
//
// Contract (per design.md "Components — model-card"):
//   render(targetEl, model)
//     - targetEl: HTMLElement to mount into. If null, the function is a
//         pure string-builder and returns just the HTML.
//     - model:   { name, tier, arena, swePro, sweVer, term, input, output, ... }
//                 (any model record shape). Missing fields render as "—".
//     - returns: { html: string } when targetEl is null,
//                { html: string, mounted: true } when targetEl is provided.
//
// The card is intentionally compact: a name row with a tier badge, then a
// 4-column metric row (arena / swePro / sweVer / term) and a price row (input /
// output). Tokens.css may provide a --model-tier-{high,balanced,budget}
// color; falls back to Tailwind when absent.

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/** Pick the tier slug for the badge. Defaults to 'balanced'. */
function tierSlug(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'budget';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

/** Tier badge label (Spanish, short). */
function tierLabel(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'min';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

/** Format a numeric score; null/undefined → '—'. */
function fmtScore(v) {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '—';
  return typeof v === 'number' && v >= 100 ? String(Math.round(v)) : v.toFixed(1);
}

/**
 * Format a percentage cell: numeric value gets one decimal + '%', null /
 * undefined / non-finite renders exactly '—' (never '—%').
 *
 * @param {number|null|undefined} v
 * @returns {string}
 */
function fmtPct(v) {
  const score = fmtScore(v);
  return score === '—' ? score : `${score}%`;
}

/** Format a USD price; null/undefined → '—'. */
function fmtPrice(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
}

/**
 * Build the HTML string for a single model card.
 * @param {Object} model
 * @returns {string}
 */
export function buildCard(model) {
  if (!model || typeof model !== 'object') {
    return `<div class="model-card empty" data-empty="true">—</div>`;
  }
  const tier = tierSlug(model.tier);
  const label = tierLabel(model.tier);
  const newBadge = model.isNew === true
    ? ' <span class="src-badge src-new">NEW</span>'
    : '';
  return `
    <div class="model-card" data-model-key="${esc(model.key || '')}" data-tier="${esc(tier)}">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <span class="text-sm font-semibold text-slate-100 truncate">${esc(model.name || model.key || '—')}${newBadge}</span>
        <span class="model-tier-tag" data-tier="${esc(tier)}">${esc(label)}</span>
      </div>
      <div class="grid grid-cols-4 gap-2 text-[11px] text-slate-300">
        <div><span class="text-slate-500">Arena</span><br /><span class="font-mono">${fmtScore(model.arena)}</span></div>
        <div><span class="text-slate-500">SWE-Pro</span><br /><span class="font-mono">${fmtPct(model.swePro)}</span></div>
        <div><span class="text-slate-500">SWE-Ver</span><br /><span class="font-mono">${fmtPct(model.sweVer)}</span></div>
        <div><span class="text-slate-500">Term</span><br /><span class="font-mono">${fmtPct(model.term)}</span></div>
      </div>
      <div class="flex gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
        <span>In ${fmtPrice(model.input)}</span>
        <span>Out ${fmtPrice(model.output)}</span>
      </div>
    </div>`;
}

/**
 * Render a single model card. When `targetEl` is provided, mount the
 * card into it; otherwise return the HTML as a string for callers that
 * compose multiple cards (e.g., cli-mirror-table).
 *
 * @param {HTMLElement|null} targetEl
 * @param {Object} model
 * @returns {{ html: string, mounted: boolean }}
 */
export function render(targetEl, model) {
  const html = buildCard(model);
  if (targetEl && typeof targetEl.innerHTML === 'string') {
    targetEl.innerHTML = html;
    return { html, mounted: true };
  }
  return { html, mounted: false };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state — placeholder for parity with other components */
}