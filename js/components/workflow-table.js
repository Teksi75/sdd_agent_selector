// js/components/workflow-table.js
// Phase 2b — workflow-table: 9 core SDD phases with the model assigned
// for the active config.
//
// Public API (per spec.md "UI Component - Workflow Table" +
//   design.md "Components — workflow-table"):
//     render(targetEl, assignments, models, phases)
//     resetForTests() — clears module state between jsdom tests
//
// `assignments` is the result of getBestFor for the 9 SDD phases
// (sdd-init through sdd-archive), keyed by phase id. `phases` is the
// ordered array from data/phases.json (9 entries). `models` is the
// keyed record from data/models.json (used to resolve model name + tier).
//
// Tier → tag mapping (per task spec):
//   high     → "max"      (amber)    ← var(--tag-max-bg)
//   balanced → "balanced"            ← var(--tag-balanced-bg)
//   budget   → "min"      (emerald)  ← var(--tag-min-bg)
// A null assignment renders a warning icon + "Sin modelo elegible".

// Module-level state. Trivial — only used so tests can confirm re-render.
let _lastTarget = null;

export function resetForTests() {
  _lastTarget = null;
}

/**
 * Resolve the background color for a tier tag from the CSS tokens layer.
 * Falls back to neutral slate when the token is undefined (e.g., tests
 *   without a tokens stylesheet).
 *
 * @param {Document} doc
 * @param {'high'|'balanced'|'budget'} tier
 * @returns {string} CSS background-color value or '' when absent
 */
function tokenBg(doc, tier) {
  const slug = tier === 'high' ? 'max' : tier === 'budget' ? 'min' : 'balanced';
  try {
    const root = doc.documentElement ?? doc.body ?? null;
    if (!root) return '';
    const cssVar = getComputedStyle(root).getPropertyValue(`--tag-${slug}-bg`);
    return cssVar ? cssVar.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Pick the tag slug + label for a tier.
 * @param {'high'|'balanced'|'budget'|undefined} tier
 * @returns {{ slug: string, label: string }}
 */
function tagFor(tier) {
  if (tier === 'high') return { slug: 'max', label: 'max' };
  if (tier === 'budget') return { slug: 'min', label: 'min' };
  return { slug: 'balanced', label: 'balanced' };
}

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/**
 * Build one row's model cell. Tier → tag color via tokens; null → warning.
 * @param {{key: string|null, model?: Object}|null|undefined} assignment
 * @param {Object<string, Object>} models
 * @returns {string} HTML
 */
function modelCell(assignment, models) {
  if (!assignment || !assignment.key || !models[assignment.key]) {
    return `<span class="warn-row inline-flex items-center gap-1.5 text-amber-300">
      <span aria-hidden="true">⚠</span>
      <span>Sin modelo elegible</span>
    </span>`;
  }
  const m = models[assignment.key];
  const tier = m.tier || 'balanced';
  const { slug, label } = tagFor(tier);
  const bg = tokenBg(document, tier);
  const styleAttr = bg ? ` style="background-color:${esc(bg)}"` : '';
  return `<span class="inline-flex items-center gap-2">
    <span>${esc(m.name || assignment.key)}</span>
    <span class="tier-tag" data-tier="${esc(tier)}" data-slug="${esc(slug)}"${styleAttr}>${esc(label)}</span>
  </span>`;
}

/**
 * Render the workflow table into `targetEl`. Pure render — does not
 * fetch or mutate globals beyond the local _lastTarget.
 *
 * @param {HTMLElement} targetEl
 * @param {Object<string, Object>} assignments - keyed by phase id
 * @param {Object<string, Object>} models - keyed by model id
 * @param {Array<{id: string, name: string, desc: string}>} phases - 9 entries
 * @returns {{ rows: number }}
 */
export function render(targetEl, assignments, models, phases) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('workflow-table.render: targetEl must be an HTMLElement');
  }
  if (!Array.isArray(phases) || phases.length === 0) {
    targetEl.innerHTML = `<div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">No hay fases para mostrar.</div>`;
    _lastTarget = targetEl;
    return { rows: 0 };
  }
  const safeAssignments = assignments || {};
  const safeModels = models || {};

  const body = phases
    .map((phase) => {
      const a = safeAssignments[phase.id];
      return `
        <tr class="hover:bg-slate-800/30 transition" data-phase-id="${esc(phase.id)}">
          <td class="py-2.5 px-3 font-medium">${esc(phase.name || phase.id)}</td>
          <td class="py-2.5 px-3 text-slate-400 text-xs">${esc(phase.desc || '')}</td>
          <td class="py-2.5 px-3 text-right">${modelCell(a, safeModels)}</td>
        </tr>`;
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table class="w-full text-left text-sm text-slate-200">
        <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th class="py-2.5 px-3 font-semibold">Fase</th>
            <th class="py-2.5 px-3 font-semibold">Descripción</th>
            <th class="py-2.5 px-3 font-semibold text-right">Modelo</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${body}
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-slate-500">
      ${phases.length} fases SDD core · colores de tag desde <code>tokens.css</code>.
    </p>`;

  _lastTarget = targetEl;
  return { rows: phases.length };
}