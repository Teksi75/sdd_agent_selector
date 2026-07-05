// tests/ref-table.test.js
// Phase 1 — pilot section. Verifies the ref-table component's behavior:
//   - excludes reference-tier models
//   - sorts by composite score descending
//   - shows the right column count
//   - returns a summary object (rows, topKey, referenceModel)
//
// The component mutates the supplied targetEl, so we use jsdom (vitest
// environment) and a fresh <div> per test to keep tests isolated.

import { describe, test, expect, beforeEach } from 'vitest';
import { render } from '../js/components/ref-table.js';

// Minimal 3-model fixture: 2 active + 1 reference. Composite scores are
//   designed so the sort order is unambiguous (a > b > null).
//
// Note on scoring math (compositeScore in model-scorer.js):
//   arena 1500 → 88.2 (normalized against 1700 ceiling)
//   When the model is missing one of {swePro, term} the remaining weights
//     are renormalized to 1.0 — a model that ONLY has arena gets a 100%
//     weighted arena score.
// Therefore for the sort to be deterministic in tests, we use arena values
//   that are far apart AND make the full-benchmark model clearly dominant.
const FIXTURE = {
  alpha: {
    name: 'Alpha-1',
    arena: 1500,
    swePro: 80.0,
    sweVer: 85.0,
    term: 80.0,
    input: 1.00,
    output: 3.00,
    tier: 'high',
  },
  beta: {
    name: 'Beta-2',
    arena: 1000, // low arena so beta's lone-arena score is ~58.8, clearly
                 //   below alpha's full-benchmark score of ~84.4.
    input: 0.50,
    output: 2.00,
    tier: 'balanced',
    isNew: true,
  },
  gamma: {
    name: 'Gamma-Reference',
    arena: 1700,
    swePro: 75.0,
    input: 5.00,
    output: 25.00,
    tier: 'reference',
    isReference: true,
  },
  // Tierless but isReference flag — must also be excluded.
  delta: {
    name: 'Delta-Flagged-Reference',
    arena: 1690,
    input: 4.00,
    output: 20.00,
    isReference: true,
  },
};

let target;

beforeEach(() => {
  target = document.createElement('div');
  target.id = 'ref-table-mount';
  document.body.appendChild(target);
});

describe('ref-table — render()', () => {
  test('includes reference-tier models at the bottom of the visible rows', () => {
    const summary = render(target, FIXTURE);
    // Now includes ALL models (active + reference). 2 active + 2 reference = 4.
    expect(summary.rows).toBe(4);
    const tbody = target.querySelector('tbody');
    expect(tbody).not.toBeNull();
    const visibleKeys = Array.from(tbody.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(visibleKeys).toContain('alpha');
    expect(visibleKeys).toContain('beta');
    expect(visibleKeys).toContain('gamma');   // reference - now visible
    expect(visibleKeys).toContain('delta');   // reference - now visible
    // Reference rows sink to the bottom of the table (active rows above),
    // sorted among themselves by composite score desc (delta > gamma: delta
    // has only arena=1690 → score=100 after clamp, gamma has arena=1700 +
    // swePro=75 → redistributed score≈88; arena-only models win the
    // reference-tier sort because their single-benchmark score is the max
    // of the [0,100] clamp).
    expect(visibleKeys.slice(0, 2)).toEqual(['alpha', 'beta']);
    expect(visibleKeys.indexOf('delta')).toBeLessThan(visibleKeys.indexOf('gamma'));
    expect(visibleKeys.slice(2)).toEqual(['delta', 'gamma']);
  });

  test('sorts active rows by composite score descending, references last', () => {
    const summary = render(target, FIXTURE);
    const tbody = target.querySelector('tbody');
    const keys = Array.from(tbody.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    // alpha (full benchmarks) should beat beta (arena-only) because
    //   alpha's composite score includes swePro + term on top of arena.
    expect(keys[0]).toBe('alpha');
    expect(keys[1]).toBe('beta');
    expect(summary.topKey).toBe('alpha');
  });

  test('renders the expected 10 columns (name, tier, score, 4 benchmarks, 2 prices, sources)', () => {
    render(target, FIXTURE);
    const ths = target.querySelectorAll('thead th');
    expect(ths.length).toBe(10);
  });

  test('returns a summary with referenceModel when present', () => {
    const summary = render(target, FIXTURE);
    expect(summary.referenceModel).not.toBeNull();
    expect(summary.referenceModel.name).toBe('Gamma-Reference');
  });

  test('renders an empty-state card when models is empty', () => {
    const summary = render(target, {});
    expect(summary.rows).toBe(0);
    expect(summary.topKey).toBeNull();
    expect(target.querySelector('tbody')).toBeNull();
    expect(target.textContent).toMatch(/No non-reference models/);
  });

  test('renders an empty-state card when models is null', () => {
    const summary = render(target, null);
    expect(summary.rows).toBe(0);
    expect(target.textContent).toMatch(/No model data available/);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', () => {
    expect(() => render(null, FIXTURE)).toThrow(TypeError);
    expect(() => render({}, FIXTURE)).toThrow(TypeError);
  });

  test('shows a NEW badge for isNew: true models', () => {
    render(target, FIXTURE);
    const html = target.innerHTML;
    expect(html).toMatch(/src-new/);
  });

  test('escapes user-controlled strings in model names', () => {
    const evil = {
      x: {
        name: '<img src=x onerror=alert(1)>',
        arena: 1500,
        input: 1,
        output: 2,
        tier: 'high',
      },
    };
    render(target, evil);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });
});
