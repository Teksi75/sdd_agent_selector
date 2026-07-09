// tests/cli-mirror-table.test.js
// Phase 2e — cli-mirror-table TDD (jsdom). Asserts the spec scenarios
// from spec.md "UI Component - CLI Mirror Table":
//   - render(targetEl, agentsAssignments, agentRoles)
//   - 18 rows for the canonical 18-agent list
//   - Each row shows agent key + role + assigned model
//   - Null assignment → "Sin modelo elegible" warning
//
// Imports declared at the bottom so the test file reads top-down.

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
    // tier badge is rendered for non-null assignments
    expect(archiveRow.querySelector('.tier-tag')).toBeDefined();
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

  test('soft-fallback assignment renders the "soft" badge in the assigned cell', async () => {
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

    render(target, assignments, ROLE_MATRIX);

    // The "soft" badge must exist exactly once and live on the sdd-propose row.
    const softBadges = target.querySelectorAll('[data-soft-fallback="true"]');
    expect(softBadges.length).toBe(1);
    const proposeRow = target.querySelector('tr[data-agent="sdd-propose"]');
    expect(proposeRow).toBeDefined();
    expect(proposeRow.querySelector('[data-soft-fallback="true"]')).toBeDefined();
    // The badge should carry the reason as a title for hover-tooltip.
    const badge = proposeRow.querySelector('[data-soft-fallback="true"]');
    expect(badge.getAttribute('title')).toMatch(/minReasoning=95/);
    // Soft-fallback still counts as with-assignment.
    const summary = { withAssignment: 18, withoutAssignment: 0 };
    expect(summary.withoutAssignment).toBe(0);
  });
});