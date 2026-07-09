// tests/justification-ui.test.js
// Phase 2e — justification-ui TDD (jsdom). Asserts the spec scenarios
// from spec.md "Requirement: Justification UI":
//   - render(targetEl, agentsAssignments, roleMatrix, models)
//   - 18 cards, one per agent
//   - Each card shows: model name, tier, score, cost, role, checks,
//     alternatives
//   - Null assignment → critical warning block with the getBestFor reason
//
// Two scenario tests:
//   1. Valid case — sdd-archive assigned to MiMo V2.5 (cheapest role
//      eligible under balanced strategy)
//   2. Warning case — gentle-orchestrator with minReasoning 95 + a
//      dataset where no model qualifies

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const MODELS = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')).models;
const ROLE_MATRIX = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')).roles;
const PROFILES = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')).profiles;

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render;

describe('justification-ui — render() contract (spec.md)', () => {
  test('renders exactly 18 cards (one per agent) for the role matrix', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    const { getBestFor } = await import('../js/services/model-scorer.js');

    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      assignments[agent] = getBestFor(agent, MODELS, ROLE_MATRIX, PROFILES, 'balanced');
    }

    const summary = render(target, assignments, ROLE_MATRIX, MODELS);
    const cards = target.querySelectorAll('.justification-card');
    expect(cards.length).toBe(18);
    expect(summary.cards).toBe(18);
  });

  test('sdd-archive assigned to MiMo V2.5 — valid card with checks + alternatives', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    const { getBestFor } = await import('../js/services/model-scorer.js');

    // Real-data path: under 'balanced' strategy, sdd-archive (costRatio=0.05)
    // resolves to the cheapest eligible model — MiMo V2.5.
    const archiveAssignment = getBestFor('sdd-archive', MODELS, ROLE_MATRIX, PROFILES, 'balanced');
    expect(archiveAssignment.key).toBe('mimo25');

    const assignments = { 'sdd-archive': archiveAssignment };
    const summary = render(target, assignments, ROLE_MATRIX, MODELS);

    const card = target.querySelector('.justification-card[data-agent="sdd-archive"]');
    expect(card).toBeDefined();
    expect(card.getAttribute('data-has-assignment')).toBe('true');
    // Card shows assigned model name.
    expect(card.textContent).toMatch(/MiMo V2\.5/);
    // Card shows the role description (from roleMatrix['sdd-archive'].role).
    expect(card.textContent).toMatch(/Mechanically copy.*cheapest role/i);
    // Both checks rendered (score ≥ 50 and cost ≤ effectiveMaxCost).
    const checkRows = card.querySelectorAll('[data-pass]');
    expect(checkRows.length).toBe(2);
    // Both checks pass for a valid assignment.
    expect(checkRows[0].getAttribute('data-pass')).toBe('true');
    expect(checkRows[1].getAttribute('data-pass')).toBe('true');
    // Summary tracks assignment count correctly.
    expect(summary.withAssignment).toBe(1);
    expect(summary.withoutAssignment).toBe(17);
  });

  test('gentle-orchestrator with minReasoning 95 + no eligible models → soft fallback card', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));

    // Synthetic dataset where no model reaches score 95. With the new
    //   general soft-fallback path in getBestFor, gentle-orchestrator now
    //   gets the highest-scoring cost-clearing model (m_a) as a soft
    //   fallback instead of the old "Sin modelo" critical warning.
    const lowScoreModels = {
      m_a: { name: 'A', arena: 1400, swePro: 50, term: 60, input: 1, output: 3, tier: 'balanced' },
      m_b: { name: 'B', arena: 1300, swePro: 45, term: 55, input: 1, output: 3, tier: 'balanced' },
    };
    const divergentRoles = {
      ...ROLE_MATRIX,
      'gentle-orchestrator': { minReasoning: 95, costRatio: 1.0, role: 'orchestration' },
      // Tighten the twin judges so they resolve to a model (still no model
      // meets minReasoning=95, but the rest of the dataset doesn't crash).
      'jd-judge-a': { minReasoning: 40, costRatio: 1.0, role: 'judge-a' },
      'jd-judge-b': { minReasoning: 40, costRatio: 1.0, role: 'judge-b' },
    };
    const divergentProfiles = {
      ...PROFILES,
      'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 },
      'jd-judge-a': { inputTokens: 5500, outputTokens: 1200 },
      'jd-judge-b': { inputTokens: 5500, outputTokens: 1200 },
    };

    const { getBestFor } = await import('../js/services/model-scorer.js');
    const assignments = {};
    for (const agent of Object.keys(divergentRoles)) {
      assignments[agent] = getBestFor(agent, lowScoreModels, divergentRoles, divergentProfiles, 'balanced');
    }

    const summary = render(target, assignments, divergentRoles, lowScoreModels);

    const card = target.querySelector('.justification-card[data-agent="gentle-orchestrator"]');
    expect(card).toBeDefined();
    // The card is treated as having an assignment (it has a model), but
    //   flagged as a soft fallback so the UI shows a different color and
    //   the reason banner.
    expect(card.getAttribute('data-has-assignment')).toBe('true');
    expect(card.getAttribute('data-soft-fallback')).toBe('true');
    // Soft fallback banner + reason (not the rose "Sin modelo" critical
    //   warning).
    expect(card.textContent).toMatch(/Soft fallback/i);
    expect(card.textContent).toMatch(/minReasoning=95/);
    expect(card.textContent).not.toMatch(/Sin modelo|No hay modelo elegible/i);
    // The card uses the amber color (not rose).
    expect(card.className).toMatch(/border-amber/);
    // The gentle-orchestrator card is treated as with-assignment (it has
    //   a model). Other agents in this synthetic fixture may still be
    //   without-assignment depending on their costRatio — we don't pin
    //   the global counts here, only the gentle-orchestrator behavior.
    expect(summary.withAssignment).toBeGreaterThanOrEqual(1);
  });

  test('gentle-orchestrator with super-tight costRatio + no eligible → still renders critical warning', async () => {
    // Truly-no-eligible case: when no non-reference model clears the cost
    //   ceiling (costRatio is impossibly tight), the soft fallback has
    //   nothing to surface and the function returns null. The UI must
    //   still render the rose "Sin modelo" critical warning in that case.
    ({ render } = await import('../js/components/justification-ui.js'));

    const lowScoreModels = {
      m_a: { name: 'A', arena: 1400, swePro: 50, term: 60, input: 1, output: 3, tier: 'balanced' },
    };
    const divergentRoles = {
      ...ROLE_MATRIX,
      // costRatio 0.0001 makes the effectiveMaxCost ~0.000001 — no model
      //   clears it, so soft fallback can't fire.
      'gentle-orchestrator': { minReasoning: 95, costRatio: 0.0001, role: 'orchestration' },
      'jd-judge-a': { minReasoning: 40, costRatio: 1.0, role: 'judge-a' },
      'jd-judge-b': { minReasoning: 40, costRatio: 1.0, role: 'judge-b' },
    };
    const divergentProfiles = {
      ...PROFILES,
      'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 },
      'jd-judge-a': { inputTokens: 5500, outputTokens: 1200 },
      'jd-judge-b': { inputTokens: 5500, outputTokens: 1200 },
    };

    const { getBestFor } = await import('../js/services/model-scorer.js');
    const assignments = {};
    for (const agent of Object.keys(divergentRoles)) {
      assignments[agent] = getBestFor(agent, lowScoreModels, divergentRoles, divergentProfiles, 'balanced');
    }

    const summary = render(target, assignments, divergentRoles, lowScoreModels);

    const card = target.querySelector('.justification-card[data-agent="gentle-orchestrator"]');
    expect(card).toBeDefined();
    expect(card.getAttribute('data-has-assignment')).toBe('false');
    expect(card.getAttribute('data-soft-fallback')).toBeNull();
    expect(card.textContent).toMatch(/Sin modelo|No hay modelo elegible/i);
    expect(card.className).toMatch(/border-rose/);
    expect(summary.withoutAssignment).toBeGreaterThanOrEqual(1);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    expect(() => render(null, {}, ROLE_MATRIX, MODELS)).toThrow(TypeError);
    expect(() => render({}, {}, ROLE_MATRIX, MODELS)).toThrow(TypeError);
  });

  test('null roleMatrix renders empty-state card (no rows)', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    const summary = render(target, {}, null, MODELS);
    expect(summary.cards).toBe(0);
    expect(target.textContent).toMatch(/No hay role matrix/i);
  });

  test('valid assignment with empty alternatives list renders "Sin alternativas" placeholder', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    // Build a hand-crafted assignment with no alternatives.
    const a = {
      key: 'mimo25',
      model: MODELS.mimo25,
      score: 86.97,
      cost: 0.000266,
      effectiveMaxCost: 0.00085,
      alternatives: [],
    };
    render(target, { 'sdd-archive': a }, ROLE_MATRIX, MODELS);
    const card = target.querySelector('.justification-card[data-agent="sdd-archive"]');
    expect(card).toBeDefined();
    expect(card.textContent).toMatch(/Sin alternativas/i);
  });

  test('failed checks (cost > effectiveMaxCost) render the fail-style row', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    // Hand-crafted assignment where cost EXCEEDS effectiveMaxCost.
    const a = {
      key: 'mimo25',
      model: MODELS.mimo25,
      score: 50,
      cost: 0.05,
      effectiveMaxCost: 0.0001,
      alternatives: [
        { key: 'minimaxm3', model: MODELS.minimaxm3, score: 60 },
      ],
    };
    render(target, { 'sdd-archive': a }, ROLE_MATRIX, MODELS);
    const card = target.querySelector('.justification-card[data-agent="sdd-archive"]');
    expect(card).toBeDefined();
    // At least one check row should be marked as failing.
    const failing = card.querySelector('[data-pass="false"]');
    expect(failing).toBeDefined();
    // And the alternatives list should still render.
    expect(card.textContent).toMatch(/Alternativas/i);
  });

  test('hand-crafted assignments cover all 4 tiers (high/balanced/budget/reference)', async () => {
    ({ render } = await import('../js/components/justification-ui.js'));
    const baseA = {
      score: 80, cost: 0.001, effectiveMaxCost: 0.005,
      alternatives: [],
    };
    const assignments = {
      'gentle-orchestrator': { ...baseA, key: 'opus48', model: MODELS.opus48 },
      'sdd-apply': { ...baseA, key: 'glm52', model: MODELS.glm52 },
      'sdd-archive': { ...baseA, key: 'mimo25', model: MODELS.mimo25 },
      'sdd-init': { ...baseA, key: 'qwen36plus', model: MODELS.qwen36plus },
    };
    render(target, assignments, ROLE_MATRIX, MODELS);
    // All 18 cards render — 4 with tier 'reference', 'high', 'budget', 'balanced'.
    const cards = target.querySelectorAll('.justification-card');
    expect(cards.length).toBe(18);
    // Each tier shows up in the DOM at least once.
    const html = target.innerHTML;
    expect(html).toMatch(/data-tier="reference"/);
    expect(html).toMatch(/data-tier="high"/);
    expect(html).toMatch(/data-tier="budget"/);
    expect(html).toMatch(/data-tier="balanced"/);
  });
});