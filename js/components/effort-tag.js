// js/components/effort-tag.js
// PR-B (effort-only UI) — shared effort renderer (design D4).
//
// One small pure module consumed by ref-table, model-card, cli-mirror-table
// and justification-ui. It centralizes the whole effort display contract:
//
//   - closed vocabulary: max | xhigh | high | medium | low | non-reasoning
//   - rioplatense labels already shipped by the four surfaces
//   - HTML escaping for the rendered value/label
//   - ZERO badge when the effort is missing or out of vocabulary — the
//     renderer never invents a label from the raw value
//   - `softFallback: true` suppresses the badge (the fallback surface shows
//     the model name only; the flag still travels in assignments/JSON)
//
// No DOM access, no module state: every export is a pure function.

/** Closed effort vocabulary (order = display priority when relevant). */
export const EFFORT_VOCABULARY = Object.freeze([
  'max',
  'xhigh',
  'high',
  'medium',
  'low',
  'non-reasoning',
]);

/** Rioplatense labels for the closed vocabulary. */
export const EFFORT_LABELS = Object.freeze({
  max: 'Máximo',
  xhigh: 'Extremo alto',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  'non-reasoning': 'Sin razonamiento',
});

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * True only for strings inside the closed vocabulary.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEffort(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EFFORT_LABELS, value);
}

/**
 * Resolve the label for a vocabulary value; `null` outside the vocabulary
 * (callers decide the placeholder — the helper never invents a label).
 *
 * @param {unknown} effort
 * @returns {string|null}
 */
export function effortLabel(effort) {
  return isEffort(effort) ? EFFORT_LABELS[effort] : null;
}

/**
 * Render the effort badge (`[data-effort]`) for a model variant.
 *
 * @param {unknown} effort
 * @param {{ softFallback?: boolean }} [options] - `softFallback: true`
 *   suppresses the badge so fallback assignments render the model name only.
 * @returns {string} HTML, or '' when no badge must be shown.
 */
export function effortTagHtml(effort, options) {
  const opts = options || {};
  if (opts.softFallback === true) return '';
  const label = effortLabel(effort);
  if (label == null) return '';
  return `<span class="src-badge src-effort bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" data-effort="${esc(effort)}">${esc(label)}</span>`;
}
