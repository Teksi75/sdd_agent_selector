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

// V5+ KI-P0-2 — data contract tolerance. PR #46 regressed by reading
// `data.roleMatrix` while data-loader returns the key as `roles`. The
// fix: accept either. These tests pin both the legacy name and the
// live name so a future rename of either side breaks the build
// instead of breaking the live page.
describe('hero-stats — V5+ KI-P0-2 dual-key tolerance', () => {
  test('buildStatsLine acepta data.roles (live data-loader contract)', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roles: { 'sdd-init': {}, 'sdd-archive': {} },
    };
    const line = buildStatsLine(data);
    expect(line).toMatch(/2 agentes/);
    expect(line).toMatch(/2 SDD/);
  });

  test('buildStatsLine acepta data.roleMatrix (legacy name)', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {} },
    };
    const line = buildStatsLine(data);
    expect(line).toMatch(/1 agentes/);
    expect(line).toMatch(/1 SDD/);
  });

  test('buildStatsLine con ambas keys (roles + roleMatrix) prefiere roles', () => {
    // Si ambas están presentes, gana `roles` (la del data-loader real).
    const data = {
      models: { a: { lifecycle: 'active' } },
      roles: { 'sdd-init': {}, 'sdd-archive': {}, 'sdd-explore': {} },  // 3
      roleMatrix: { 'sdd-init': {} },  // 1 — ignorado
    };
    const line = buildStatsLine(data);
    expect(line).toMatch(/3 agentes/);
  });

  test('buildStatsLine con ninguna key cae a 0 agentes (no throw)', () => {
    const data = { models: { a: { lifecycle: 'active' } } };
    const line = buildStatsLine(data);
    expect(line).toMatch(/0 agentes/);
  });

  test('render pinta el conteo correcto con data.roles', () => {
    const data = {
      models: { a: { lifecycle: 'active' } },
      roles: {
        'sdd-init': {}, 'sdd-archive': {}, 'sdd-archive2': {},
        'jd-judge-a': {}, 'jd-judge-b': {},
        'review-risk': {},
      },
    };
    const out = render(target, data);
    expect(out.mounted).toBe(true);
    const text = target.textContent.replace(/\s+/g, ' ');
    expect(text).toMatch(/1\s+activos/);
    expect(text).toMatch(/6\s+agentes/);
    expect(text).toMatch(/3\s+SDD/);
    expect(text).toMatch(/2\s+JD/);
    expect(text).toMatch(/1\s+review/);
  });
});

// V5+ critique v3 — P1-1: hero micro-stats visual hierarchy. The line
// now splits into TWO blocks (Modelos / Agentes) separated by a vertical
// divider, with the headline numbers at a larger visual weight. These
// tests pin the new shape so a future regression to the old single-row
// muted line breaks the build instead of breaking the page.
describe('hero-stats — V5+ critique v3 P1-1 visual hierarchy', () => {
  test('renderiza 2 bloques + divider vertical con data-test markers', () => {
    const data = {
      models: { a: { lifecycle: 'active' }, b: { lifecycle: 'active' } },
      roleMatrix: { 'sdd-init': {}, 'sdd-archive': {} },
    };
    render(target, data);
    const modelsBlock = target.querySelector('[data-test="hero-stats-models"]');
    const agentsBlock = target.querySelector('[data-test="hero-stats-agents"]');
    const divider = target.querySelector('[data-test="hero-stats-divider"]');
    expect(modelsBlock).not.toBeNull();
    expect(agentsBlock).not.toBeNull();
    expect(divider).not.toBeNull();
    // Cada bloque es un <span> directo del wrapper, no anidado dentro
    // del otro (la jerarquía previa era un solo span que contenía
    // modelos + agentes).
    expect(modelsBlock.contains(agentsBlock)).toBe(false);
    expect(agentsBlock.contains(modelsBlock)).toBe(false);
    // El divider es el pipe literal, oculto en mobile via hidden sm:inline
    // para que la línea wrappee limpio en viewports chicos.
    expect(divider.textContent.trim()).toBe('|');
    expect(divider.className).toMatch(/\bhidden\b/);
    expect(divider.className).toMatch(/\bsm:inline\b/);
    expect(divider.getAttribute('aria-hidden')).toBe('true');
  });

  test('los headline numbers (24 activos / 18 agentes) están en text-slate-100 font-semibold', () => {
    const data = {
      models: {
        a: { lifecycle: 'active' }, b: { lifecycle: 'active' },
        c: { lifecycle: 'active' }, d: { lifecycle: 'active' },
        e: { lifecycle: 'reference' },
      },
      roleMatrix: {
        'sdd-init': {}, 'sdd-explore': {}, 'sdd-archive': {},
        'sdd-design': {}, 'sdd-tasks': {}, 'sdd-apply': {},
        'sdd-verify': {}, 'sdd-onboard': {},
        'jd-judge-a': {}, 'jd-judge-b': {}, 'jd-fix-agent': {},
        'review-risk': {}, 'review-readability': {},
        'review-reliability': {}, 'review-resilience': {},
        'sdd-propose': {}, 'sdd-spec': {},
        'gentle-orchestrator': {},
      },
    };
    render(target, data);
    const headlines = target.querySelectorAll('[data-test="hero-stats-headline"]');
    // 1 por bloque (modelos y agentes) = 2 headlines.
    expect(headlines.length).toBe(2);
    headlines.forEach((h) => {
      expect(h.className).toMatch(/\btext-slate-100\b/);
      expect(h.className).toMatch(/\bfont-semibold\b/);
      // Es el <strong> del bloque, no un span genérico.
      expect(h.tagName.toLowerCase()).toBe('strong');
    });
    // Y los headlines son los números correctos: modelos=4, agentes=18.
    const modelsHeadline = target.querySelector('[data-test="hero-stats-models"] [data-test="hero-stats-headline"]');
    const agentsHeadline = target.querySelector('[data-test="hero-stats-agents"] [data-test="hero-stats-headline"]');
    expect(modelsHeadline.textContent.trim()).toBe('4');
    expect(agentsHeadline.textContent.trim()).toBe('18');
  });
});
