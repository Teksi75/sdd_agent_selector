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

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, resetForTests;

describe('pricing-chart — render() contract (spec.md)', () => {
  test('real dataset: only non-reference models rendered as bars', async () => {
    ({ render, resetForTests } = await import(
      '../js/components/pricing-chart.js'
    ));
    if (typeof resetForTests === 'function') resetForTests();

    const summary = render(target, MODELS);
    const bars = target.querySelectorAll('[data-model-key]');
    const keys = Array.from(bars).map((el) => el.getAttribute('data-model-key'));

    // Reference models (tier:reference OR isReference:true) must be excluded.
    expect(keys).not.toContain('opus48');
    expect(keys).not.toContain('gpt55');
    // Expected bar count is the non-reference subset of the current
    //   dataset — computed dynamically so the test stays correct when new
    //   models are added via sync / manual add without bumping this test.
    const expectedBars = Object.values(MODELS).filter(
      (m) => m.tier !== 'reference' && !m.isReference
    ).length;
    expect(keys.length).toBe(summary.bars);
    expect(summary.bars).toBe(expectedBars);
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
      .filter(([, m]) => m.tier !== 'reference' && !m.isReference)
      .map(([k, m]) => ({ k, c: costEstimate(m) }))
      .sort((a, b) => a.c - b.c);
    expect(rows[0].key).toBe(expectedAsc[0].k);
    expect(rows[rows.length - 1].key).toBe(expectedAsc[expectedAsc.length - 1].k);
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
