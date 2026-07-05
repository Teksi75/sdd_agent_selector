// js/components/justification-ui.js
// Phase 2e — NEW in V4. Per-agent cards (18 total) explaining WHY each
// agent has its assigned model. Pure render; no side effects.
//
// Contract (spec.md "Justification UI" + design.md):
//   render(targetEl, agentsAssignments, roleMatrix, models)
//     Each card: agent key, model name + tier, score, cost, role,
//     the two checks (score ≥ minReasoning, cost ≤ effectiveMaxCost),
//     and top 3 alternatives. Null assignment → critical warning with
//     the getBestFor reason. Colors via tokens.css with Tailwind fallback.

const CANONICAL_ORDER = Object.freeze([
  'gentle-orchestrator', 'sdd-init', 'sdd-explore', 'sdd-propose', 'sdd-spec',
  'sdd-design', 'sdd-tasks', 'sdd-apply', 'sdd-verify', 'sdd-archive', 'sdd-onboard',
  'jd-judge-a', 'jd-judge-b', 'jd-fix-agent',
  'review-risk', 'review-readability', 'review-reliability', 'review-resilience',
]);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[ch];
  });
}

function tierSlug(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'budget';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

function tierLabel(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'budget') return 'min';
  if (tier === 'reference') return 'reference';
  return 'balanced';
}

function twClassFor(slug) {
  return slug === 'high' ? 'bg-emerald-500/80'
    : slug === 'budget' ? 'bg-amber-500/80'
    : slug === 'reference' ? 'bg-rose-500/80'
    : 'bg-indigo-500/80';
}

function tokenValue(doc, name) {
  try {
    const root = doc.documentElement ?? doc.body ?? null;
    if (!root) return '';
    const v = getComputedStyle(root).getPropertyValue(name);
    return v ? v.trim() : '';
  } catch {
    return '';
  }
}

function fmtCost(c) {
  if (!Number.isFinite(c)) return '—';
  const s = c.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `$${s}`;
}

function fmtScore(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(1);
}

function checksBlock(assignment, minReasoning, doc) {
  const { score, cost, effectiveMaxCost: maxCost } = assignment;
  const scorePass = Number.isFinite(score) && Number.isFinite(minReasoning) && score >= minReasoning;
  const costPass = Number.isFinite(cost) && Number.isFinite(maxCost) && cost <= maxCost;
  const passBg = tokenValue(doc, '--just-check-pass') || '#065f46';
  const passText = tokenValue(doc, '--just-check-pass-text') || '#a7f3d0';
  const failBg = tokenValue(doc, '--just-check-fail') || '#7f1d1d';
  const failText = tokenValue(doc, '--just-check-fail-text') || '#fecaca';
  function row(label, actual, op, target, pass) {
    const bg = pass ? passBg : failBg;
    const fg = pass ? passText : failText;
    return `<div class="rounded-md px-2 py-1 text-[11px] font-mono" style="background-color:${esc(bg)};color:${esc(fg)}" data-pass="${pass}">
      <span class="font-semibold">${pass ? '✓' : '✗'}</span>
      <span>${esc(label)} ${esc(actual)} ${esc(op)} ${esc(target)}</span>
    </div>`;
  }
  const scoreStr = Number.isFinite(score) ? fmtScore(score) : '—';
  const minStr = Number.isFinite(minReasoning) ? String(Math.round(minReasoning)) : '—';
  const costStr = Number.isFinite(cost) ? fmtCost(cost) : '—';
  const maxStr = Number.isFinite(maxCost) ? fmtCost(maxCost) : '—';
  return `<div class="flex flex-col gap-1 mt-2">${row('score', scoreStr, '≥', minStr, scorePass)}${row('cost', costStr, '≤', maxStr, costPass)}</div>`;
}

function alternativesBlock(alternatives) {
  const list = Array.isArray(alternatives) ? alternatives.slice(0, 3) : [];
  if (list.length === 0) {
    return `<div class="text-[11px] text-slate-500 mt-2">Sin alternativas elegibles.</div>`;
  }
  const items = list.map((alt) => {
    const m = alt.model || {};
    return `<li class="text-[11px] flex items-center justify-between gap-2"><span class="text-slate-300 truncate">${esc(m.name || alt.key)}</span><span class="font-mono text-slate-400">${fmtScore(alt.score)}</span></li>`;
  }).join('');
  return `<div class="mt-2"><div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Alternativas (top 3)</div><ul class="space-y-0.5">${items}</ul></div>`;
}

