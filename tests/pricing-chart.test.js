// tests/pricing-chart.test.js
// Phase 2d — pricing-chart TDD (jsdom). Asserts the spec scenarios from
// spec.md "UI Component - Pricing Chart". Imports declared at the bottom.

import { describe, test, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MODELS = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8')).models;

import { isActive } from '../js/services/model-scorer.js';

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, resetForTests;

// Test-local mirror of the pricing-chart dedup contract: one row per
// (model family, displayed cost). Family = name without a trailing
// "(...)" qualifier, matched case/hyphen/whitespace insensitively.
function testFamilyKey(name, key) {
  const base = String(name ?? key).replace(/\s*\(.*\)\s*$/, '').trim() || String(key);
  return base.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function testCost(m) {
  const i = Number.isFinite(m.input) ? m.input : 0;
  const o = Number.isFinite(m.output) ? m.output : 0;
  return (i / 1e6) * 1000 + (o / 1e6) * 500;
}

function isBareName(name, key) {
  return !/\s*\(.*\)\s*$/.test(String(name ?? key));
}

/** Keys surviving the same-cost variant collapse (bare name preferred), in ascending-cost order. */
function expectedDedupedSortedKeys(models, costFn = testCost) {
  const sorted = Object.entries(models)
    .filter(([, m]) => m && isActive(m))
    .map(([k, m]) => ({ k, m, c: costFn(m) }))
    .sort((a, b) => {
      if (a.c !== b.c) return a.c - b.c;
      const ai = Number.isFinite(a.m?.input) ? a.m.input : Infinity;
      const bi = Number.isFinite(b.m?.input) ? b.m.input : Infinity;
      return ai - bi;
    });
  const seen = new Map();
  const order = [];
  for (const { k, m, c } of sorted) {
    const g = `${testFamilyKey(m.name, k)}|${c.toFixed(6)}`;
    if (!seen.has(g)) {
      seen.set(g, k);
      order.push(g);
      continue;
    }
    const keptBare = isBareName(models[seen.get(g)]?.name, seen.get(g));
    if (!keptBare && isBareName(m?.name, k)) seen.set(g, k);
  }
  return order.map((g) => seen.get(g));
}

describe('pricing-chart — render() contract (spec.md)', () => {
  test('real dataset: only non-reference models rendered as bars', async () => {
    ({ render, resetForTests } = await import(
      '../js/components/pricing-chart.js'
    ));
    if (typeof resetForTests === 'function') resetForTests();

    const summary = render(target, MODELS);
    const bars = target.querySelectorAll('[data-model-key]');
    const keys = Array.from(bars).map((el) => el.getAttribute('data-model-key'));

    // Non-active models (reference, legacy, benchmark-only) must be excluded.
    expect(keys).not.toContain('opus48');
    expect(keys).not.toContain('gpt55');
    expect(keys).not.toContain('glm5');
    expect(keys).not.toContain('glm51');
    // Expected bar count is one row per (model family, displayed cost):
    // same-cost effort variants collapse (e.g. the six "GPT-5.6 Luna*"
    // records render a single bar). Computed dynamically so the test stays
    // correct when new models are added via sync / manual add.
    const expectedBars = expectedDedupedSortedKeys(MODELS).length;
    expect(keys.length).toBe(summary.bars);
    expect(summary.bars).toBe(expectedBars);
    // User-facing contract: Luna renders once, under its bare name.
    expect(keys).toContain('gpt56luna');
    expect(keys).not.toContain('gpt56lunaXhigh');
    expect(keys).not.toContain('gpt56lunaHigh');
    expect(keys).not.toContain('gpt56lunaMedium');
    expect(keys).not.toContain('gpt56lunaLow');
    expect(keys).not.toContain('gpt56lunaNonReasoning');
  });

  test('real dataset: bars sorted by costEstimate ascending (cheapest first)', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const { costEstimate } = await import('../js/services/model-scorer.js');

    render(target, MODELS);
    const bars = Array.from(target.querySelectorAll('[data-model-key]'));
    const rows = bars.map((el) => {
      const key = el.getAttribute('data-model-key');
      return { key, cost: costEstimate(MODELS[key]) };
    });
    // Each consecutive pair must be non-decreasing.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].cost).toBeLessThanOrEqual(rows[i].cost);
    }
    // Top bar = cheapest in dataset, bottom bar = most expensive non-reference.
    const expectedAsc = Object.entries(MODELS)
      .filter(([, m]) => isActive(m))
      .map(([k, m]) => ({ k, c: costEstimate(m) }))
      .sort((a, b) => a.c - b.c);
    // Dedup-aware endpoints: one surviving key per (family, cost),
    // bare name preferred — order follows the same ascending sort.
    const expectedDeduped = expectedDedupedSortedKeys(MODELS, costEstimate);
    expect(rows[0].key).toBe(expectedDeduped[0]);
    expect(rows[rows.length - 1].key).toBe(expectedDeduped[expectedDeduped.length - 1]);
  });

  test('minimal fixture: 5 + 1 reference -> 5 bars ascending; cost $0.00028', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));

    // m_cheap = $0.00028 exactly (matches spec scenario MiMo V2.5 default:
    //   input 0.14/1e6*1000 + output 0.28/1e6*500 = 0.00014 + 0.00014).
    const FIXTURE = {
      m_cheap: { name: 'Cheap-Model', arena: 1500, swePro: 50, term: 60, input: 0.14, output: 0.28, tier: 'budget' },
      m_bal:   { name: 'Bal-Model',   arena: 1500, swePro: 50, term: 60, input: 1.40, output: 4.40, tier: 'balanced' },
      m_high:  { name: 'High-Model',  arena: 1500, swePro: 50, term: 60, input: 2.50, output: 7.50, tier: 'high' },
      m_mid:   { name: 'Mid-Model',   arena: 1500, swePro: 50, term: 60, input: 0.30, output: 1.20, tier: 'balanced' },
      m_pricy: { name: 'Pricy-Model', arena: 1500, swePro: 50, term: 60, input: 5.00, output: 25.00, tier: 'high' },
      m_ref: { name: 'Reference-Model', arena: 1800, swePro: 95, term: 95, input: 5, output: 25, tier: 'reference', isReference: true },
    };

    const summary = render(target, FIXTURE);
    const bars = Array.from(target.querySelectorAll('[data-model-key]'));
    const order = bars.map((el) => el.getAttribute('data-model-key'));

    expect(bars.length).toBe(5);
    expect(summary.bars).toBe(5);
    expect(order).not.toContain('m_ref');

    const { costEstimate } = await import('../js/services/model-scorer.js');
    const expected = Object.entries(FIXTURE)
      .filter(([, m]) => m.tier !== 'reference' && !m.isReference)
      .map(([k, m]) => [k, costEstimate(m)])
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    expect(order).toEqual(expected);

    // Spec scenario: cost formatted as USD currency, cheapest = $0.00028.
    expect(target.innerHTML).toMatch(/\$0\.00028/);
    expect(order[0]).toBe('m_cheap');
  });

  test('every bar shows the model name and a USD currency label with 4 decimals', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));

    const FIXTURE = {
      a: { name: 'A-Model', arena: 1500, swePro: 70, term: 75, input: 1, output: 3, tier: 'high' },
      b: { name: 'B-Model', arena: 1450, swePro: 65, term: 70, input: 0.14, output: 0.28, tier: 'budget' },
    };
    render(target, FIXTURE);
    const html = target.innerHTML;
    expect(html).toMatch(/A-Model/);
    expect(html).toMatch(/B-Model/);
    // Cost label matches the spec "Cost formatted as currency" scenario —
    // a USD prefix plus at least 4 decimal places (5+ for costs like $0.00028).
    expect(html).toMatch(/\$\d+\.\d{4,}/);
  });

  test('empty dataset -> empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const summary = render(target, {});
    expect(summary.bars).toBe(0);
    expect(target.querySelectorAll('[data-model-key]').length).toBe(0);
    expect(target.textContent).toMatch(/No hay modelos|No model/i);
  });

  test('null dataset -> empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const summary = render(target, null);
    expect(summary.bars).toBe(0);
    expect(target.querySelectorAll('[data-model-key]').length).toBe(0);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    expect(() => render(null, MODELS)).toThrow(TypeError);
    expect(() => render({}, MODELS)).toThrow(TypeError);
  });

  test('escapes user-controlled strings in model names', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const evil = {
      x: {
        name: '<img src=x onerror=alert(1)>',
        arena: 1500, swePro: 70, term: 75,
        input: 1, output: 3,
        tier: 'high',
      },
    };
    render(target, evil);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });
});

