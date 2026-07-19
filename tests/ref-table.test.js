// tests/ref-table.test.js
// PR3 (benchlm-replace-custom-scoring) — ref-table cutover.
//
// Post-PR3 contract:
//   - Columns: name, tier, score, verified badge, reliability, input $,
//     output $, sources. Legacy 4-benchmark columns (arena / SWE-Pro /
//     SWE-Ver / Term) REMOVED.
//   - Score comes from benchlm.score; null is rendered as "—".
//   - Verified badge column reflects benchlm.verified (green / amber).
//   - Reliability column shows floor(reliability*5) filled dots (5-dot
//     scale per design).
//   - Source-badges cell still carries the inputs/outputs and NEW flag.
//   - Reference-tier models still sink to the bottom; sort still
//     descending by score; null scores rendered inline with "—".

import { describe, test, expect, beforeEach } from 'vitest';
import { render } from '../js/components/ref-table.js';

// Mixed-fixture: verified + estimated + unavailable + reference. Score
// ordering is clear: alpha (verified 85) > beta (estimated 65) >
// placeholder (null). Reference row delta also surfaces a score.
const FIXTURE = {
  alpha: {
    name: 'Alpha-1',
    tier: 'high',
    benchlm: { score: 85, verified: true, reliability: 0.92, categories: {} },
    input: 1.00,
    output: 3.00,
  },
  beta: {
    name: 'Beta-2',
    tier: 'balanced',
    benchlm: { score: 65, verified: false, reliability: 0.7, categories: {} },
    input: 0.50,
    output: 2.00,
    isNew: true,
  },
  pending: {
    name: 'Pending',
    tier: 'balanced',
    benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    input: 1.0,
    output: 2.0,
  },
  gamma: {
    name: 'Gamma-Reference',
    benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
    input: 5.00,
    output: 25.00,
    tier: 'reference',
    isReference: true,
  },
  // isReference flag without tier=reference — also excluded from active pool.
  // Higher benchlm.score than gamma so it sorts first within references
  // (matches the legacy V3 baseline-comparison intent).
  delta: {
    name: 'Delta-Flagged-Reference',
    benchlm: { score: 97, verified: true, reliability: 0.9, categories: {} },
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

describe('ref-table — render() (PR3 benchlm columns)', () => {
  test('includes all models; reference rows still sink to the bottom', () => {
    const summary = render(target, FIXTURE);
    // 3 active + 2 reference = 5 rows.
    expect(summary.rows).toBe(5);

    const tbody = target.querySelector('tbody');
    const visibleKeys = Array.from(tbody.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(visibleKeys).toContain('alpha');
    expect(visibleKeys).toContain('beta');
    expect(visibleKeys).toContain('pending');
    expect(visibleKeys).toContain('gamma');
    expect(visibleKeys).toContain('delta');

    // Active (non-reference) rows are first; reference rows last.
    expect(visibleKeys.slice(0, 3)).toEqual(['alpha', 'beta', 'pending']);
    expect(visibleKeys.slice(3)).toEqual(['delta', 'gamma']);
  });

  test('(d) scored rows sort by benchlm.score descending; references last', () => {
    const summary = render(target, FIXTURE);
    const tbody = target.querySelector('tbody');
    const keys = Array.from(tbody.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(keys[0]).toBe('alpha');     // 85
    expect(keys[1]).toBe('beta');      // 65
    expect(keys[2]).toBe('pending');   // null (unavailable)
    expect(summary.topKey).toBe('alpha');
  });

  test('(a) row shows benchlm score column; NO legacy 4-benchmark columns', () => {
    render(target, FIXTURE);
    // PR3 columns: Modelo, Tier, Score, BenchLM, Input $, Output $, Sources = 7.
    const ths = target.querySelectorAll('thead th');
    expect(ths.length).toBe(7);
    // Specific columns present.
    const labels = Array.from(ths).map((th) => th.textContent.trim());
    expect(labels).toContain('Modelo');
    expect(labels).toContain('Tier');
    expect(labels).toContain('Score');
    expect(labels).toContain('BenchLM');
    // Legacy columns gone.
    expect(labels).not.toContain('Arena');
    expect(labels).not.toContain('SWE-Pro');
    expect(labels).not.toContain('SWE-Ver');
    expect(labels).not.toContain('Term');

    // The alpha row scores match the data.
    const alpha = target.querySelector('tr[data-model-key="alpha"]');
    expect(alpha.textContent).toMatch(/85/);

    // No SWE-Pro/SWE-Ver/Term cells in the row body.
    expect(alpha.textContent).not.toMatch(/SWE-Pro/);
    expect(alpha.textContent).not.toMatch(/SWE-Ver/);
  });

  test('(b) verified badge column renders green for verified and amber for estimated', () => {
    render(target, FIXTURE);
    const alpha = target.querySelector('tr[data-model-key="alpha"]');
    const beta = target.querySelector('tr[data-model-key="beta"]');

    expect(alpha.innerHTML).toMatch(/data-badge="verified"/);
    expect(beta.innerHTML).toMatch(/data-badge="estimated"/);
    expect(alpha.innerHTML).toMatch(/bg-emerald/);
    expect(beta.innerHTML).toMatch(/bg-amber/);
  });

  test('(c) reliability column shows scaled indicator (5-dot scale)', () => {
    render(target, FIXTURE);
    const alpha = target.querySelector('tr[data-model-key="alpha"]');
    // floor(0.92 * 5) = 4 filled dots.
    const filled = alpha.querySelectorAll('[data-dot="filled"]').length;
    expect(filled).toBe(4);

    const beta = target.querySelector('tr[data-model-key="beta"]');
    // floor(0.7 * 5) = 3 filled dots.
    const filledBeta = beta.querySelectorAll('[data-dot="filled"]').length;
    expect(filledBeta).toBe(3);
  });

  test('null benchlm.score renders "—" in the score column (no number, no badge)', () => {
    render(target, FIXTURE);
    const pending = target.querySelector('tr[data-model-key="pending"]');
    // No "verified"/"estimated" badge text on a null-score row.
    expect(pending.querySelector('[data-badge="verified"]')).toBeNull();
    expect(pending.querySelector('[data-badge="estimated"]')).toBeNull();
    // Score cell shows em-dash.
    expect(pending.textContent).toMatch(/—/);
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
    expect(target.textContent).toMatch(/No non-reference models|No model data/i);
  });

  test('renders an empty-state card when models is null', () => {
    const summary = render(target, null);
    expect(summary.rows).toBe(0);
    expect(summary.topKey).toBeNull();
    expect(target.textContent).toMatch(/No model data available|No data/i);
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
        tier: 'high',
        benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
        input: 1,
        output: 2,
      },
    };
    render(target, evil);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });
});
