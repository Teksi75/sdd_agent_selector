// js/components/task-cost-table.js
// Task cost table: per-agent cost of the assigned model computed with the
// agent's own request profile (data/agent-request-profiles.json).
//
// Contract:
//   render(targetEl, assignments, agentRoles, profiles, options?)
//     - targetEl: HTMLElement to mount into (caller supplies; pure/testable).
//     - assignments: { [agent]: { key, model, ... } | { key: null, reason } }
//         from getBestFor (same shape cli-mirror-table consumes).
//     - agentRoles: { [agent]: { minReasoning, costRatio, role } }.
//     - profiles: { [agent]: { inputTokens, outputTokens } }; agents without
//         a profile fall back to the default request profile (1000/500,
//         same default costEstimate uses).
//     - returns: { rows, withAssignment, withoutAssignment, totalCost }
//         where totalCost is the sum over assigned agents (workflow total).
//
// Rows follow the canonical 18-agent order (11 SDD + 3 JD + 4 Review);
// extra agents in the role matrix are appended defensively. Unassigned
// agents render the "Sin modelo elegible" warning and contribute 0.

import { costEstimate } from '../services/model-scorer.js';

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

/** Default request profile (mirrors costEstimate default). */
const DEFAULT_PROFILE = Object.freeze({ inputTokens: 1000, outputTokens: 500 });

/** Decimal places for the USD label (same convention as pricing-chart). */
const COST_DECIMALS = 6;

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

/** Effective profile for an agent (own profile or default fallback). */
function profileOf(agent, profiles) {
  const p = profiles ? profiles[agent] : undefined;
  const inputTokens = Number.isFinite(p?.inputTokens) ? p.inputTokens : DEFAULT_PROFILE.inputTokens;
  const outputTokens = Number.isFinite(p?.outputTokens) ? p.outputTokens : DEFAULT_PROFILE.outputTokens;
  return { inputTokens, outputTokens };
}

/** Render the cost-per-agent task table into `targetEl`. Pure render. */
export function render(targetEl, assignments, agentRoles, profiles, options) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('task-cost-table.render: targetEl must be an HTMLElement');
  }
  if (!agentRoles || typeof agentRoles !== 'object' || Object.keys(agentRoles).length === 0) {
    targetEl.innerHTML = `
      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400" data-test="empty-state">
        No hay agentes para mostrar.
      </div>`;
    return { rows: 0, withAssignment: 0, withoutAssignment: 0, totalCost: 0 };
  }

  // Order: canonical 18 first, then extras (same defensive rule as cli-mirror).
  const ordered = [...CANONICAL_ORDER];
  for (const k of Object.keys(agentRoles)) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  const agents = ordered.filter((a) => Object.prototype.hasOwnProperty.call(agentRoles, a));

  const safeAssignments = assignments || {};
  let withA = 0;
  let withoutA = 0;
  let totalCost = 0;

  const body = agents
    .map((agent) => {
      const a = safeAssignments[agent];
      const hasKey = !!(a && a.key && a.model);
      const profile = profileOf(agent, profiles);
      const profileLabel = `${profile.inputTokens}/${profile.outputTokens}`;
      if (!hasKey) {
        withoutA++;
        return `
          <tr class="hover:bg-slate-800/30 transition" data-agent="${esc(agent)}" data-has-assignment="false">
            <td class="py-2 px-3 font-mono text-xs text-slate-300">${esc(agent)}</td>
            <td class="py-2 px-3 font-mono text-xs text-slate-400">${esc(profileLabel)}</td>
            <td class="py-2 px-3 text-xs text-amber-300/90">Sin modelo elegible</td>
            <td class="py-2 px-3 text-xs font-mono text-slate-500 text-right">—</td>
          </tr>`;
      }
      withA++;
      const cost = costEstimate(a.model, profile);
      totalCost += cost;
      return `
        <tr class="hover:bg-slate-800/30 transition" data-agent="${esc(agent)}" data-has-assignment="true" data-cost="${cost.toFixed(COST_DECIMALS)}">
          <td class="py-2 px-3 font-mono text-xs text-slate-300">${esc(agent)}</td>
          <td class="py-2 px-3 font-mono text-xs text-slate-400">${esc(profileLabel)}</td>
          <td class="py-2 px-3 text-xs text-slate-200">${esc(a.model.name || a.key)}</td>
          <td class="py-2 px-3 text-xs font-mono text-emerald-300 text-right">${fmtCost(cost)}</td>
        </tr>`;
    })
    .join('');

  targetEl.innerHTML = `
    <div class="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800/60">
        <h3 class="text-sm font-semibold text-slate-200" data-test="task-cost-title">Costo por tarea (por agente)</h3>
        <span class="text-[11px] text-slate-500">${agents.length} agentes · USD/request con profile propio (in/out tokens)</span>
      </div>
      <table class="w-full text-left text-sm text-slate-200">
        <thead class="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            <th scope="col" class="py-2 px-3 font-semibold">Agente</th>
            <th scope="col" class="py-2 px-3 font-semibold">Profile</th>
            <th scope="col" class="py-2 px-3 font-semibold">Modelo asignado</th>
            <th scope="col" class="py-2 px-3 font-semibold text-right">Costo/request</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${body}
        </tbody>
      </table>
      <div class="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-800/60">
        <span class="text-[11px] text-slate-500">Total workflow (${withA} asignados)</span>
        <span class="text-xs font-mono text-emerald-300" data-test="task-cost-total">${fmtCost(totalCost)}</span>
      </div>
    </div>
    <p class="mt-3 text-xs text-slate-500">
      Costo = <code>costEstimate(modelo, profile del agente)</code> desde <code>agent-request-profiles.json</code>;
      sin profile se usa el default 1000/500. Sin modelo elegible no suma al total.
    </p>`;

  return { rows: agents.length, withAssignment: withA, withoutAssignment: withoutA, totalCost };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state — placeholder for parity with other components */
}
