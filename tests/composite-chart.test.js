// tests/composite-chart.test.js
// PR3 (benchlm-replace-custom-scoring) — composite-chart rendering
// against the new `benchlm.{score, verified, reliability}` shape per
// spec benchlm-rendering. The chart MUST:
//   - render verified (green) / estimated (amber) badges
//   - render a 5-dot reliability scale (floor(reliability*5) filled)
//   - render an "unavailable" placeholder (no bar fill) for null scores
//   - sort: scored rows descending, unavailable rows AFTER all scored
//   - show a "BenchLM stale" freshness badge when lastRun > 7d
//   - include reference-tier models (with numeric BenchLM scores) in the chart

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

describe('composite-chart — render() contract (PR3 benchlm-rendering)', () => {
  test('(a) verified models show a green badge, estimated show an amber badge', async () => {
    ({ render, resetForTests } = await import('../js/components/composite-chart.js'));
    if (typeof resetForTests === 'function') resetForTests();

    const FIXTURE = {
      v: {
        name: 'Verified',
        benchlm: { score: 85, verified: true, reliability: 0.92, categories: {} },
        tier: 'high',
      },
      e: {
        name: 'Estimated',
        benchlm: { score: 70, verified: false, reliability: 0.75, categories: {} },
        tier: 'balanced',
      },
    };
    render(target, FIXTURE);

    const verifiedRow = Array.from(target.querySelectorAll('[data-model-key]')).find(
      (el) => el.getAttribute('data-model-key') === 'v'
    );
    const estimatedRow = Array.from(target.querySelectorAll('[data-model-key]')).find(
      (el) => el.getAttribute('data-model-key') === 'e'
    );

    expect(verifiedRow, 'verified row missing').toBeDefined();
    expect(estimatedRow, 'estimated row missing').toBeDefined();

    expect(verifiedRow.getAttribute('data-verified')).toBe('true');
    expect(verifiedRow.getAttribute('data-reliability')).toBe('0.92');
    expect(verifiedRow.innerHTML).toMatch(/verified/i);

    expect(estimatedRow.getAttribute('data-verified')).toBe('false');
    expect(estimatedRow.getAttribute('data-reliability')).toBe('0.75');
    expect(estimatedRow.innerHTML).toMatch(/estimated/i);
  });

  test('(b) reliability renders floor(reliability * 5) filled dots in a 5-dot scale', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      r4: {
        name: 'R-0.92',
        benchlm: { score: 80, verified: true, reliability: 0.92, categories: {} },
        tier: 'high',
      },
      r1: {
        name: 'R-0.4',
        benchlm: { score: 70, verified: true, reliability: 0.4, categories: {} },
        tier: 'balanced',
      },
    };
    render(target, FIXTURE);

    const r4 = target.querySelector('[data-model-key="r4"] [data-reliability-dots]');
    const r1 = target.querySelector('[data-model-key="r1"] [data-reliability-dots]');

    expect(r4, 'r4 dot scale missing').toBeDefined();
    expect(r1, 'r1 dot scale missing').toBeDefined();

    const filled4 = r4.querySelectorAll('[data-dot="filled"]').length;
    const filled1 = r1.querySelectorAll('[data-dot="filled"]').length;

    // floor(0.92 * 5) = 4 → 4 filled, 1 empty
    expect(filled4).toBe(4);
    // floor(0.4 * 5) = 2 → 2 filled, 3 empty
    expect(filled1).toBe(2);
  });

  test('(c) unavailable placeholder: null score row has NO bar fill + "unavailable" label', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      ok: {
        name: 'OK-Model',
        benchlm: { score: 78.3, verified: true, reliability: 0.9, categories: {} },
        tier: 'high',
      },
      pending: {
        // score is null sentinel → no bar
        name: 'Pending-Model',
        benchlm: { score: null, verified: false, reliability: 0, categories: {} },
        tier: 'balanced',
      },
      noblock: {
        // no benchlm at all → also unavailable
        name: 'No-Block',
        tier: 'balanced',
      },
    };
    const summary = render(target, FIXTURE);
    // All three rows render (scored + unavailable combined).
    expect(summary.scored + summary.unavailable).toBe(3);

    const pendingRow = target.querySelector('[data-model-key="pending"]');
    expect(pendingRow, 'pending row missing').toBeDefined();
    expect(pendingRow.getAttribute('data-unavailable')).toBe('true');
    // No bar fill on the unavailable row.
    expect(pendingRow.querySelector('.bar-fill')).toBeNull();
    // The unavailable placeholder label is shown.
    expect(pendingRow.textContent).toMatch(/unavailable/i);

    const noblockRow = target.querySelector('[data-model-key="noblock"]');
    expect(noblockRow.getAttribute('data-unavailable')).toBe('true');

    // The OK row DOES have a bar fill.
    const okRow = target.querySelector('[data-model-key="ok"]');
    expect(okRow.querySelector('.bar-fill')).not.toBeNull();
  });

  test('(d) scored rows sort descending; unavailable rows appended AFTER all scored', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      a: { benchlm: { score: 90, verified: true, reliability: 0.9 }, tier: 'high' },
      b: { benchlm: { score: 60, verified: true, reliability: 0.9 }, tier: 'high' },
      c: { benchlm: { score: null, verified: false, reliability: 0 }, tier: 'balanced' }, // unavailable
      d: { benchlm: { score: 75, verified: true, reliability: 0.9 }, tier: 'high' },
      e: { tier: 'balanced' }, // no benchlm → unavailable
    };
    render(target, FIXTURE);
    const bars = Array.from(target.querySelectorAll('[data-model-key]'));
    const keys = bars.map((el) => el.getAttribute('data-model-key'));
    // Scored: a (90), d (75), b (60) — descending.
    // Unavailable: c, e — appended after.
    expect(keys).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  test('(e) freshness: when _meta.scrapers.benchlm.lastRun > 7 days ago, show "BenchLM stale" badge', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      m: { benchlm: { score: 80, verified: true, reliability: 0.9 }, tier: 'high' },
    };
    const staleLastRun = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    render(target, FIXTURE, { scrapers: { benchlm: { lastRun: staleLastRun } } });
    const staleBadge = target.querySelector('[data-test="benchlm-stale"]');
    expect(staleBadge, 'BenchLM stale badge missing').toBeDefined();
    expect(staleBadge.textContent).toMatch(/stale/i);
  });

  test('(e2) freshness: when lastRun is fresh (< 7 days), no stale badge', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      m: { benchlm: { score: 80, verified: true, reliability: 0.9 }, tier: 'high' },
    };
    const freshLastRun = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    render(target, FIXTURE, { scrapers: { benchlm: { lastRun: freshLastRun } } });
    const staleBadge = target.querySelector('[data-test="benchlm-stale"]');
    expect(staleBadge).toBeNull();
  });

  test('allowlisted reference models (Sol, Terra, Luna) appear in main bars; other non-active excluded', async () => {
    ({ render, resetForTests } = await import('../js/components/composite-chart.js'));
    if (typeof resetForTests === 'function') resetForTests();

    render(target, MODELS);

    const mainBars = Array.from(target.querySelectorAll('[data-test="composite-bars"] [data-model-key]'));
    const mainKeys = mainBars.map((el) => el.getAttribute('data-model-key'));

    expect(mainKeys).toContain('gpt56sol');
    expect(mainKeys).toContain('gpt56terra');
    expect(mainKeys).toContain('gpt56luna');

    expect(mainKeys).not.toContain('opus48');
    expect(mainKeys).not.toContain('gpt55');
    expect(mainKeys).not.toContain('glm5');
    expect(mainKeys).not.toContain('glm51');

    const nonActiveSection = target.querySelector('[data-test="non-active-catalog"]');
    expect(nonActiveSection).toBeNull();
  });

  test('Sol, Terra, Luna render with exact displayed scores 82.0, 72.6, 67.2', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    render(target, MODELS);

    const solRow = target.querySelector('[data-test="composite-bars"] [data-model-key="gpt56sol"]');
    const terraRow = target.querySelector('[data-test="composite-bars"] [data-model-key="gpt56terra"]');
    const lunaRow = target.querySelector('[data-test="composite-bars"] [data-model-key="gpt56luna"]');

    expect(solRow).toBeDefined();
    expect(terraRow).toBeDefined();
    expect(lunaRow).toBeDefined();

    expect(Number(solRow.getAttribute('data-score'))).toBeCloseTo(82.0, 1);
    expect(Number(terraRow.getAttribute('data-score'))).toBeCloseTo(72.6, 1);
    expect(Number(lunaRow.getAttribute('data-score'))).toBeCloseTo(67.2, 1);
  });

  test('no Reference / Legacy catalog section exists in Composite output', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    render(target, MODELS);

    expect(target.querySelector('[data-test="non-active-catalog"]')).toBeNull();
    expect(target.querySelector('[data-test="non-active-rows"]')).toBeNull();
    expect(target.textContent).not.toMatch(/Reference \/ Legacy catalog/);
    expect(target.querySelectorAll('[data-non-active="true"]').length).toBe(0);
  });

  test('main ranking sort is descending by score; allowlisted reference models interleaved by score', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const FIXTURE = {
      low: { benchlm: { score: 60, verified: true, reliability: 0.9 }, tier: 'budget', lifecycle: 'active' },
      gpt56sol: {
        name: 'GPT-5.6 Sol',
        benchlm: { score: 95, verified: true, reliability: 0.95 },
        tier: 'reference',
        lifecycle: 'reference',
        isReference: true,
        input: 5,
      },
      mid: { benchlm: { score: 75, verified: true, reliability: 0.9 }, tier: 'balanced', lifecycle: 'active' },
      opus48: {
        name: 'Opus',
        benchlm: { score: 99, verified: true, reliability: 0.95 },
        tier: 'reference',
        lifecycle: 'reference',
        isReference: true,
      },
    };
    render(target, FIXTURE);
    const mainKeys = Array.from(target.querySelectorAll('[data-test="composite-bars"] [data-model-key]')).map(
      (el) => el.getAttribute('data-model-key')
    );
    expect(mainKeys).toEqual(['gpt56sol', 'mid', 'low']);
    expect(mainKeys).not.toContain('opus48');
  });

  test('fixture: 5 active + 1 non-allowlisted reference → 5 main bars, reference excluded entirely', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));

    const FIXTURE = {
      m_high:    { name: 'High',     benchlm: { score: 90, verified: true, reliability: 0.95 }, tier: 'high', lifecycle: 'active' },
      m_bal:     { name: 'Balanced', benchlm: { score: 70, verified: true, reliability: 0.85 }, tier: 'balanced', lifecycle: 'active' },
      m_low:     { name: 'Low',      benchlm: { score: 50, verified: false, reliability: 0.7 }, tier: 'balanced', lifecycle: 'active' },
      m_amber:   { name: 'Amber',    benchlm: { score: 65, verified: false, reliability: 0.6 }, tier: 'high', lifecycle: 'active' },
      m_swe:     { name: 'Top',      benchlm: { score: 85, verified: true, reliability: 0.9 }, tier: 'high', lifecycle: 'active' },
      m_ref: {
        name: 'Reference-Model',
        benchlm: { score: 99, verified: true, reliability: 0.99 },
        tier: 'reference',
        lifecycle: 'reference',
        isReference: true,
      },
    };

    const summary = render(target, FIXTURE);
    const mainRows = target.querySelectorAll('[data-test="composite-bars"] [data-model-key]');
    expect(mainRows.length).toBe(5);
    expect(target.querySelector('[data-test="non-active-catalog"]')).toBeNull();

    const scores = Array.from(mainRows)
      .map((el) => Number(el.getAttribute('data-score')))
      .filter((n) => Number.isFinite(n));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  test('empty dataset → empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const summary = render(target, {});
    expect(summary.scored + summary.unavailable).toBe(0);
    expect(target.querySelectorAll('[data-model-key]').length).toBe(0);
    expect(target.textContent).toMatch(/No hay modelos|No model/i);
  });

  test('null dataset → empty-state card, no bars', async () => {
    ({ render } = await import('../js/components/composite-chart.js'));
    const summary = render(target, null);
    expect(summary.scored + summary.unavailable).toBe(0);
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
        benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
        tier: 'high',
      },
    };
    render(target, evil);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });
});
