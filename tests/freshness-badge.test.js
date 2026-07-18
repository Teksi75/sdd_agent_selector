// tests/freshness-badge.test.js
// Phase 2e — freshness-badge TDD (jsdom). Asserts the spec scenarios
// from spec.md "UI Component - Freshness Badge":
//   - render(targetEl, meta) — rioplatense Spanish age label
//   - "hoy" / "hace 1 día" / "hace N días"
//   - warning banner when staleness > 7 days
//   - refresh button present (placeholder handler for Phase 3)
//
// Pure-function helpers (ageLabel, daysOld, formatDateEs, buildBadge)
// are tested directly so jsdom DOM noise is kept to a minimum.

import { describe, test, expect, beforeEach } from 'vitest';

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, ageLabel, daysOld, formatDateEs, buildBadge;

describe('freshness-badge — pure helpers', () => {
  test('ageLabel: 0 → "hoy", 1 → "hace 1 día", N>=2 → "hace N días"', async () => {
    ({ ageLabel } = await import('../js/components/freshness-badge.js'));
    expect(ageLabel(0)).toBe('hoy');
    expect(ageLabel(1)).toBe('hace 1 día');
    expect(ageLabel(2)).toBe('hace 2 días');
    expect(ageLabel(15)).toBe('hace 15 días');
  });

  test('daysOld: same-day → 0, one-day-before → 1, malformed → 0', async () => {
    ({ daysOld } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    expect(daysOld('2026-07-04', now)).toBe(0);
    expect(daysOld('2026-07-03', now)).toBe(1);
    expect(daysOld('2026-06-20', now)).toBe(14);
    // Malformed input returns 0 (defensive — never throws inside render).
    expect(daysOld('not-a-date', now)).toBe(0);
    expect(daysOld(null, now)).toBe(0);
  });

  test('daysOld: UTC-straddle near midnight (UTC-negative zone) → 1, not 0', async () => {
    ({ daysOld } = await import('../js/components/freshness-badge.js'));
    // 2026-07-19T01:00:00Z == 2026-07-18T22:00 ART in America/Buenos_Aires.
    // The pre-fix local-getter bug returned 0 here because local date was
    // still the 18th. UTC-aware date math must report 1 full UTC day elapsed.
    const now = new Date('2026-07-19T01:00:00Z');
    expect(daysOld('2026-07-18', now)).toBe(1);
  });

  test('daysOld: accepts `now` as an ISO string and returns the same value as a Date', async () => {
    ({ daysOld } = await import('../js/components/freshness-badge.js'));
    const nowDate = new Date('2026-07-19T01:00:00Z');
    const nowIso = '2026-07-19T01:00:00Z';
    expect(daysOld('2026-07-18', nowIso)).toBe(daysOld('2026-07-18', nowDate));
    expect(daysOld('2026-07-18', nowIso)).toBe(1);
    expect(daysOld('2026-07-04', '2026-07-04T23:59:59Z')).toBe(0);
  });

  test('daysOld: invalid ISO-string `now` falls back to current Date without throwing', async () => {
    ({ daysOld } = await import('../js/components/freshness-badge.js'));
    // Should not throw — production callers rely on never-crashing render paths.
    // With the invalid `now`, the function falls back to `new Date()` so the
    // returned value is whatever the current UTC day delta is (>= 0).
    const out = daysOld('2026-07-04', 'not-a-real-iso-string');
    expect(Number.isInteger(out)).toBe(true);
    expect(out).toBeGreaterThanOrEqual(0);
  });

  test('formatDateEs: ISO → DD/MM/YYYY', async () => {
    ({ formatDateEs } = await import('../js/components/freshness-badge.js'));
    expect(formatDateEs('2026-07-04')).toBe('04/07/2026');
    expect(formatDateEs('2026-01-09')).toBe('09/01/2026');
    expect(formatDateEs('not-a-date')).toBe('—');
    expect(formatDateEs(null)).toBe('—');
  });

  test('buildBadge: today renders "hoy" and no warning banner', async () => {
    ({ buildBadge } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    const out = buildBadge('2026-07-04', { now });
    expect(out.daysOld).toBe(0);
    expect(out.warning).toBe(false);
    // The date appears wrapped in a <span>; assert the date string is present
    // (not the literal "Datos del <date>" because HTML markup sits in between).
    expect(out.html).toMatch(/04\/07\/2026/);
    expect(out.html).toMatch(/Datos del/);
    expect(out.html).toMatch(/hoy/);
    expect(out.html).not.toMatch(/freshness-warning/);
    expect(out.html).toMatch(/data-action="refresh"/);
  });

  test('buildBadge: 1-day-old renders "hace 1 día"', async () => {
    ({ buildBadge } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    const out = buildBadge('2026-07-03', { now });
    expect(out.daysOld).toBe(1);
    expect(out.warning).toBe(false);
    expect(out.html).toMatch(/hace 1 día/);
  });

  test('buildBadge: 5-day-old renders "hace 5 días" (still under threshold)', async () => {
    ({ buildBadge } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    const out = buildBadge('2026-06-29', { now });
    expect(out.daysOld).toBe(5);
    expect(out.warning).toBe(false);
    expect(out.html).toMatch(/hace 5 días/);
    expect(out.html).not.toMatch(/freshness-warning/);
  });

  test('buildBadge: 8-day-old triggers warning banner (>7 days)', async () => {
    ({ buildBadge } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    const out = buildBadge('2026-06-26', { now });
    expect(out.daysOld).toBe(8);
    expect(out.warning).toBe(true);
    expect(out.html).toMatch(/freshness-warning/);
    expect(out.html).toMatch(/Los benchmarks tienen m.*s de 7 d.*as/);
  });
});

describe('freshness-badge — render() mount contract', () => {
  test('render(target, meta) mounts badge + refresh button into the DOM', async () => {
    ({ render } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    const summary = render(target, { lastSynced: '2026-07-04' }, { now });
    expect(summary.mounted).toBe(true);
    expect(summary.daysOld).toBe(0);
    expect(target.querySelector('[data-test="freshness-badge"]')).toBeDefined();
    expect(target.querySelector('button[data-action="refresh"]')).toBeDefined();
  });

  test('render() with onRefresh wires button click → handler', async () => {
    ({ render } = await import('../js/components/freshness-badge.js'));
    let clicked = 0;
    render(target, { lastSynced: '2026-07-04' }, { onRefresh: () => clicked++ });
    const btn = target.querySelector('button[data-action="refresh"]');
    btn.click();
    btn.click();
    expect(clicked).toBe(2);
  });

  test('>7 days renders warning banner into the DOM', async () => {
    ({ render } = await import('../js/components/freshness-badge.js'));
    const now = new Date('2026-07-04T12:00:00Z');
    render(target, { lastSynced: '2026-06-20' }, { now });
    expect(target.querySelector('[data-test="freshness-warning"]')).toBeDefined();
    expect(target.textContent).toMatch(/Verific.*manualmente/i);
  });
});