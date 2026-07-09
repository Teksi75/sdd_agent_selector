// tests/workflow-table.test.js
// Phase 2b — workflow-table TDD. jsdom + read data/*.json from disk.
// Asserts the 9-row contract from spec.md "UI Component - Workflow Table".
//
// Note on ID conventions (matters for the wiring in js/app.js):
//   data/phases.json    -> phase.id is bare ('init', 'explore', ...)
//   data/agent-roles.json -> keys are agent IDs ('sdd-init', 'sdd-explore', ...)
//   getBestFor returns an object keyed by AGENT id, so we call it with
//   'sdd-' + phase.id — same shape the production wiring produces.
//
// Imports declared at the bottom so the test file reads top-down.

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const MODELS = JSON.parse(
  readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
).models;
const PHASES = JSON.parse(
  readFileSync(join(ROOT, 'data', 'phases.json'), 'utf-8')
).phases;
const ROLE_MATRIX = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')
).roles;
const PROFILES = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')
).profiles;

let target;

beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, resetForTests;

describe('workflow-table — 9-row contract (spec.md)', () => {
  test('render(target, assignments, models, phases) crea 9 filas para las fases core', async () => {
    ({ render, resetForTests } = await import('../js/components/workflow-table.js'));
    resetForTests();

    // Mirror the production wiring: getBestFor is called per AGENT
    // (sdd-init, sdd-explore, ...), so the assignments object is
    // keyed by agent id, NOT by bare phase id. The wiring in
    // js/app.js translates between the two conventions before
    // handing the subset to render(). Here we exercise that same
    // translation so the table renders real model assignments.
    const { getBestFor } = await import('../js/services/model-scorer.js');
    const assignments = {};
    for (const phase of PHASES) {
      const agentId = `sdd-${phase.id}`;
      assignments[phase.id] = getBestFor(
        agentId,
        MODELS,
        ROLE_MATRIX,
        PROFILES,
        'balanced'
      );
    }

    const summary = render(target, assignments, MODELS, PHASES);

    // 9 rows — one per phase.
    expect(target.querySelectorAll('tbody tr').length).toBe(9);
    expect(summary.rows).toBe(9);
  });

  test('soft-fallback assignment renders the "soft" badge in the model cell', async () => {
    ({ render, resetForTests } = await import('../js/components/workflow-table.js'));
    resetForTests();

    // Hand-craft a deterministic assignment set: 8 phases with a NORMAL
    //   assignment, 1 phase (sdd-propose) with a soft-fallback assignment.
    //   We hand-craft ALL 9 rows instead of using getBestFor for the others
    //   so the test stays stable when the scoring algorithm changes
    //   (e.g. adding sweVer to the scoring weights). The badge must appear
    //   ONLY on the soft-fallback row.
    const NORMAL_ASSIGNMENT = {
      key: 'glm52',
      model: MODELS.glm52,
      score: 79.39,
      cost: 0.0144,
      effectiveMaxCost: 0.05,
      alternatives: [],
    };
    const assignments = {};
    for (const phase of PHASES) {
      assignments[phase.id] = phase.id === 'propose'
        ? {
            key: 'kimik25',
            model: MODELS.kimik25,
            score: 87.17,
            cost: 0.0015,
            effectiveMaxCost: 0.062,
            softFallback: true,
            reason: 'Soft fallback: no model meets minReasoning=95, surfacing best cost-clearing model (kimik25, score=87.2)',
            alternatives: [],
          }
        : NORMAL_ASSIGNMENT;
    }

    render(target, assignments, MODELS, PHASES);

    // The "soft" badge must exist exactly once and live on the propose row.
    const softBadges = target.querySelectorAll('[data-soft-fallback="true"]');
    expect(softBadges.length).toBe(1);
    const proposeRow = target.querySelector('tr[data-phase-id="propose"]');
    expect(proposeRow).toBeDefined();
    expect(proposeRow.querySelector('[data-soft-fallback="true"]')).toBeDefined();
    // The badge should carry the reason as a title for hover-tooltip.
    const badge = proposeRow.querySelector('[data-soft-fallback="true"]');
    expect(badge.getAttribute('title')).toMatch(/minReasoning=95/);
  });
});