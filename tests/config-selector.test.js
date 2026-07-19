// tests/config-selector.test.js
// Phase 2a — config-selector TDD. 4 jsdom tests covering the spec scenarios.
// Imports declared at the bottom so the test file reads top-down.

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const ROLE_MATRIX = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')
).roles;
const PROFILES = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')
).profiles;
const MODELS = JSON.parse(
  readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
).models;

const TWIN_JUDGE_MSG =
  'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)';

const CONFIGS = [
  { key: 'balanceado', name: 'Balanceado', strategy: 'balanced' },
  { key: 'economico',  name: 'Económico',  strategy: 'min-cost' },
];

let target;

beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, selectConfig, setData, resetForTests, InvalidConfigError;

describe('config-selector — selection semantics', () => {
  test('selectConfig("balanceado") updates DOM (button gana .active)', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    render(target, CONFIGS, () => {});
    selectConfig('balanceado');
    const btn = target.querySelector('button[data-config-key="balanceado"]');
    expect(btn.classList.contains('active')).toBe(true);
  });

  test('switching configs balanceado → economico reemplaza .active', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    render(target, CONFIGS, () => {});
    selectConfig('balanceado');
    selectConfig('economico');
    const balanced = target.querySelector(
      'button[data-config-key="balanceado"]'
    );
    const economic = target.querySelector(
      'button[data-config-key="economico"]'
    );
    expect(balanced.classList.contains('active')).toBe(false);
    expect(economic.classList.contains('active')).toBe(true);
    expect(target.querySelectorAll('button.active').length).toBe(1);
  });

  test('idempotent: selectConfig("economico") dos veces no causa error ni re-render', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    let calls = 0;
    render(target, CONFIGS, () => { calls++; });
    selectConfig('economico');
    expect(() => selectConfig('economico')).not.toThrow();
    expect(calls).toBe(1);
  });
});

describe('config-selector — twin judge constraint', () => {
  test('manipulated data: selectConfig throws InvalidConfigError con mensaje exacto', async () => {
    ({
      render,
      selectConfig,
      setData,
      resetForTests,
      InvalidConfigError,
    } = await import('../js/components/config-selector.js'));
    resetForTests();

    // Synthetic divergent dataset: judgeA gets the premium model, judgeB
    // gets the cheap one — they MUST resolve to different keys.
    // PR3 fixture: benchlm blocks carry deterministic scores so
    // compositeScore returns the expected values.
    const divergentModels = {
      judgeA_only: {
        name: 'Judge-A-Only',
        benchlm: { score: 94, verified: true, reliability: 0.95, categories: {} },
        input: 5.00, output: 25.00,
        tier: 'high',
      },
      judgeB_only: {
        name: 'Judge-B-Only',
        benchlm: { score: 91, verified: true, reliability: 0.9, categories: {} },
        input: 0.10, output: 1.00,
        tier: 'balanced',
      },
    };
    const divergentRoles = {
      ...ROLE_MATRIX,
      'jd-judge-a': { minReasoning: 90, costRatio: 1.0,  role: 'judge-a' },
      'jd-judge-b': { minReasoning: 85, costRatio: 0.10, role: 'judge-b' },
    };
    setData({
      models: divergentModels,
      roleMatrix: divergentRoles,
      profiles: PROFILES,
    });
    render(target, [{ key: 'balanceado', name: 'Balanceado', strategy: 'balanced' }], () => {});

    let caught;
    try {
      selectConfig('balanceado');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InvalidConfigError);
    expect(caught.message).toBe(TWIN_JUDGE_MSG);
    // Spec: "no UI state is mutated" — verify the DOM still shows no .active.
    expect(target.querySelectorAll('button.active').length).toBe(0);
  });
});
