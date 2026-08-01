// tests/hero-stats.test.js
// V5+ P2-5 — hero-stats component tests. The component paints a small
// one-line summary of the catalog (active / reference / agent counts)
// into the hero. It is also re-runnable: when data-sync refreshes
// the model set, the line updates without a full page reload.

import { describe, test, expect, beforeEach } from 'vitest';
import {
  countModelsByLifecycle,
  countAgentsByFamily,
  buildStatsLine,
  render,
  resetForTests,
} from '../js/components/hero-stats.js';

let target;

beforeEach(() => {
  resetForTests();
  target = document.createElement('div');
  document.body.appendChild(target);
});

describe('hero-stats — countModelsByLifecycle', () => {
  test('cuenta active / reference / legacy / total', () => {
    const models = {
      a: { lifecycle: 'active' },
      b: { lifecycle: 'active' },
      c: { lifecycle: 'reference' },
      d: { lifecycle: 'legacy' },
      e: { lifecycle: 'benchmark-only' }, // not counted in any headline bucket
      f: {}, // no lifecycle field → falls back to 'active' per lifecycleOf
    };
    const counts = countModelsByLifecycle(models);
    // `f` has no lifecycle; lifecycleOf returns 'active' (per
    // legacy heuristic when no lifecycle and no reference tier).
    expect(counts.active).toBe(3);   // a, b, f
    expect(counts.reference).toBe(1); // c
    expect(counts.legacy).toBe(1);    // d
    expect(counts.total).toBe(6);
  });

  test('referencia por tier (no lifecycle) cuenta como reference', () => {
    const counts = countModelsByLifecycle({ x: { tier: 'reference' } });
    expect(counts.reference).toBe(1);
  });

  test('input vacío / no-objeto devuelve ceros', () => {
    expect(countModelsByLifecycle({})).toEqual({ active: 0, reference: 0, legacy: 0, total: 0 });
    expect(countModelsByLifecycle(null)).toEqual({ active: 0, reference: 0, legacy: 0, total: 0 });
    expect(countModelsByLifecycle(undefined)).toEqual({ active: 0, reference: 0, legacy: 0, total: 0 });
  });
});

describe('hero-stats — countAgentsByFamily', () => {
  test('cuenta sdd / jd / review por prefijo del id', () => {
    const rm = {
      'sdd-init': {},
      'sdd-explore': {},
      'sdd-archive': {},
      'jd-judge-a': {},
      'jd-judge-b': {},
      'review-risk': {},
      'review-readability': {},
      'review-reliability': {},
      'review-resilience': {},
    };
    const counts = countAgentsByFamily(rm);
    expect(counts.sdd).toBe(3);
    expect(counts.jd).toBe(2);
    expect(counts.review).toBe(4);
    expect(counts.total).toBe(9);
  });

  test('input vacío devuelve ceros', () => {
    expect(countAgentsByFamily({})).toEqual({ sdd: 0, jd: 0, review: 0, total: 0 });
  });
});

describe('hero-stats — buildStatsLine', () => {
  test('formato "X activos · Y reference · Z agentes (a SDD + b JD + c review)"', () => {
    const data = {
      models: {
        a: { lifecycle: 'active' },
        b: { lifecycle: 'active' },
        c: { lifecycle: 'reference' },
      },
      roleMatrix: {
        'sdd-init': {}, 'sdd-explore': {},
        'jd-judge-a': {},
        'review-risk': {},
      },
    };
    const line = buildStatsLine(data);
    expect(line).toMatch(/2 activos/);
    expect(line).toMatch(/1 reference/);
    expect(line).toMatch(/4 agentes \(2 SDD \+ 1 JD \+ 1 review\)/);
  });

  test('omite el sufijo "reference" cuando no hay modelos de referencia', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {} },
    };
    const line = buildStatsLine(data);
    expect(line).not.toMatch(/reference/);
    expect(line).toMatch(/1 activos/);
  });

  test('omite "legacy" cuando no hay modelos legacy', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {} },
    };
    const line = buildStatsLine(data);
    expect(line).not.toMatch(/legacy/);
  });

  test('incluye "legacy" cuando hay modelos legacy', () => {
    const data = {
      models: {
        a: { lifecycle: 'active' },
        b: { lifecycle: 'legacy' },
      },
      roleMatrix: { 'sdd-init': {} },
    };
    const line = buildStatsLine(data);
    expect(line).toMatch(/1 legacy/);
  });
});

describe('hero-stats — render()', () => {
  test('pinta el data-test="hero-stats" en el mount', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {} },
    };
    const out = render(target, data);
    expect(out.mounted).toBe(true);
    expect(target.querySelector('[data-test="hero-stats"]')).not.toBeNull();
  });

  test('incluye los counts en el DOM como texto', () => {
    const data = {
      models: {
        a: { lifecycle: 'active' },
        b: { lifecycle: 'active' },
        c: { lifecycle: 'reference' },
      },
      roleMatrix: {
        'sdd-init': {}, 'sdd-explore': {}, 'sdd-archive': {},
        'jd-judge-a': {}, 'jd-judge-b': {},
        'review-risk': {},
      },
    };
    render(target, data);
    const text = target.textContent.replace(/\s+/g, ' ');
    expect(text).toMatch(/2\s+activos/);
    expect(text).toMatch(/1\s+reference/);
    expect(text).toMatch(/6\s+agentes/);
    expect(text).toMatch(/3\s+SDD/);
    expect(text).toMatch(/2\s+JD/);
    expect(text).toMatch(/1\s+review/);
  });

  test('safe con mount null (no-op, no throw)', () => {
    const data = { models: {}, roleMatrix: {} };
    const out = render(null, data);
    expect(out.mounted).toBe(false);
    // html siempre se computa — el caller puede inspeccionarlo offline.
    expect(out.html).toMatch(/data-test="hero-stats"/);
  });

  test('re-render sobreescribe el contenido previo (re-paint seguro)', () => {
    const data1 = {
      models: { a: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {} },
    };
    render(target, data1);
    const first = target.textContent;

    const data2 = {
      models: {
        x: { lifecycle: 'active' },
        y: { lifecycle: 'active' },
        z: { lifecycle: 'active' },
      },
      roleMatrix: {
        'sdd-init': {}, 'sdd-explore': {}, 'sdd-archive': {},
      },
    };
    render(target, data2);
    const second = target.textContent;

    expect(first).toMatch(/1\s+activos/);
    expect(second).toMatch(/3\s+activos/);
    expect(second).not.toMatch(/1\s+activos/);
  });
});
