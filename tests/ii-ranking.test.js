// tests/ii-ranking.test.js
// S3b task 5.4 — shared II ranking context (RED-first).

import { describe, test, expect } from 'vitest';
import { resolveIiFreshness, buildIiRankingContext, formatHiddenIiNote } from '../js/services/ii-ranking.js';

describe('ii-ranking — scope isolation (TRIANGULATE 5.4)', () => {
  test('full-catalog scope builds its own context, never reuses filtered count', async () => {
    const { buildIiRankingContext } = await import('../js/services/ii-ranking.js');
    const filtered = { a: { lifecycle: 'active', intelligenceIndex: 10 }, b: { lifecycle: 'active', intelligenceIndex: null } };
    const full = { a: { lifecycle: 'active', intelligenceIndex: 10 }, b: { lifecycle: 'active', intelligenceIndex: null }, c: { lifecycle: 'active', intelligenceIndex: null } };
    const meta = { lastSynced: '2026-09-13' };
    const fCtx = buildIiRankingContext(filtered, meta);
    const cCtx = buildIiRankingContext(full, meta);
    expect(fCtx.hiddenCount).toBe(1);
    expect(cCtx.hiddenCount).toBe(2);
    expect(cCtx.hiddenCount).not.toBe(fCtx.hiddenCount);
  });
});

describe('ii-ranking — resolveIiFreshness', () => {
  test('AA lastRun wins over lastSynced', () => {
    const meta = { lastSynced: '2026-09-10', scrapers: { 'scrape-artificialanalysis': { lastRun: '2026-09-13T03:53:18.345Z' } } };
    expect(resolveIiFreshness(meta)).toBe('2026-09-13');
  });
  test('falls back to lastSynced when AA lastRun absent', () => {
    expect(resolveIiFreshness({ lastSynced: '2026-09-10' })).toBe('2026-09-10');
  });
});

describe('ii-ranking — buildIiRankingContext', () => {
  test('candidate=active only; ranked=finite II; hidden=null II; non-candidates never counted', () => {
    const models = {
      a: { lifecycle: 'active', intelligenceIndex: 42.3 },
      b: { lifecycle: 'active', intelligenceIndex: null },
      r: { lifecycle: 'reference', intelligenceIndex: 99 },
    };
    const meta = { lastSynced: '2026-09-13' };
    const ctx = buildIiRankingContext(models, meta);
    expect(ctx.ranked.map(([k]) => k)).toEqual(['a']);
    expect(ctx.hidden.map(([k]) => k)).toEqual(['b']);
    expect(ctx.hiddenCount).toBe(1);
    expect(ctx.asOfDate).toBe('2026-09-13');
  });
});

describe('ii-ranking — formatHiddenIiNote', () => {
  test('N>0 renders shared note; N=0 empty', () => {
    expect(formatHiddenIiNote(2, '2026-09-13')).toBe('2 models hidden — no Artificial Analysis Intelligence Index on 2026-09-13');
    expect(formatHiddenIiNote(0, '2026-09-13')).toBe('');
  });
});
