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

// jsdom does not implement scrollIntoView. Stub it on Element.prototype
// so the source code's defensive `typeof card.scrollIntoView === 'function'`
// check passes and the flash-card class is added. Without this stub, the
// source would no-op on jsdom and the test would fail to observe the flash.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () { /* noop for jsdom */ };
}

// V5+ P2-2: scroll-to-impact. The onSelect callback receives
// (assignments, prev) so the caller can react to changes. The component
// itself scrolls + flashes the first changed agent's card.
describe('config-selector — V5+ P2-2 scroll-to-impact', () => {
  test('onSelect recibe (assignments, prev) — el 2do arg es la selección anterior', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    let lastCall = null;
    render(target, CONFIGS, (assignments, prev) => {
      lastCall = { assignments, prev };
    });

    selectConfig('balanceado');
    expect(lastCall.assignments).toBeDefined();
    expect(lastCall.prev).toBeNull();     // first select → no previous

    selectConfig('economico');
    expect(lastCall.prev).toBeDefined();
    expect(lastCall.prev).not.toBeNull();
    expect(lastCall.assignments).toBeDefined();

    // Flush any RAFs queued by the 2 selectConfig calls. Without this
    // they fire during the NEXT test's setup and contaminate its DOM.
    await new Promise((r) => setTimeout(r, 50));
  });

  test('primer select no flashea ningún card (no hay diff)', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });

    // Plant cards for ALL 18 agents so we can detect ANY flash.
    // (The test asserts the OPPOSITE — that none flash on the first
    // select, because there is no previous assignment set to diff
    // against.)
    const allAgents = Object.keys(ROLE_MATRIX);
    const planted = allAgents.map((agent) => {
      const el = document.createElement('div');
      el.setAttribute('data-agent', agent);
      el.className = 'justification-card';
      document.body.appendChild(el);
      return el;
    });

    render(target, CONFIGS, () => {});
    selectConfig('balanceado');
    // Wait for the RAF chain to flush.
    await new Promise((r) => setTimeout(r, 50));

    const flashed = planted.filter((c) => c.classList.contains('flash-card'));
    expect(flashed.length).toBe(0);

    // Cleanup.
    planted.forEach((c) => c.remove());
  });

  test('segundo select con strategy diferente flashea al menos un card', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });

    // Plant cards for ALL 18 agents — the diff will hit at least one
    // of them (and likely more, since balanceado vs min-cost produce
    // different model selections across most roles).
    const allAgents = Object.keys(ROLE_MATRIX);
    const planted = allAgents.map((agent) => {
      const el = document.createElement('div');
      el.setAttribute('data-agent', agent);
      el.className = 'justification-card';
      document.body.appendChild(el);
      return el;
    });

    render(target, CONFIGS, () => {});
    selectConfig('balanceado');
    await new Promise((r) => setTimeout(r, 50));

    selectConfig('economico');
    await new Promise((r) => setTimeout(r, 50));

    const flashed = planted.filter((c) => c.classList.contains('flash-card'));
    expect(flashed.length).toBeGreaterThan(0);

    // Verify the flash class is auto-removed after the 1400ms window.
    // We don't wait 1.4s (would slow the suite) — instead we verify
    // that the class IS set immediately after the RAF flush, and trust
    // the setTimeout in the component source.
    expect(flashed[0].classList.contains('flash-card')).toBe(true);

    // Cleanup.
    planted.forEach((c) => {
      c.classList.remove('flash-card');
      c.remove();
    });
  });
});

// V5+ KI-P0-1: silent option for the boot pre-select path. When the
// page first loads, app.js calls selectConfig('balanceado', { silent: true })
// so the user lands on 18 working assignment cards instead of a wall
// of red "Sin modelo elegible" empties. The silent flag suppresses
// only the toast — onSelect, paintActive, and scrollToFirstChange
// still run normally (so the post-boot end state matches a click).
describe('config-selector — V5+ KI-P0-1 silent option', () => {
  beforeEach(() => {
    resetForTests();
    // Clear any toasts left over from the previous describe's
    // selectConfig() calls (those fire the success toast, which
    // persists in document.body). Without this cleanup, the
    // "no toast on silent" assertion would see a stale toast and
    // fail with expected 1 to be +0.
    document.querySelectorAll('[data-test="export-toast"]').forEach((t) => t.remove());
    target = document.createElement('section');
    document.body.appendChild(target);
  });
  afterEach(() => {
    if (target.parentNode) target.parentNode.removeChild(target);
    document.querySelectorAll('[data-test="export-toast"]').forEach((t) => t.remove());
    resetForTests();
  });

  test('selectConfig(key, { silent: true }) ejecuta todo menos el toast', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    let onSelectCalls = 0;
    render(target, CONFIGS, () => { onSelectCalls += 1; });

    // Antes del select: ningún .active, ningún toast.
    expect(target.querySelectorAll('button.active').length).toBe(0);
    expect(document.querySelectorAll('[data-test="export-toast"]').length).toBe(0);

    // Pre-select con silent.
    selectConfig('balanceado', { silent: true });

    // Después: el botón está activo, onSelect corrió, pero NO hay toast.
    expect(target.querySelectorAll('button.active').length).toBe(1);
    expect(onSelectCalls).toBe(1);
    expect(document.querySelectorAll('[data-test="export-toast"]').length).toBe(0);

    // Cleanup: flush RAFs del scrollToFirstChange (que se saltea con silent,
    // pero por las dudas dejamos el cleanup explícito).
    await new Promise((r) => setTimeout(r, 30));
  });

  test('selectConfig(key) sin silent SIGUE disparando el toast (regression guard)', async () => {
    ({ render, selectConfig, setData, resetForTests } = await import(
      '../js/components/config-selector.js'
    ));
    resetForTests();
    setData({ models: MODELS, roleMatrix: ROLE_MATRIX, profiles: PROFILES });
    render(target, CONFIGS, () => {});

    selectConfig('balanceado');
    // El toast debe aparecer (cualquier export-toast en el DOM).
    expect(document.querySelectorAll('[data-test="export-toast"]').length).toBeGreaterThan(0);
  });
});
