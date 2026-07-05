// tests/config-selector.test.js
// Phase 2a — config-selector component TDD (RED first).
//
// Contract (per design.md "Components — config-selector" + spec.md
//   "Configuration Management — selectConfig"):
//
//   import { render, selectConfig, InvalidConfigError, setData }
//     from '../js/components/config-selector.js';
//
//   setData({ models, roleMatrix, profiles });   // inject from data-loader
//   render(targetEl, configs, onSelect);         // paints 5 buttons, wires clicks
//   selectConfig('balanceado');                  // validates, computes assignments,
//                                               // updates .active, fires onSelect
//
// Tests use jsdom (vitest config) and a fresh <div> per case to keep
// DOM mutations isolated. We test the contract surface directly — no
// need to dispatch real click events because the public API is the
// `selectConfig` call (and click handlers internally call it).

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// The exact error message per spec "Twin Judge Constraint" — DO NOT change.
// The spec section "Scenario: Twin judges would resolve to different models"
//   pins this string verbatim.
const TWIN_JUDGE_MSG =
  'jd-judge-a and jd-judge-b must resolve to the same model (twin judge constraint violated)';

// --- Fixtures -----------------------------------------------------------

// Tiny 2-model set: both judges converge on the same model (the "happy
// path"). Sufficient for selectConfig to compute 18-agent assignments.
const SHARED = {
  name: 'Shared-Judge-Model',
  arena: 1600,
  swePro: 85,
  term: 85,
  input: 3.00,
  output: 12.00,
  tier: 'high',
};

// Sub-set of the data/*.json fixtures; enough rows to exercise every
//   getBestFor path that selectConfig touches for the 18-agent matrix.
//   We only need one config ('balanceado') to drive the tests; a second
//   ('economico') exercises config switching and idempotency.
const CONFIGS = [
  { key: 'balanceado', name: 'Balanceado', strategy: 'balanced' },
  { key: 'economico', name: 'Económico', strategy: 'min-cost' },
  // the other 3 exist in real data but are not exercised here — wiring
  // in render() depends only on the array length, not which strategies.
];

// 18-agent matrix (subset suffices for the 4 required tests; the full
// real matrix lives in data/agent-roles.json).
const ROLE_MATRIX_FULL = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-roles.json'), 'utf-8')
).roles;

const PROFILES_FULL = JSON.parse(
  readFileSync(join(ROOT, 'data', 'agent-request-profiles.json'), 'utf-8')
).profiles;

const MODELS_REAL = JSON.parse(
  readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')
).models;

/**
 * Inject the SAME model for both judges — the happy path. Callers pass
 * any non-reference model that clears minReasoning=90 for both twins.
 */
function realData() {
  return {
    models: MODELS_REAL,
    roleMatrix: ROLE_MATRIX_FULL,
    profiles: PROFILES_FULL,
  };
}

/**
 * Synthesize a divergent dataset where jd-judge-a and jd-judge-b MUST
 * pick different models. Returns three independent pieces:
 *   models     — { judgeA_only, judgeB_only } (two disjoint models)
 *   roleMatrix — judgeA permissive, judgeB tight costRatio
 *   profiles   — identical for both judges
 */
function divergentData() {
  const judgeA_only = {
    name: 'Judge-A-Only',
    arena: 1670,
    swePro: 92,
    term: 90,
    input: 5.00,
    output: 25.00,
    tier: 'high',
  };
  const judgeB_only = {
    name: 'Judge-B-Only',
    arena: 1660,
    swePro: 88,
    term: 86,
    input: 0.10, // very cheap so judgeB's tight costRatio still qualifies it
    output: 1.00,
    tier: 'balanced',
  };
  // judgeA: wide budget → picks judgeA_only (premium).
  // judgeB: tight budget → picks judgeB_only (cheap).
  const roleMatrix = {
    ...ROLE_MATRIX_FULL,
    'jd-judge-a': { minReasoning: 90, costRatio: 1.0, role: 'judge-a' },
    'jd-judge-b': { minReasoning: 85, costRatio: 0.10, role: 'judge-b' },
  };
  const profiles = {
    ...PROFILES_FULL,
    'jd-judge-a': PROFILES_FULL['jd-judge-a'],
    'jd-judge-b': PROFILES_FULL['jd-judge-b'],
  };
  return {
    models: { judgeA_only, judgeB_only },
    roleMatrix,
    profiles,
  };
}

// --- DOM helpers -------------------------------------------------------

let target;

beforeEach(() => {
  // Fresh mount per test so .active classes don't bleed.
  target = document.createElement('section');
  target.id = 'config-mount';
  document.body.appendChild(target);
});

// Subject under test. Imported at the bottom of the file so the test
// reads top-down like the spec.
// eslint-disable-next-line no-unused-vars
let render, selectConfig, InvalidConfigError, setData, resetForTests;

