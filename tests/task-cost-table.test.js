// tests/task-cost-table.test.js
// Task cost table TDD (jsdom): per-agent cost with the agent's own request
// profile. Contract: render(targetEl, assignments, agentRoles, profiles).

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const REAL_ROLES = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')).roles;
const REAL_PROFILES = JSON.parse(readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')).profiles;

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render;

const FIXTURE_ROLES = {
  'sdd-apply': { minReasoning: 75, costRatio: 1, role: 'apply' },
  'sdd-archive': { minReasoning: 50, costRatio: 0.05, role: 'archive' },
  'sdd-init': { minReasoning: 60, costRatio: 0.1, role: 'init' },
};

const FIXTURE_PROFILES = {
  'sdd-apply': { inputTokens: 6000, outputTokens: 3500 },
  'sdd-archive': { inputTokens: 900, outputTokens: 500 },
};

const MODEL_A = { name: 'Model-A', input: 1.4, output: 4.4, tier: 'balanced' };
const MODEL_B = { name: 'Model-B', input: 0.14, output: 0.28, tier: 'budget' };

describe('task-cost-table — render() contract', () => {
  test('per-agent rows show profile tokens, model and cost with own profile', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const assignments = {
      // (1.4/1e6)*6000 + (4.4/1e6)*3500 = 0.0084 + 0.0154 = $0.0238
      'sdd-apply': { key: 'a', model: MODEL_A, score: 80, cost: 0.0238, effectiveMaxCost: 1 },
      // (0.14/1e6)*900 + (0.28/1e6)*500 = 0.000126 + 0.00014 = $0.000266
      'sdd-archive': { key: 'b', model: MODEL_B, score: 60, cost: 0.000266, effectiveMaxCost: 1 },
      'sdd-init': { key: null, reason: 'no eligible' },
    };
    const summary = render(target, assignments, FIXTURE_ROLES, FIXTURE_PROFILES);
    expect(summary.rows).toBe(3);
    expect(summary.withAssignment).toBe(2);
    expect(summary.withoutAssignment).toBe(1);

    const apply = target.querySelector('[data-agent="sdd-apply"]');
    expect(apply.textContent).toContain('Model-A');
    expect(apply.textContent).toContain('6000/3500');
    expect(apply.textContent).toContain('$0.0238');

    const archive = target.querySelector('[data-agent="sdd-archive"]');
    expect(archive.textContent).toContain('Model-B');
    expect(archive.textContent).toContain('900/500');
    expect(archive.textContent).toContain('$0.000266');

    const init = target.querySelector('[data-agent="sdd-init"]');
    expect(init.textContent).toMatch(/Sin modelo elegible/);
  });

  test('footer totals the assigned costs (workflow total)', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const assignments = {
      'sdd-apply': { key: 'a', model: MODEL_A, score: 80, cost: 0.0238, effectiveMaxCost: 1 },
      'sdd-archive': { key: 'b', model: MODEL_B, score: 60, cost: 0.000266, effectiveMaxCost: 1 },
      'sdd-init': { key: null, reason: 'no eligible' },
    };
    const summary = render(target, assignments, FIXTURE_ROLES, FIXTURE_PROFILES);
    // 0.0238 + 0.000266 = $0.024066 over 2 assigned agents.
    expect(summary.totalCost).toBeCloseTo(0.024066, 6);
    expect(target.textContent).toContain('$0.024066');
  });

  test('agent without profile falls back to default 1000/500', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const assignments = {
      // (1.4/1e6)*1000 + (4.4/1e6)*500 = $0.0036
      'sdd-init': { key: 'a', model: MODEL_A, score: 80, cost: 0.0036, effectiveMaxCost: 1 },
    };
    render(target, assignments, FIXTURE_ROLES, {});
    const row = target.querySelector('[data-agent="sdd-init"]');
    expect(row.textContent).toContain('1000/500');
    expect(row.textContent).toContain('$0.0036');
  });

  test('real data files: 18 rows in canonical order, all unassigned', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const summary = render(target, {}, REAL_ROLES, REAL_PROFILES);
    const rows = Array.from(target.querySelectorAll('[data-agent]'));
    expect(summary.rows).toBe(18);
    expect(rows.length).toBe(18);
    expect(rows[0].getAttribute('data-agent')).toBe('gentle-orchestrator');
    expect(rows[rows.length - 1].getAttribute('data-agent')).toBe('review-resilience');
    expect(summary.withoutAssignment).toBe(18);
  });

  test('empty roles -> empty-state, zero rows', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const summary = render(target, {}, {}, {});
    expect(summary.rows).toBe(0);
    expect(target.querySelectorAll('[data-agent]').length).toBe(0);
    expect(target.querySelector('[data-test="empty-state"]')).not.toBeNull();
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    expect(() => render(null, {}, FIXTURE_ROLES, FIXTURE_PROFILES)).toThrow(TypeError);
    expect(() => render({}, {}, FIXTURE_ROLES, FIXTURE_PROFILES)).toThrow(TypeError);
  });

  test('escapes user-controlled strings in model names', async () => {
    ({ render } = await import('../js/components/task-cost-table.js'));
    const evil = {
      'sdd-apply': {
        key: 'x',
        model: { name: '<img src=x onerror=alert(1)>', input: 1, output: 3 },
        score: 80,
        cost: 0.001,
        effectiveMaxCost: 1,
      },
    };
    render(target, evil, FIXTURE_ROLES, FIXTURE_PROFILES);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });
});
