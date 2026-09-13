// tests/cli-mirror-table.test.js
// Phase 2e — cli-mirror-table TDD (jsdom). Asserts the spec scenarios
// from spec.md "UI Component - CLI Mirror Table":
//   - render(targetEl, agentsAssignments, agentRoles)
//   - 18 rows for the canonical 18-agent list
//   - Each row shows agent key + role + assigned model
//   - Null assignment → "Sin modelo elegible" warning
//
// Imports declared at the bottom so the test file reads top-down.

import { describe, test, expect, beforeEach, vi } from 'vitest';
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

describe('cli-mirror-table — render() contract (spec.md)', () => {
  test('renders exactly 18 rows for the 18-agent role matrix', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));
    const { getBestFor } = await import('../js/services/model-scorer.js');

    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      assignments[agent] = getBestFor(agent, MODELS, ROLE_MATRIX, PROFILES, 'balanced');
    }

    const summary = render(target, assignments, ROLE_MATRIX);
    const rows = target.querySelectorAll('tbody tr');
    expect(rows.length).toBe(18);
    expect(summary.rows).toBe(18);
  });

  test('every row carries the agent key, role description, and assigned model', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));
    const { getBestFor } = await import('../js/services/model-scorer.js');

    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      assignments[agent] = getBestFor(agent, MODELS, ROLE_MATRIX, PROFILES, 'balanced');
    }

    render(target, assignments, ROLE_MATRIX);
    const rows = Array.from(target.querySelectorAll('tbody tr'));

    // Spot-check: sdd-archive should be in the table and should have a
    // non-empty assignment cell (costRatio=0.05 means cheapest model wins).
    const archiveRow = rows.find((r) => r.dataset.agent === 'sdd-archive');
    expect(archiveRow).toBeDefined();
    expect(archiveRow.querySelectorAll('td').length).toBe(3);
    expect(archiveRow.textContent).toMatch(/archive/i);
    // Effort-only: no tier badge/data attribute survives in any assigned cell.
    expect(archiveRow.querySelector('.tier-tag')).toBeNull();
    expect(archiveRow.querySelectorAll('[data-tier]').length).toBe(0);
    expect(target.querySelectorAll('.tier-tag').length).toBe(0);
  });

  test('null assignment renders "Sin modelo elegible" warning cell', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));

    // Build a fake assignment set where one agent has no eligible model.
    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      assignments[agent] = {
        key: agent === 'gentle-orchestrator' ? null : 'mimo25',
        model: agent === 'gentle-orchestrator' ? null : MODELS.mimo25,
        reason: agent === 'gentle-orchestrator' ? 'No model meets minReasoning=95' : undefined,
      };
    }

    const summary = render(target, assignments, ROLE_MATRIX);

    const warnRow = target.querySelector('tr[data-agent="gentle-orchestrator"]');
    expect(warnRow).toBeDefined();
    expect(warnRow.textContent).toMatch(/Sin modelo elegible/i);
    expect(summary.withoutAssignment).toBe(1);
    expect(summary.withAssignment).toBe(17);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));
    expect(() => render(null, {}, ROLE_MATRIX)).toThrow(TypeError);
    expect(() => render({}, {}, ROLE_MATRIX)).toThrow(TypeError);
  });

  test('soft-fallback assignment renders the model name only (no badges)', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));

    // Build a fake assignment set where one agent has a soft-fallback
    //   assignment (sdd-propose with kimik25 under max-quality). All
    //   other agents have a normal mimo25 assignment.
    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      if (agent === 'sdd-propose') {
        assignments[agent] = {
          key: 'kimik25',
          model: MODELS.kimik25,
          score: 91.82,
          cost: 0.005,
          effectiveMaxCost: 0.062,
          softFallback: true,
          reason: 'Soft fallback: no model meets minReasoning=95, surfacing best cost-clearing model (kimik25, score=91.8)',
          alternatives: [],
        };
      } else {
        assignments[agent] = {
          key: 'mimo25',
          model: MODELS.mimo25,
          score: 86.97,
          cost: 0.0003,
          effectiveMaxCost: 0.01,
          alternatives: [],
        };
      }
    }

    const summary = render(target, assignments, ROLE_MATRIX);

    // Effort-only fallback: the model name renders as plain text — no
    // soft badge, no tier markup and no effort badge on that cell.
    const proposeRow = target.querySelector('tr[data-agent="sdd-propose"]');
    expect(proposeRow).toBeDefined();
    expect(proposeRow.textContent).toContain(MODELS.kimik25.name);
    expect(proposeRow.querySelector('[data-soft-fallback="true"]')).toBeNull();
    expect(proposeRow.querySelector('[data-effort]')).toBeNull();
    expect(proposeRow.querySelector('.tier-tag')).toBeNull();
    expect(proposeRow.querySelectorAll('[data-tier]').length).toBe(0);
    expect(target.querySelectorAll('.soft-badge').length).toBe(0);
    expect(target.querySelectorAll('[data-soft-fallback="true"]').length).toBe(0);
    expect(proposeRow.textContent).not.toMatch(/~/);
    // A normal (non-fallback) row also carries zero tier/soft markup.
    const initRow = target.querySelector('tr[data-agent="sdd-init"]');
    expect(initRow.querySelectorAll('.tier-tag, [data-tier], .soft-badge, [data-soft-fallback]').length).toBe(0);
    // Soft-fallback still counts as with-assignment.
    expect(summary.withAssignment).toBe(18);
    expect(summary.withoutAssignment).toBe(0);
  });

  test('renders effort labels for assigned variants and omits missing effort', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));

    const agentRoles = {
      'gentle-orchestrator': { role: 'orchestrator' },
      'sdd-init': { role: 'initializer' },
      'sdd-explore': { role: 'explorer' },
    };
    const assignments = {
      'gentle-orchestrator': {
        key: 'gpt55',
        model: { name: 'GPT-5.5', tier: 'high', effort: 'xhigh' },
      },
      'sdd-init': {
        key: 'gpt55High',
        model: { name: 'GPT-5.5 High', tier: 'high', effort: 'high' },
      },
      'sdd-explore': {
        key: 'legacy',
        model: { name: 'Legacy model', tier: 'balanced' },
      },
    };

    render(target, assignments, agentRoles);
    expect(target.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(target.querySelector('tr[data-agent="gentle-orchestrator"] [data-effort="xhigh"]')?.textContent)
      .toBe('Extremo alto');
    expect(target.querySelector('tr[data-agent="sdd-init"] [data-effort="high"]')?.textContent)
      .toBe('Alto');
    expect(target.querySelector('tr[data-agent="sdd-explore"] [data-effort]')).toBeNull();
  });
});

