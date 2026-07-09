// tests/composite-chart.test.js
// Phase 2c — composite-chart TDD (jsdom). Asserts the spec scenarios from
// spec.md "UI Component - Composite Chart":
//   - Reference models excluded
//   - Bars sorted by composite score descending
//   - Function signature: render(targetEl, models)
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

let target;

beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, resetForTests;

describe('composite-chart — render() contract (spec.md)', () => {
  test('real dataset: only non-reference models rendered as bars', async () => {
    ({ render, resetForTests } = await import(
      '../js/components/composite-chart.js'
    ));
    if (typeof resetForTests === 'function') resetForTests();

    const summary = render(target, MODELS);
    const bars = target.querySelectorAll('[data-model-key]');
    const keys = Array.from(bars).map((el) => el.getAttribute('data-model-key'));

    // Reference models (tier:reference OR isReference:true) must be excluded.
    expect(keys).not.toContain('opus48');
    expect(keys).not.toContain('gpt55');
    // The expected bar count is the non-reference subset of the current
    //   dataset — computed dynamically so the test stays correct when new
    //   models are added via sync / manual add without bumping this test.
    const expectedBars = Object.values(MODELS).filter(
      (m) => m.tier !== 'reference' && !m.isReference
    ).length;
    expect(keys.length).toBe(summary.bars);
    expect(summary.bars).toBe(expectedBars);
  });

  test('real dataset: bars sorted by compositeScore descending', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const { compositeScore } = await import('../js/services/model-scorer.js');

    render(target, MODELS);
    const bars = Array.from(target.querySelectorAll('[data-model-key]'));
    const scores = bars.map((el) => {
      const key = el.getAttribute('data-model-key');
      return { key, score: compositeScore(MODELS[key]) };
    });
    // Each consecutive pair must be non-increasing.
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
    }
    // And the top bar must equal the maximum score in the dataset.
    const maxKey = Object.entries(MODELS)
      .filter(([, m]) => m.tier !== 'reference' && !m.isReference)
      .map(([k, m]) => ({ k, s: compositeScore(m) }))
      .sort((a, b) => b.s - a.s)[0].k;
    expect(scores[0].key).toBe(maxKey);
  });

  test('minimal fixture: 5 active models + 1 reference → 5 bars (descending)', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));

    // 5 active models with clearly separated composite scores so the
    // sort order is unambiguous. Plus 1 reference that must NOT appear.
    const FIXTURE = {
      m_high:   { name: 'High-Model',   arena: 1600, swePro: 75, term: 80, input: 1, output: 3, tier: 'high' },
      m_bal:    { name: 'Bal-Model',    arena: 1500, swePro: 60, term: 65, input: 1, output: 3, tier: 'balanced' },
      m_low:    { name: 'Low-Model',    arena: 1400, swePro: 45, term: 50, input: 1, output: 3, tier: 'balanced' },
      m_arena_only: { name: 'Arena-Only', arena: 1700, input: 1, output: 3, tier: 'high' },
      m_swe_only:   { name: 'SWE-Only',   swePro: 90, input: 1, output: 3, tier: 'high' },
      m_ref: {
        name: 'Reference-Model',
        arena: 1800, swePro: 95, term: 95,
        input: 5, output: 25,
        tier: 'reference',
        isReference: true,
      },
    };

    const summary = render(target, FIXTURE);
    const bars = Array.from(target.querySelectorAll('[data-model-key]'));
    const order = bars.map((el) => el.getAttribute('data-model-key'));

    expect(bars.length).toBe(5);
    expect(summary.bars).toBe(5);
    expect(order).not.toContain('m_ref');

    // Order must be descending by composite score — recompute it from
    // compositeScore so the test asserts the spec, not an implementation detail.
    const { compositeScore } = await import('../js/services/model-scorer.js');
    const expected = Object.entries(FIXTURE)
      .filter(([, m]) => m.tier !== 'reference' && !m.isReference)
      .map(([k, m]) => [k, compositeScore(m)])
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    expect(order).toEqual(expected);
  });

  test('every bar shows the model name and a numeric score', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));

    const FIXTURE = {
      a: { name: 'A-Model', arena: 1500, swePro: 70, term: 75, input: 1, output: 3, tier: 'high' },
      b: { name: 'B-Model', arena: 1450, swePro: 65, term: 70, input: 1, output: 3, tier: 'balanced' },
    };
    render(target, FIXTURE);
    const html = target.innerHTML;
    expect(html).toMatch(/A-Model/);
    expect(html).toMatch(/B-Model/);
    // Each bar should carry a numeric score (the chart formats compositeScore to 1 decimal).
    expect(html).toMatch(/\b\d{2,3}\.\d/);
  });

  test('empty dataset → empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const summary = render(target, {});
    expect(summary.bars).toBe(0);
    expect(target.querySelectorAll('[data-model-key]').length).toBe(0);
    expect(target.textContent).toMatch(/No hay modelos|No model/i);
  });

  test('null dataset → empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const summary = render(target, null);
    expect(summary.bars).toBe(0);
    expect(target.querySelectorAll('[data-model-key]').length).toBe(0);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    expect(() => render(null, MODELS)).toThrow(TypeError);
    expect(() => render({}, MODELS)).toThrow(TypeError);
  });

  test('escapes user-controlled strings in model names', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
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
