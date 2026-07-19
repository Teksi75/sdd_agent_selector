// js/components/model-card.js
// PR3 (benchlm-replace-custom-scoring) — model-card cutover.
//
// Contract:
//   render(targetEl, model) / buildCard(model)
//     - targetEl: HTMLElement to mount into. If null, the function is a
//         pure string-builder and returns just the HTML.
//     - model:   { name, tier, benchlm, input, output, ... }
//                 (any model record shape). Missing BenchLM data renders
//                 as an "unavailable" placeholder.
//     - returns: { html: string } when targetEl is null,
//                { html: string, mounted: true } when targetEl is provided.
//
// The card carries:
//   - a name row with a tier badge (tier-tag) and a NEW badge when isNew=true
//   - ONE BenchLM score row: numeric score (1 decimal) + verified/estimated
//     badge + 5-dot reliability scale (floor(reliability*5) filled)
//   - an "unavailable" placeholder row when benchlm.score is missing/null
//     (fail-soft per spec benchlm-fail-soft)
//   - the price row (input/output) unchanged from Phase 2e
//
// The legacy 4-column arena/swePro/sweVer/term grid is REMOVED. BenchLM
// is the single source of truth for benchmark context (per design
// benchlm-data-model).

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

/** Render the verified/estimated badge HTML. */
function benchlmBadgeHtml(benchlm) {
  const verified = !!(benchlm && benchlm.verified);
  const cls = verified
    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  const label = verified ? 'verified' : 'estimated';
  return `<span data-badge="${label}" class="${cls} px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">${label}</span>`;
}

/** Render the 5-dot reliability scale. floor(reliability*5) filled dots. */
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

/** Build the BenchLM metric row. Returns one of two shapes:
 *   - scored: data-score=NN.NN, badge + dots
 *   - placeholder: "unavailable" label, no numeric score, no badge
 */
function benchlmRowHtml(benchlm) {
  if (benchlm == null) {
    return `
      <div class="flex items-center gap-2 text-[11px] text-slate-300" data-benchlm-row="unavailable">
        <span class="text-slate-500 font-semibold uppercase tracking-wider">BenchLM</span>
        <span data-test="unavailable-label" class="text-slate-500">— unavailable —</span>
      </div>`;
  }
  const score = benchlm.score;
  if (score == null || !Number.isFinite(score)) {
    // Null/NaN → placeholder, no badge, no dots.
    return `
      <div class="flex items-center gap-2 text-[11px] text-slate-300" data-benchlm-row="unavailable" data-score="0">
        <span class="text-slate-500 font-semibold uppercase tracking-wider">BenchLM</span>
        <span data-test="unavailable-label" class="text-slate-500">— unavailable —</span>
      </div>`;
  }
  const badge = benchlmBadgeHtml(benchlm);
  const dots = reliabilityDotsHtml(benchlm.reliability);
  return `
    <div class="flex items-center gap-2 text-[11px] text-slate-300" data-benchlm-row="scored" data-score="${Number(score).toFixed(2)}" data-verified="${!!benchlm.verified}" data-reliability="${Number.isFinite(benchlm.reliability) ? Number(benchlm.reliability).toFixed(2) : '0'}">
      <span class="text-slate-500 font-semibold uppercase tracking-wider">BenchLM</span>
      <span class="font-mono text-emerald-300">${Number(score).toFixed(1)}</span>
      ${badge}${dots}
    </div>`;
}

/** Format a USD price; null/undefined/non-finite → '—'. */
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
  const benchlmRow = benchlmRowHtml(model.benchlm);
  return `
    <div class="model-card" data-model-key="${esc(model.key || '')}" data-tier="${esc(tier)}">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <span class="text-sm font-semibold text-slate-100 truncate">${esc(model.name || model.key || '—')}${newBadge}</span>
        <span class="model-tier-tag" data-tier="${esc(tier)}">${esc(label)}</span>
      </div>
      ${benchlmRow}
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
