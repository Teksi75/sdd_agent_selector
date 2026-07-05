// tests/workflow-table.test.js
// Phase 2b — workflow-table TDD. jsdom + read data/*.json from disk.
// Asserts the 9-row contract from spec.md "UI Component - Workflow Table".
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

    // Compute assignments for the 9 core SDD phases using the
    // balanced strategy (matches how config-selector wires it).
    const { getBestFor } = await import('../js/services/model-scorer.js');
    const assignments = {};
    for (const phase of PHASES) {
      assignments[phase.id] = getBestFor(
        phase.id,
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
});