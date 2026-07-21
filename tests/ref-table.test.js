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
  test('includes all models; non-active rows in separated section after active rows', () => {
    const summary = render(target, FIXTURE);
    // 3 active + 2 non-active = 5 rows.
    expect(summary.rows).toBe(5);

    const activeRows = Array.from(target.querySelectorAll('[data-test="active-rows"] tr'));
    const activeKeys = activeRows.map((tr) => tr.getAttribute('data-model-key'));
    expect(activeKeys).toEqual(['alpha', 'beta', 'pending']);

    const nonActiveSection = target.querySelector('[data-test="non-active-rows"]');
    expect(nonActiveSection, 'non-active section missing').toBeDefined();
    const nonActiveKeys = Array.from(nonActiveSection.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(nonActiveKeys).toEqual(['delta', 'gamma']);
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
    // Columns: Modelo, Tier, Lifecycle, Score, BenchLM, Input $, Output $, Sources = 8.
    const ths = target.querySelectorAll('thead th');
    expect(ths.length).toBe(8);
    // Specific columns present.
    const labels = Array.from(ths).map((th) => th.textContent.trim());
    expect(labels).toContain('Modelo');
    expect(labels).toContain('Tier');
    expect(labels).toContain('Lifecycle');
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

describe('ref-table — reference display order and legacy filtering', () => {
  const CATALOG_FIXTURE = {
    glm52: {
      name: 'GLM-5.2',
      tier: 'high',
      lifecycle: 'active',
      benchlm: { score: 63.96, verified: false, reliability: 0.63, categories: {} },
      input: 1.4,
      output: 4.4,
    },
    gpt56sol: {
      name: 'GPT-5.6 Sol',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 81.96, verified: true, reliability: 0.75, categories: {} },
      input: 5,
      output: 30,
      isNew: true,
    },
    opus48: {
      name: 'Claude Opus 4.8',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 78.34, verified: true, reliability: 0.63, categories: {} },
      input: 5,
      output: 25,
    },
    gpt55: {
      name: 'gpt-5.5',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 73.51, verified: false, reliability: 0.88, categories: {} },
      input: 5,
      output: 30,
    },
    gpt56terra: {
      name: 'GPT-5.6 Terra',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 72.57, verified: false, reliability: 0.75, categories: {} },
      input: 2.5,
      output: 15,
      isNew: true,
    },
    gpt56luna: {
      name: 'GPT-5.6 Luna',
      tier: 'budget',
      lifecycle: 'reference',
      isReference: true,
      benchlm: { score: 67.17, verified: false, reliability: 0.5, categories: {} },
      input: 1,
      output: 6,
    },
    glm51: {
      name: 'GLM-5.1',
      tier: 'high',
      lifecycle: 'legacy',
      benchlm: { score: 67.74, verified: true, reliability: 0.5, categories: {} },
      input: 1.4,
      output: 4.4,
    },
    glm5: {
      name: 'GLM-5',
      tier: 'budget',
      lifecycle: 'legacy',
      benchlm: { score: 66.06, verified: true, reliability: 0.88, categories: {} },
      input: 1,
      output: 3.2,
    },
  };

  test('visible non-active keys are exactly [gpt56sol, opus48, gpt56terra, gpt56luna, gpt55] in that order', () => {
    render(target, CATALOG_FIXTURE);
    const nonActiveSection = target.querySelector('[data-test="non-active-rows"]');
    const nonActiveKeys = Array.from(nonActiveSection.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(nonActiveKeys).toEqual(['gpt56sol', 'opus48', 'gpt56terra', 'gpt56luna', 'gpt55']);
  });

  test('legacy rows (glm51, glm5) do not render', () => {
    render(target, CATALOG_FIXTURE);
    const allKeys = Array.from(target.querySelectorAll('tr[data-model-key]')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(allKeys).not.toContain('glm51');
    expect(allKeys).not.toContain('glm5');
  });

  test('active rows remain before reference rows', () => {
    render(target, CATALOG_FIXTURE);
    const activeRows = Array.from(target.querySelectorAll('[data-test="active-rows"] tr'));
    const nonActiveSection = target.querySelector('[data-test="non-active-rows"]');
    const nonActiveRows = Array.from(nonActiveSection.querySelectorAll('tr'));
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].getAttribute('data-model-key')).toBe('glm52');
    expect(nonActiveRows.length).toBe(5);
  });

  test('summary visible non-active count reflects five reference rows, not seven total non-active records', () => {
    const summary = render(target, CATALOG_FIXTURE);
    expect(summary.rows).toBe(6);
    const summaryText = target.querySelector('p.mt-3').textContent;
    expect(summaryText).toMatch(/\+ 5 non-active/);
    expect(summaryText).not.toMatch(/\+ 7 non-active/);
  });

  test('preserve score/tier/lifecycle rendering for visible reference rows', () => {
    render(target, CATALOG_FIXTURE);
    const gpt56sol = target.querySelector('tr[data-model-key="gpt56sol"]');
    expect(gpt56sol.textContent).toMatch(/82\.0/);
    expect(gpt56sol.textContent).toMatch(/REFERENCE/);
    expect(gpt56sol.getAttribute('data-lifecycle')).toBe('reference');

    const opus48 = target.querySelector('tr[data-model-key="opus48"]');
    expect(opus48.textContent).toMatch(/78\.3/);
    expect(opus48.textContent).toMatch(/REFERENCE/);

    const gpt55 = target.querySelector('tr[data-model-key="gpt55"]');
    expect(gpt55.textContent).toMatch(/73\.5/);
    expect(gpt55.textContent).toMatch(/REFERENCE/);
  });
});