function assignmentHeader(assignment, doc) {
  if (!assignment || !assignment.key) return '';
  const m = assignment.model || {};
  const slug = tierSlug(m.tier);
  const bg = tokenValue(doc, `--just-tier-${slug}`);
  const styleAttr = bg ? ` style="background-color:${esc(bg)}"` : '';
  const cls = bg ? 'tier-tag' : `tier-tag ${twClassFor(slug)}`;
  return `<div class="flex items-center justify-between gap-2 mb-1"><span class="text-sm font-semibold text-slate-100">${esc(m.name || assignment.key)}</span><span class="${cls}" data-tier="${esc(slug)}"${styleAttr}>${esc(tierLabel(m.tier))}</span></div>
  <div class="flex gap-3 text-[11px] text-slate-400 font-mono"><span>score ${fmtScore(assignment.score)}</span><span>·</span><span>${fmtCost(assignment.cost)}/req</span></div>`;
}

function cardHtml(agent, role, assignment, doc) {
  const safeA = assignment || {};
  const minReasoning = role && Number.isFinite(role.minReasoning) ? role.minReasoning : 0;
  const roleDesc = (role && role.role) || '—';
  if (!safeA.key) {
    const reason = safeA.reason || 'Sin razón especificada';
    return `<div class="justification-card rounded-xl border border-rose-700 bg-rose-900/40 p-4" data-agent="${esc(agent)}" data-has-assignment="false">
      <div class="flex items-center justify-between mb-1.5"><span class="font-mono text-xs text-slate-300">${esc(agent)}</span><span class="text-[10px] text-rose-200 font-semibold uppercase">⚠ Sin modelo</span></div>
      <div class="text-sm font-semibold text-rose-100 mb-1">No hay modelo elegible</div>
      <div class="text-[11px] text-rose-200/80 mb-2">${esc(reason)}</div>
      <div class="text-[11px] text-slate-400"><span class="text-slate-500">role:</span> ${esc(roleDesc)}</div>
    </div>`;
  }
  return `<div class="justification-card rounded-xl border border-slate-800 bg-slate-900/60 p-4" data-agent="${esc(agent)}" data-has-assignment="true">
    <div class="flex items-center justify-between mb-1"><span class="font-mono text-xs text-slate-300">${esc(agent)}</span></div>
    ${assignmentHeader(safeA, doc)}
    <div class="text-[11px] text-slate-400 mt-2"><span class="text-slate-500">role:</span> ${esc(roleDesc)}</div>
    ${checksBlock(safeA, minReasoning, doc)}
    ${alternativesBlock(safeA.alternatives)}
  </div>`;
}

/**
 * Render the per-agent justification cards into `targetEl`.
 *
 * @param {HTMLElement} targetEl
 * @param {Object<string, Object>} agentsAssignments - keyed by agent id
 * @param {Object<string, {minReasoning:number, costRatio:number, role:string}>} roleMatrix
 * @param {Object<string, Object>} models - keyed by model id (alternative model lookup)
 * @returns {{ cards: number, withAssignment: number, withoutAssignment: number }}
 */
export function render(targetEl, agentsAssignments, roleMatrix, models) {
  if (!targetEl || !(targetEl instanceof HTMLElement)) {
    throw new TypeError('justification-ui.render: targetEl must be an HTMLElement');
  }
  if (!roleMatrix || typeof roleMatrix !== 'object') {
    targetEl.innerHTML = `<div class="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-400">No hay role matrix para justificar.</div>`;
    return { cards: 0, withAssignment: 0, withoutAssignment: 0 };
  }
  const ordered = [...CANONICAL_ORDER];
  for (const k of Object.keys(roleMatrix)) if (!ordered.includes(k)) ordered.push(k);
  const safeA = agentsAssignments || {};
  const doc = targetEl.ownerDocument ?? document;
  let withA = 0;
  let withoutA = 0;
  const cards = ordered
    .filter((agent) => Object.prototype.hasOwnProperty.call(roleMatrix, agent))
    .map((agent) => {
      const role = roleMatrix[agent] || {};
      const a = safeA[agent];
      const hasKey = !!(a && a.key);
      if (hasKey) withA++; else withoutA++;
      return cardHtml(agent, role, a, doc);
    })
    .join('');
  targetEl.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-test="justification-cards">${cards}</div>
    <p class="mt-3 text-xs text-slate-500">${withA}/18 agentes con asignación · colores desde <code>tokens.css</code>.</p>`;
  return { cards: ordered.length, withAssignment: withA, withoutAssignment: withoutA };
}

/** Reset module state. Exported only for jsdom test isolation. */
export function resetForTests() {
  /* no module state — placeholder for parity with other components */
}