// V5 Slice 3 — unassigned rows stay stable (18 rows), and the export is the
// filtered assignment view with the active-providers header.
describe('cli-mirror-table — V5 Slice 3 unassigned + filtered export', () => {
  const CTX = {
    providerIds: ['alpha', 'beta'],
    providerNames: ['Alpha', 'Beta'],
    timestamp: '2026-09-12T00:00:00.000Z',
  };

  test('18 filas preservadas con todos los assignments unassigned', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));
    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) assignments[agent] = { key: null, reason: 'filtro vacío' };
    const summary = render(target, assignments, ROLE_MATRIX);
    expect(summary.rows).toBe(18);
    expect(summary.withAssignment).toBe(0);
    expect(summary.withoutAssignment).toBe(18);
    expect(target.querySelectorAll('tr[data-agent]').length).toBe(18);
    expect(target.querySelectorAll('.warn-row').length).toBe(18);
  });

  test('export default: primera línea con scope + providers activos', async () => {
    ({ render } = await import('../js/components/cli-mirror-table.js'));
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const assignments = {};
    for (const agent of Object.keys(ROLE_MATRIX)) {
      assignments[agent] = { key: 'shared', model: { name: 'Shared Model', tier: 'high' } };
    }
    render(target, assignments, ROLE_MATRIX, { exportContext: CTX });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    target.querySelector('[data-format-id="copy-md"]').click();
    await new Promise((r) => setTimeout(r, 0));
    const captured = writeText.mock.calls[0][0];
    expect(captured.split('\n')[0]).toBe(
      '<!-- sdd-export scope=filtered providers="Alpha, Beta" timestamp="2026-09-12T00:00:00.000Z" -->'
    );
    expect(captured).toContain('Shared Model');
  });
});
