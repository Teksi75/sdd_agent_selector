// @vitest-environment jsdom
// tests/aa-signal.test.js

import { describe, expect, test } from 'vitest';
import { hasAaSignal } from '../js/services/aa-signal.js';
import { render as renderRefTable } from '../js/components/ref-table.js';
import { render as renderCompositeChart } from '../js/components/composite-chart.js';

const FIXTURE = {
  aaPricing: {
    name: 'AA Pricing Only',
    pricingSource: 'artificialanalysis',
    benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    input: 1,
    output: 2,
    tier: 'balanced',
  },
  aaEvaluations: {
    name: 'AA Evaluations',
    evaluations: { coding: 70 },
    benchlm: { score: 72, verified: false, reliability: 0.4, categories: {} },
    input: 2,
    output: 6,
    tier: 'high',
  },
  noAa: {
    name: 'No AA',
    benchlm: { score: 65, verified: true, reliability: 0.8, categories: {} },
    input: 0.5,
    output: 1.5,
    tier: 'budget',
  },
};

describe('AA signal helper', () => {
  test('detects broad Artificial Analysis signals', () => {
    expect(hasAaSignal({ pricingSource: 'artificialanalysis' })).toBe(true);
    expect(hasAaSignal({ evaluations: [{ id: 'coding' }] })).toBe(true);
    expect(hasAaSignal({ evaluations: { coding: 72 } })).toBe(true);
    expect(hasAaSignal({ codingIndex: 68.8 })).toBe(true);
    expect(hasAaSignal({ mathIndex: 90 })).toBe(true);
    expect(hasAaSignal({ term: 77.9 })).toBe(true);
    expect(hasAaSignal({ outputTokensPerSecond: 133.05 })).toBe(true);
    expect(hasAaSignal({ timeToFirstTokenSeconds: 0.898 })).toBe(true);
    expect(hasAaSignal({ timeToFirstAnswerTokenSeconds: 15.93 })).toBe(true);
  });

  test('rejects empty or non-finite AA-looking fields', () => {
    expect(hasAaSignal(null)).toBe(false);
    expect(hasAaSignal({})).toBe(false);
    expect(hasAaSignal({ evaluations: [] })).toBe(false);
    expect(hasAaSignal({ evaluations: {} })).toBe(false);
    expect(hasAaSignal({ codingIndex: null, mathIndex: Number.NaN })).toBe(false);
    expect(hasAaSignal({ pricingSource: 'manual-curation' })).toBe(false);
  });
});

describe('AA split render sections', () => {
  test('ref-table renders collapsible Con-AA and Sin-AA sections', () => {
    const target = document.createElement('div');
    const summary = renderRefTable(target, FIXTURE);

    expect(summary.rows).toBe(3);
    expect(target.querySelector('[data-test="ref-table-with-aa"]')).not.toBeNull();
    expect(target.querySelector('[data-test="ref-table-without-aa"]')).not.toBeNull();
    expect(target.textContent).toContain('Con valoración en AA');
    expect(target.textContent).toContain('Sin valoración en AA');
    expect(target.querySelectorAll('[data-test="ref-table-with-aa"] [data-model-key]').length).toBe(2);
    expect(target.querySelectorAll('[data-test="ref-table-without-aa"] [data-model-key]').length).toBe(1);
  });

  test('composite-chart renders collapsible Con-AA and Sin-AA sections', () => {
    const target = document.createElement('div');
    const summary = renderCompositeChart(target, FIXTURE);

    expect(summary.scored + summary.unavailable).toBe(3);
    expect(target.querySelector('[data-test="composite-with-aa"]')).not.toBeNull();
    expect(target.querySelector('[data-test="composite-without-aa"]')).not.toBeNull();
    expect(target.textContent).toContain('Con valoración en AA');
    expect(target.textContent).toContain('Sin valoración en AA');
    expect(target.querySelectorAll('[data-test="composite-with-aa"] [data-model-key]').length).toBe(2);
    expect(target.querySelectorAll('[data-test="composite-without-aa"] [data-model-key]').length).toBe(1);
  });
});
