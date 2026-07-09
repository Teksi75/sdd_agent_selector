// js/components/cli-mirror-table.js
// Phase 2e — cli-mirror-table: 18-agent table with assigned model + role.
//
// Contract (per spec.md "UI Component - CLI Mirror Table" +
//   design.md "Components — cli-mirror-table"):
//   render(targetEl, agentsAssignments, agentRoles)
//     - targetEl: HTMLElement to mount into (caller supplies; the function
//         does not look it up by id so it stays pure / testable).
//     - agentsAssignments: { [agent]: BestForResult } from getBestFor.
//         Each entry has either { key, model, score, cost, ... } or
//         { key: null, reason } when no model qualifies.
//     - agentRoles: { [agent]: { minReasoning, costRatio, role } } — the
//         role matrix entry (data/agent-roles.json's `roles` block).
//     - returns: { rows: number, withAssignment: number, withoutAssignment: number }
//
// The 18 agents are sorted in the canonical order from spec.md
// (11 SDD + 3 JD + 4 Review). A null assignment renders a warning cell
// ("Sin modelo elegible") matching the workflow-table convention.
//
// Tier-based colors come from tokens.css (--cli-tier-{high,balanced,budget})
// with a Tailwind fallback so the table renders correctly before tokens.css
// ships. No global side effects.

/** Canonical 18-agent order. MUST match spec.md / role-matrix-completeness. */
const CANONICAL_ORDER = Object.freeze([
  // 11 SDD
  'gentle-orchestrator', 'sdd-init', 'sdd-explore', 'sdd-propose', 'sdd-spec',
  'sdd-design', 'sdd-tasks', 'sdd-apply', 'sdd-verify', 'sdd-archive', 'sdd-onboard',
  // 3 JD
  'jd-judge-a', 'jd-judge-b', 'jd-fix-agent',
  // 4 Review
  'review-risk', 'review-readability', 'review-reliability', 'review-resilience',
]);

/** Minimal HTML escaper. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

/** Resolve the tier → CSS token slug (same naming as workflow-table). */
function tierSlug(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'budget';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

/** Resolve the tier → badge label. */
function tierLabel(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'min';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

/**
 * Read `--cli-tier-{slug}` from the document, fall back to ''. Used so the
 * tag color follows tokens.css when present; Tailwind handles the fallback.
 *
 * @param {Document} doc
 * @param {'high'|'balanced'|'budget'|'reference'} slug
 * @returns {string}
 */
function tokenColor(doc, slug) {
  try {
    const root = doc.documentElement ?? doc.body ?? null;
    if (!root) return '';
    const v = getComputedStyle(root).getPropertyValue(`--cli-tier-${slug}`);
    return v ? v.trim() : '';
  } catch {
    return '';
  }
}

/** Tailwind fallback class per tier. */
function twClassFor(slug) {
  return slug === 'high' ? 'bg-emerald-500/80'
    : slug === 'budget' ? 'bg-amber-500/80'
    : slug === 'reference' ? 'bg-rose-500/80'
    : 'bg-indigo-500/80';
}

/**
 * Build the small "soft" badge for assignments that fell back to the best
 * cost-clearing model because the reasoning floor was unreachable.
 *
 * @param {string} reason - the getBestFor reason string (shown in `title`)
 * @returns {string} HTML
 */
function softBadge(reason) {
  const title = reason ? ` title="${esc(reason)}"` : '';
  return `<span class="text-[10px] uppercase tracking-wider font-semibold text-amber-300" data-soft-fallback="true"${title}>soft</span>`;
}

/**
 * Build the model-name + tier-tag cell HTML for the `assigned` column.
 *
 * @param {Object|null} assignment
 * @param {Document} doc
 * @returns {string}
 */
function assignedCell(assignment, doc) {
  if (!assignment || !assignment.key) {
    return `<span class="warn-row inline-flex items-center gap-1.5 text-amber-300">
      <span aria-hidden="true">⚠</span>
      <span>Sin modelo elegible</span>
    </span>`;
  }
  const m = assignment.model || {};
  const slug = tierSlug(m.tier);
  const label = tierLabel(m.tier);
  const bg = tokenColor(doc, slug);
  const styleAttr = bg ? ` style="background-color:${esc(bg)}"` : '';
  const cls = bg ? 'tier-tag' : `tier-tag ${twClassFor(slug)}`;
  const soft = assignment.softFallback ? softBadge(assignment.reason) : '';
  return `<span class="inline-flex items-center gap-2">
    <span class="font-medium">${esc(m.name || assignment.key)}</span>
    <span class="${cls}" data-tier="${esc(slug)}"${styleAttr}>${esc(label)}</span>
    ${soft}
  </span>`;
}

/**
 * Render the 18-agent CLI-mirror table into `targetEl`. Pure render — does
 * not look up DOM by id, fetch, or mutate globals.
 *
 * @param {HTMLElement} targetEl
 * @param {Object<string, Object>} agentsAssignments - keyed by agent id
 * @param {Object<string, {minReasoning:number, costRatio:number, role:string}>} agentRoles
 * @returns {{ rows: number, withAssignment: number, withoutAssignment: number }}
 */
export function render(targetEl, agentsAssignments, agentRoles) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('cli-mirror-table.render: targetEl must be an HTMLElement');
  }
  if (!agentRoles || typeof agentRoles !== 'object') {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">
        No hay role matrix para mostrar.
      </div>`;
    return { rows: 0, withAssignment: 0, withoutAssignment: 0 };
  }

  // Order: canonical 18 first, then any extra agents that exist in the role
  // matrix but are not in the canonical list (defensive — shouldn't happen,
  // but keeps the function resilient if the matrix ever drifts).
  const ordered = [...CANONICAL_ORDER];
  for (const k of Object.keys(agentRoles)) {
    if (!ordered.includes(k)) ordered.push(k);
  }

  const safeAssignments = agentsAssignments || {};
  const doc = targetEl.ownerDocument ?? document;
  let withA = 0;
  let withoutA = 0;

  const body = ordered
    .filter((agent) => Object.prototype.hasOwnProperty.call(agentRoles, agent))
    .map((agent) => {
      const role = agentRoles[agent] || {};
      const a = safeAssignments[agent];
      const hasKey = !!(a && a.key);
      if (hasKey) withA++; else withoutA++;
      const roleDesc = role.role || '—';
      return `
        <tr class="hover:bg-slate-800/30 transition" data-agent="${esc(agent)}" data-has-assignment="${hasKey}">
          <td class="py-2 px-3 font-mono text-xs text-slate-300">${esc(agent)}</td>
          <td class="py-2 px-3 text-xs text-slate-400">${esc(roleDesc)}</td>
          <td class="py-2 px-3 text-right">${assignedCell(a, doc)}</td>
        </tr>`;
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <table class="w-full text-left text-sm text-slate-200">
        <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th class="py-2 px-3 font-semibold">Agent</th>
            <th class="py-2 px-3 font-semibold">Role</th>
            <th class="py-2 px-3 font-semibold text-right">Modelo asignado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${body}
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-slate-500">
      ${withA}/18 agentes con modelo asignado · colores desde <code>tokens.css</code>.
    </p>`;

  return { rows: ordered.length, withAssignment: withA, withoutAssignment: withoutA };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state — placeholder for parity with other components */
}