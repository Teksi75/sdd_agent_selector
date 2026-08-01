// js/components/hero-stats.js
// P2-5 — micro-stats en el hero de la página.
//
// Qué muestra:
//   "24 modelos activos · 2 reference · 18 agentes (11 SDD + 3 JD + 4 Review)"
//   "· sync 2026-07-26" (lastSynced del _meta)
//
// Por qué existe:
//   Antes el hero solo tenía el título + un párrafo lede. Un usuario que
//   aterriza por primera vez no tenía idea del tamaño del catálogo ni de
//   la composición de los 18 agentes. Los micro-stats dan la respuesta
//   sin que el usuario tenga que scrollear a la tabla de referencia.
//
// API:
//   render(mountEl, data, options?) — paints the stats line into mountEl
//   resetForTests()                  — module-level state, jsdom isolation
//
// Public shape: same conventions as the other components (data injection
// via parameters, no module-level caches).

import { lifecycleOf } from '../services/model-scorer.js';

/**
 * Count models by lifecycle category. The `reference` count is the
 * anchor models (used as cost ceiling references); `active` is the
 * pool the assignment algorithm actually considers.
 *
 * @param {Object} models - { [id]: Model }
 * @returns {{ active: number, reference: number, legacy: number, total: number }}
 */
export function countModelsByLifecycle(models) {
  const counts = { active: 0, reference: 0, legacy: 0, total: 0 };
  for (const m of Object.values(models || {})) {
    if (!m || typeof m !== 'object') continue;
    counts.total += 1;
    const lc = lifecycleOf(m);
    if (lc === 'active') counts.active += 1;
    else if (lc === 'reference') counts.reference += 1;
    else if (lc === 'legacy') counts.legacy += 1;
    // benchmark-only and other values count toward total but not the
    // headline buckets (rare in the catalog — kept out of the copy).
  }
  return counts;
}

/**
 * Break the 18 agents into their SDD / JD / Review buckets. The split
 * is by id prefix (sdd-, jd-, review-) and matches the 11/3/4 split
 * documented in data/agent-roles.json.
 *
 * @param {Object} roleMatrix - { [agentId]: Role }
 * @returns {{ sdd: number, jd: number, review: number, total: number }}
 */
export function countAgentsByFamily(roleMatrix) {
  const counts = { sdd: 0, jd: 0, review: 0, total: 0 };
  for (const id of Object.keys(roleMatrix || {})) {
    counts.total += 1;
    if (id.startsWith('sdd-')) counts.sdd += 1;
    else if (id.startsWith('jd-')) counts.jd += 1;
    else if (id.startsWith('review-')) counts.review += 1;
  }
  return counts;
}

/**
 * Build the headline string. Pulled out of render() so it's testable
 * without touching the DOM.
 *
 * V5+ KI-P0-2: the data contract uses `data.roles` (set by
 * data-loader's composed payload). `data.roleMatrix` is a legacy/local-
 * fallback name kept around in case a future refactor renames it back.
 * The dual-key resolution `data?.roles ?? data?.roleMatrix` prefers
 * `roles` (the live data-loader key) and only falls back to `roleMatrix`
 * when `roles` is absent — so a future rename of either side breaks the
 * build instead of breaking the live page.
 *
 * @param {Object} data - { models, roleMatrix?, roles?, _meta? }
 * @returns {string}
 */
export function buildStatsLine(data) {
  const m = countModelsByLifecycle(data?.models);
  // V5+ KI-P0-2: resolve the role-matrix key. data-loader.js uses
  // `roles`; the legacy name was `roleMatrix`. Prefer `roles` (the
  // live contract) and only fall back to `roleMatrix` when absent.
  const roleMatrix = data?.roles ?? data?.roleMatrix;
  const a = countAgentsByFamily(roleMatrix);
  // P2-5 copy: "24 activos · 2 reference · 18 agentes (11 SDD + 3 JD + 4 Review)"
  // Legacy count is mentioned only when non-zero — keeps the line clean
  // for the common case (24/2/18 today).
  const modelPart =
    `${m.active} activos` +
    (m.reference > 0 ? ` · ${m.reference} reference` : '') +
    (m.legacy > 0 ? ` · ${m.legacy} legacy` : '');
  const agentPart =
    `${a.total} agentes (${a.sdd} SDD + ${a.jd} JD + ${a.review} review)`;
  return `${modelPart} · ${agentPart}`;
}

/**
 * Render the micro-stats line into `targetEl`. Safe to call multiple
 * times; overwrites the previous content.
 *
 * V5+ KI-P0-2: same dual-key tolerance as buildStatsLine — accepts
 * `data.roleMatrix` OR `data.roles`. Without this fix, the live page
 * shows "0 agentes (0 SDD + 0 JD + 0 review)" because the loader
 * composes the payload under the key `roles` (PR #46 regression).
 *
 * @param {HTMLElement|null} targetEl
 * @param {Object} data - { models, roleMatrix?, roles?, _meta? }
 * @param {{ now?: Date|string }} [options]
 * @returns {{ html: string, mounted: boolean, modelCounts: object, agentCounts: object }}
 */
export function render(targetEl, data, options) {
  const modelCounts = countModelsByLifecycle(data?.models);
  const roleMatrix = data?.roles ?? data?.roleMatrix;
  const agentCounts = countAgentsByFamily(roleMatrix);
  const html = `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400" data-test="hero-stats">
      <span class="flex items-center gap-1.5" data-test="hero-stats-models">
        <span class="font-mono text-slate-200">${modelCounts.active}</span>
        <span>activos</span>
        ${
          modelCounts.reference > 0
            ? `<span class="text-slate-600">·</span>
               <span class="font-mono text-rose-300">${modelCounts.reference}</span>
               <span>reference</span>`
            : ''
        }
        ${
          modelCounts.legacy > 0
            ? `<span class="text-slate-600">·</span>
               <span class="font-mono text-slate-500">${modelCounts.legacy}</span>
               <span>legacy</span>`
            : ''
        }
        <span class="text-slate-600">·</span>
        <span class="font-mono text-slate-200">${agentCounts.total}</span>
        <span>agentes</span>
        <span class="text-slate-600">(</span>
        <span class="font-mono text-slate-300">${agentCounts.sdd}</span>
        <span>SDD</span>
        <span class="text-slate-600">+</span>
        <span class="font-mono text-slate-300">${agentCounts.jd}</span>
        <span>JD</span>
        <span class="text-slate-600">+</span>
        <span class="font-mono text-slate-300">${agentCounts.review}</span>
        <span>review</span>
        <span class="text-slate-600">)</span>
      </span>
    </div>
  `;
  const out = { html, mounted: false, modelCounts, agentCounts };
  if (targetEl && typeof targetEl.innerHTML === 'string') {
    targetEl.innerHTML = html;
    out.mounted = true;
  }
  return out;
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state */
}