describe('config-selector — render()', () => {
  test('renders one button per config (no button is .active before any selection)', async () => {
    ({ render, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    render(target, CONFIGS, () => {});
    const buttons = target.querySelectorAll('button[data-config-key]');
    expect(buttons.length).toBe(CONFIGS.length);
    // None start as active until selectConfig fires.
    for (const b of buttons) {
      expect(b.classList.contains('active')).toBe(false);
    }
  });

  test('each button carries its config key + display name', async () => {
    ({ render, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    render(target, CONFIGS, () => {});
    for (const cfg of CONFIGS) {
      const btn = target.querySelector(
        `button[data-config-key="${cfg.key}"]`
      );
      expect(btn).not.toBeNull();
      expect(btn.textContent).toMatch(new RegExp(cfg.name, 'i'));
    }
  });
});

describe('config-selector — selectConfig("balanceado") updates DOM', () => {
  test('adds the .active class to the selected button', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    render(target, CONFIGS, () => {});

    selectConfig('balanceado');

    const activeBtn = target.querySelector(
      'button[data-config-key="balanceado"]'
    );
    expect(activeBtn).not.toBeNull();
    expect(activeBtn.classList.contains('active')).toBe(true);
  });

  test('fires the onSelect callback with the per-agent assignments', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    const onSelect = vi.fn();
    render(target, CONFIGS, onSelect);

    selectConfig('balanceado');

    expect(onSelect).toHaveBeenCalledTimes(1);
    const assignments = onSelect.mock.calls[0][0];
    // Spec: selectConfig returns assignments for ALL 18 agents.
    expect(typeof assignments).toBe('object');
    expect(assignments).toHaveProperty('gentle-orchestrator');
    expect(assignments).toHaveProperty('jd-judge-a');
    expect(assignments).toHaveProperty('jd-judge-b');
    expect(assignments).toHaveProperty('review-resilience');
    // The twin judges must resolve identically (the happy path).
    expect(assignments['jd-judge-a'].key).toBe(assignments['jd-judge-b'].key);
  });
});

describe('config-selector — switching configs replaces .active', () => {
  test('balanceado → economico: balanceado loses .active, economico gains it', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    render(target, CONFIGS, () => {});

    selectConfig('balanceado');
    const balancedBtn = target.querySelector(
      'button[data-config-key="balanceado"]'
    );
    expect(balancedBtn.classList.contains('active')).toBe(true);

    selectConfig('economico');

    expect(balancedBtn.classList.contains('active')).toBe(false);
    const economicBtn = target.querySelector(
      'button[data-config-key="economico"]'
    );
    expect(economicBtn.classList.contains('active')).toBe(true);

    // Exactly one .active at any time.
    const active = target.querySelectorAll('button.active');
    expect(active.length).toBe(1);
  });

  test('invoking selectConfig with an unknown key throws InvalidConfigError', async () => {
    ({ render, selectConfig, InvalidConfigError, setData, resetForTests } =
      await import('../js/components/config-selector.js'));
    resetForTests();
    setData(realData());
    render(target, CONFIGS, () => {});

    expect(() => selectConfig('non-existent')).toThrow(InvalidConfigError);
  });
});

describe('config-selector — idempotent selection', () => {
  test('selectConfig("economico") twice: no error, DOM unchanged, onSelect fires once', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    const onSelect = vi.fn();
    render(target, CONFIGS, onSelect);

    selectConfig('economico');
    // Snapshot the DOM state after the first call so we can assert the
    //   second call leaves it untouched.
    const htmlBefore = target.innerHTML;
    expect(onSelect).toHaveBeenCalledTimes(1);

    expect(() => selectConfig('economico')).not.toThrow();
    expect(target.innerHTML).toBe(htmlBefore);
    // Idempotent: onSelect must NOT fire on the second call (no re-render).
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('config-selector — twin judge constraint enforced', () => {
  test('throws InvalidConfigError when jd-judge-a and jd-judge-b resolve differently', async () => {
    ({
      render,
      selectConfig,
      InvalidConfigError,
      setData,
      resetForTests,
    } = await import('../js/components/config-selector.js'));
    resetForTests();

    const { models, roleMatrix, profiles } = divergentData();
    setData({ models, roleMatrix, profiles });
    render(target, CONFIGS, () => {});

    let caught;
    try {
      selectConfig('balanceado');
    } catch (err) {
      caught = err;
    }

    // Must throw the right type with the verbatim spec message.
    expect(caught).toBeDefined();
    expect(caught).toBeInstanceOf(InvalidConfigError);
    expect(caught.message).toBe(TWIN_JUDGE_MSG);

    // CRITICAL (spec "Twin judges would resolve to different models"):
    //   "no UI state is mutated" — verify the DOM still shows no .active.
    const activeButtons = target.querySelectorAll('button.active');
    expect(activeButtons.length).toBe(0);
  });

  test('exposes InvalidConfigError as the same class throwable by app callers', async () => {
    ({ InvalidConfigError } = await import(
      '../js/components/config-selector.js'
    ));
    expect(typeof InvalidConfigError).toBe('function');
    const err = new InvalidConfigError(TWIN_JUDGE_MSG);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(InvalidConfigError);
    expect(err.message).toBe(TWIN_JUDGE_MSG);
    expect(err.name).toBe('InvalidConfigError');
  });
});

describe('config-selector — coverage sanity (assignments shape)', () => {
  test('selectConfig returns assignments with all 18 canonical agents', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData(realData());
    let captured;
    render(target, CONFIGS, (assignments) => {
      captured = assignments;
    });

    selectConfig('balanceado');

    const CANONICAL_18 = [
      'gentle-orchestrator',
      'sdd-init',
      'sdd-explore',
      'sdd-propose',
      'sdd-spec',
      'sdd-design',
      'sdd-tasks',
      'sdd-apply',
      'sdd-verify',
      'sdd-archive',
      'sdd-onboard',
      'jd-judge-a',
      'jd-judge-b',
      'jd-fix-agent',
      'review-risk',
      'review-readability',
      'review-reliability',
      'review-resilience',
    ];
    expect(captured).toBeDefined();
    expect(Object.keys(captured).sort()).toEqual([...CANONICAL_18].sort());
  });
});