// V5 Slice 3 — eligible-only rendering + empty-state label.
describe('pricing-chart — V5 Slice 3 eligible-only', () => {
  test('rinde solo el set elegible recibido (sin barras fuera del set)', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      a: { name: 'A', tier: 'high', input: 1, output: 3, lifecycle: 'active' },
      b: { name: 'B', tier: 'balanced', input: 0.5, output: 1, lifecycle: 'active' },
      c: { name: 'C', tier: 'budget', input: 0.1, output: 0.2, lifecycle: 'active' },
    };
    render(target, { a: FIXTURE.a, b: FIXTURE.b });
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(keys.sort()).toEqual(['a', 'b']);
    expect(target.querySelector('[data-model-key="c"]')).toBeNull();
  });

  test('set elegible vacío: empty-state label dedicado, cero barras', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const summary = render(target, {});
    expect(summary.bars).toBe(0);
    const empty = target.querySelector('[data-test="empty-state"]');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toMatch(/No hay modelos elegibles/i);
  });
});

// Same-cost effort variants collapse to a single row per model family.
describe('pricing-chart - same-cost variant dedup (one row per model)', () => {
  test('same-cost effort variants collapse to the bare family row (Luna case)', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      luna: { name: 'GPT-5.6 Luna', input: 0.2, output: 1.2, tier: 'budget' },
      lunaXhigh: { name: 'GPT-5.6 Luna (xhigh)', input: 0.2, output: 1.2, tier: 'budget' },
      lunaHigh: { name: 'GPT-5.6 Luna (high)', input: 0.2, output: 1.2, tier: 'budget' },
      lunaMedium: { name: 'GPT-5.6 Luna (medium)', input: 0.2, output: 1.2, tier: 'budget' },
      lunaLow: { name: 'GPT-5.6 Luna (low)', input: 0.2, output: 1.2, tier: 'budget' },
      lunaNonReasoning: { name: 'GPT-5.6 Luna (Non-reasoning)', input: 0.2, output: 1.2, tier: 'budget' },
    };
    const summary = render(target, FIXTURE);
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(summary.bars).toBe(1);
    expect(keys).toEqual(['luna']);
    expect(target.innerHTML).toMatch(/GPT-5\.6 Luna/);
    expect(target.innerHTML).not.toMatch(/\(xhigh\)/);
    expect(target.innerHTML).not.toMatch(/\(Non-reasoning\)/);
    expect(target.innerHTML).toMatch(/\$0\.0008/);
  });

  test('a variant with a genuinely different cost keeps its own row', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      flash: { name: 'DeepSeek V4 Flash', input: 0.44, output: 1.32, tier: 'budget' },
      flashPeak: { name: 'DeepSeek V4 Flash (Peak)', input: 0.44, output: 1.32, tier: 'budget' },
      flashOffPeak: { name: 'DeepSeek V4 Flash (Off-Peak)', input: 0.22, output: 0.66, tier: 'budget' },
      flashNonReasoning: { name: 'DeepSeek V4 Flash (Non-reasoning)', input: 0.14, output: 0.28, tier: 'budget' },
    };
    const summary = render(target, FIXTURE);
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(summary.bars).toBe(3);
    expect(keys).toContain('flash');
    expect(keys).toContain('flashOffPeak');
    expect(keys).toContain('flashNonReasoning');
    expect(keys).not.toContain('flashPeak');
  });

  test('different models sharing one price are NOT collapsed', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      m3: { name: 'MiniMax M3', input: 0.3, output: 1.2, tier: 'balanced' },
      m27: { name: 'MiniMax M2.7', input: 0.3, output: 1.2, tier: 'budget' },
    };
    const summary = render(target, FIXTURE);
    expect(summary.bars).toBe(2);
    expect(target.querySelector('[data-model-key="m3"]')).not.toBeNull();
    expect(target.querySelector('[data-model-key="m27"]')).not.toBeNull();
  });

  test('bare name wins even when a variant sorts first on the cost tie-break', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    // Same total cost ($0.0025) but the variant has the lower input
    // price, so ascending sort sees it first. The bare row must survive.
    const FIXTURE = {
      base: { name: 'TestModel', input: 2, output: 1, tier: 'balanced' },
      variant: { name: 'TestModel (xhigh)', input: 0.5, output: 4, tier: 'balanced' },
    };
    const summary = render(target, FIXTURE);
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(summary.bars).toBe(1);
    expect(keys).toEqual(['base']);
  });

  test('rows show vendor per-1M rates as subtitle', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      a: { name: 'A', input: 1.4, output: 4.4, tier: 'balanced' },
      b: { name: 'B', input: 0.14, output: 0.28, tier: 'budget' },
    };
    render(target, FIXTURE);
    const rows = target.querySelectorAll('[data-model-key]');
    const byKey = {};
    rows.forEach((el) => { byKey[el.getAttribute('data-model-key')] = el; });
    expect(byKey.a.textContent).toContain('$1.4 in / $4.4 out por 1M');
    expect(byKey.b.textContent).toContain('$0.14 in / $0.28 out por 1M');
  });

  test('rows without vendor rates render no subtitle', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      n: { name: 'N', tier: 'balanced' },
    };
    render(target, FIXTURE);
    const row = target.querySelector('[data-model-key]');
    expect(row.querySelector('[data-test="per-1m-rates"]')).toBeNull();
  });

  test('family match ignores case and hyphens', async () => {
    ({ render } = await import('../js/components/pricing-chart.js'));
    const FIXTURE = {
      pro: { name: 'MiMo V2.5 Pro', input: 0.435, output: 0.87, tier: 'high' },
      proNonReasoning: { name: 'MiMo-V2.5-Pro (Non-reasoning)', input: 0.435, output: 0.87, tier: 'high' },
    };
    const summary = render(target, FIXTURE);
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(summary.bars).toBe(1);
    expect(keys).toEqual(['pro']);
  });
});
