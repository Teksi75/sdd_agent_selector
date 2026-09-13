// @vitest-environment jsdom
// tests/aa-signal.test.js
//
// S3c (aa-only-scoring): finite II is the sole ranking predicate
// (design section 7 + risk table). The broad `aa-signal.js` helper stays
// in place as a catalog-signal utility, but ranked surfaces MUST NOT
// split by it: no Con-AA/Sin-AA sections, headers, or counts.
// II-less rows are hidden with the shared note (S3b hide rule).

import { describe, expect, test } from 'vitest';
import { hasAaSignal } from '../js/services/aa-signal.js';
import { render as renderRefTable } from '../js/components/ref-table.js';
import { render as renderCompositeChart } from '../js/components/composite-chart.js';

// Ranked fixture: hi/lo carry DIFFERENT broad AA signals (pricing vs
// evaluations) yet share one ranked table in II-desc order; nodata
// carries a broad signal but null II, so it stays hidden — signal is
// not coverage.
const RANKED_FIXTURE = {
  hi: {
    name: 'Hi',
    lifecycle: 'active',
    intelligenceIndex: 61.5,
    pricingSource: 'artificialanalysis',
    input: 2,
    output: 4,
    effort: 'high',
  },
  lo: {
    name: 'Lo',
    lifecycle: 'active',
    intelligenceIndex: 55.2,
    evaluations: { coding: 70 },
    input: 1,
    output: 2,
    effort: 'medium',
  },
  nodata: {
    name: 'NoData',
    lifecycle: 'active',
    intelligenceIndex: null,
    pricingSource: 'artificialanalysis',
    input: 0.5,
    output: 1,
    effort: 'low',
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

describe('AA signal is not a ranking predicate', () => {
  test('ref-table renders one ranked table: no Con-AA/Sin-AA sections, II-less hidden with shared note', () => {
    const target = document.createElement('div');
    const summary = renderRefTable(target, RANKED_FIXTURE, {
      modelsMeta: { lastSynced: '2026-09-13' },
    });

    expect(summary.rows).toBe(2);
    expect(summary.topKey).toBe('hi');
    // No broad-signal sections survive.
    expect(target.querySelector('[data-test="ref-table-with-aa"]')).toBeNull();
    expect(target.querySelector('[data-test="ref-table-without-aa"]')).toBeNull();
    expect(target.textContent).not.toMatch(/Con valoraci/);
    expect(target.textContent).not.toMatch(/Sin valoraci/);
    // Exactly one ranked table; II-desc order despite differing signals.
    expect(target.querySelectorAll('table').length).toBe(1);
    const keys = Array.from(target.querySelectorAll('tr[data-model-key]')).map((tr) =>
      tr.getAttribute('data-model-key')
    );
    expect(keys).toEqual(['hi', 'lo']);
    // Broad signal with null II stays hidden, with the shared note.
    expect(target.querySelector('[data-model-key="nodata"]')).toBeNull();
    expect(target.querySelector('[data-test="hidden-ii-note"]')).not.toBeNull();
    expect(target.textContent).toMatch(/1 models hidden/);
    expect(target.textContent).toMatch(/Artificial Analysis Intelligence Index/);
  });

  test('composite-chart renders one ranked bar list: no Con-AA/Sin-AA sections, II-less hidden with shared note', () => {
    const target = document.createElement('div');
    const summary = renderCompositeChart(target, RANKED_FIXTURE, {
      lastSynced: '2026-09-13',
    });

    expect(summary.scored).toBe(2);
    expect(summary.unavailable).toBe(1);
    expect(target.querySelector('[data-test="composite-with-aa"]')).toBeNull();
    expect(target.querySelector('[data-test="composite-without-aa"]')).toBeNull();
    expect(target.textContent).not.toMatch(/Con valoraci/);
    expect(target.textContent).not.toMatch(/Sin valoraci/);
    const keys = Array.from(target.querySelectorAll('[data-model-key]')).map((el) =>
      el.getAttribute('data-model-key')
    );
    expect(keys).toEqual(['hi', 'lo']);
    expect(target.querySelector('[data-model-key="nodata"]')).toBeNull();
    expect(target.querySelector('[data-test="hidden-ii-note"]')).not.toBeNull();
    expect(target.textContent).toMatch(/1 models hidden/);
  });

  test('TRIANGULATE: broad AA signal without finite II never ranks (signal is not coverage)', () => {
    const target = document.createElement('div');
    const models = {
      signalOnly: {
        name: 'Signal Only',
        lifecycle: 'active',
        intelligenceIndex: null,
        pricingSource: 'artificialanalysis',
        evaluations: { coding: 80 },
        codingIndex: 75.5,
        input: 1,
        output: 2,
      },
    };
    expect(hasAaSignal(models.signalOnly)).toBe(true);
    const summary = renderRefTable(target, models, {
      modelsMeta: { lastSynced: '2026-09-13' },
    });
    expect(summary.rows).toBe(0);
    expect(target.querySelector('[data-model-key="signalOnly"]')).toBeNull();
    expect(target.querySelector('[data-test="empty-state"]')).not.toBeNull();
  });
});
