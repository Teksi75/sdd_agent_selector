// @vitest-environment node
// tests/pricing-safety.test.js
// Phase 1 RED — strict TDD for the pure pricing-safety helpers.
//
// Goal: lock in the contract of `scripts/_pricing-safety.mjs` BEFORE
// the implementation exists. These tests MUST fail until the helper
// module is created and exports the documented functions.
//
// Source spec: sdd/fix-sync-scraper-corruption/spec
//   - null pricing fields never overwrite
//   - gpt54 output preserved on null parse
//   - parser sanity checks (null flagship output, inversion, non-positive,
//     >1000x prior)
//   - shouldUpdate falls back to _meta.lastSynced when per-model is absent
//   - fresh data is skipped

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const HELPERS_PATH = '../scripts/_pricing-safety.mjs';

describe('pricing-safety — buildDefinedPricePatch (RED)', () => {
  test('strips null/undefined values from the patch', async () => {
    const { buildDefinedPricePatch } = await import(HELPERS_PATH);
    const patch = buildDefinedPricePatch({ input: 2.5, output: null, cacheRead: undefined, name: 'gpt-5.4' });
    expect(patch).toEqual({ input: 2.5, name: 'gpt-5.4' });
    expect(patch).not.toHaveProperty('output');
    expect(patch).not.toHaveProperty('cacheRead');
  });

  test('returns an empty object when every field is null/undefined', async () => {
    const { buildDefinedPricePatch } = await import(HELPERS_PATH);
    expect(buildDefinedPricePatch({ input: null, output: undefined })).toEqual({});
  });

  test('does NOT include keys whose values are the literal string "null" or "" (only JS null/undefined are dropped)', async () => {
    const { buildDefinedPricePatch } = await import(HELPERS_PATH);
    const patch = buildDefinedPricePatch({ input: '0', output: '', cacheRead: 'null' });
    expect(patch).toEqual({ input: '0', output: '', cacheRead: 'null' });
  });
});

describe('pricing-safety — sanitizeOpenAiPricePatch (RED)', () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('warns + omits `output` on flagship gpt55 when parsed output is null', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.5', input: 5, output: null, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.5', output: 30, tier: 'reference', isReference: true };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt55');
    expect(patch).not.toHaveProperty('output');
    expect(patch.input).toBe(5);
    expect(patch.cacheRead).toBe(0.5);
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(msg).toMatch(/gpt55/);
    expect(msg).toMatch(/output/);
  });

  test('keeps `output` for non-flagship when parsed output is null (only flagship gating)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: null, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', output: 30 };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    // Non-flagship: null output is still dropped by buildDefinedPricePatch.
    expect(patch).not.toHaveProperty('output');
    expect(patch.input).toBe(5);
    expect(patch.cacheRead).toBe(0.5);
  });

  test('preserves gpt54 output when parsed value is null (no overwrite)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: null, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', output: 30, tier: 'reference' };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    // The patch itself does not carry `output`, so the merge will keep the prior.
    expect(patch).not.toHaveProperty('output');
    // Sanity: applying the patch to existing keeps output=30.
    const merged = { ...existing, ...patch };
    expect(merged.output).toBe(30);
  });

  test('warns + omits both input and output when parsed input > output (inversion)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 30, output: 5, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', input: 5, output: 30 };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    expect(patch).not.toHaveProperty('input');
    expect(patch).not.toHaveProperty('output');
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(msg).toMatch(/inversion|input>output/i);
  });

  test('warns + omits non-positive per-field (≤0)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 0, output: -1, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', input: 5, output: 30 };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    expect(patch).not.toHaveProperty('input');
    expect(patch).not.toHaveProperty('output');
    expect(patch.cacheRead).toBe(0.5);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('warns + omits field when parsed finite positive > 1000x prior finite positive', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: 5000, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', input: 5, output: 2 }; // prior output is small
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    expect(patch.input).toBe(5);
    expect(patch).not.toHaveProperty('output'); // 5000 > 1000 * 2 = 2000
    expect(warnSpy).toHaveBeenCalled();
    const msg = warnSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(msg).toMatch(/oversized|1000|outlier/i);
  });

  test('accepts parsed finite positive ≤ 1000x prior finite positive', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: 100, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', input: 5, output: 2 };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    expect(patch.input).toBe(5);
    expect(patch.output).toBe(100);
  });

  test('does NOT compare against prior when prior value is null/undefined/missing (no prior baseline)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: 50000, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4' }; // no prior output
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    // No prior baseline → oversized check is skipped, parsed value passes.
    expect(patch.output).toBe(50000);
  });

  test('omits `tier` from the patch (curated, not derived)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.4', input: 5, output: 30, cacheRead: 0.5 };
    const existing = { name: 'gpt-5.4', tier: 'reference' };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt54');
    expect(patch).not.toHaveProperty('tier');
  });

  test('omits `isReference` and `notes` from the patch (curated)', async () => {
    const { sanitizeOpenAiPricePatch } = await import(HELPERS_PATH);
    const parsed = { name: 'gpt-5.5', input: 5, output: 30, cacheRead: 0.5, tier: 'high', isReference: false, notes: 'oops' };
    const existing = { name: 'gpt-5.5', tier: 'reference', isReference: true, notes: 'curated' };
    const patch = sanitizeOpenAiPricePatch(parsed, existing, 'gpt55');
    expect(patch).not.toHaveProperty('tier');
    expect(patch).not.toHaveProperty('isReference');
    expect(patch).not.toHaveProperty('notes');
  });
});

describe('pricing-safety — shouldUpdate (RED)', () => {
  test('returns true when model is missing', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    expect(shouldUpdate(undefined, undefined, new Date('2026-07-18'))).toBe(true);
  });

  test('returns true when model has no lastSynced (first-time insert)', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    expect(shouldUpdate({ name: 'gpt-5.5' }, undefined, new Date('2026-07-18'))).toBe(true);
  });

  test('falls back to meta.lastSynced when model lacks lastSynced', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    const today = new Date('2026-07-18T00:00:00Z');
    // Model record has no lastSynced, meta says last synced 20 days ago → stale.
    const meta = { lastSynced: '2026-06-28' };
    const model = { name: 'gpt-5.5' };
    expect(shouldUpdate(model, meta, today)).toBe(true);
  });

  test('uses meta.lastSynced and skips when meta is fresh (≤ threshold days)', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    const today = new Date('2026-07-18T00:00:00Z');
    const meta = { lastSynced: '2026-07-15' }; // 3 days ago, default threshold 5
    const model = { name: 'gpt-5.5' }; // no per-model lastSynced
    expect(shouldUpdate(model, meta, today)).toBe(false);
  });

  test('prefers model.lastSynced when present', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    const today = new Date('2026-07-18T00:00:00Z');
    const meta = { lastSynced: '2026-06-01' }; // stale
    const model = { name: 'gpt-5.5', lastSynced: '2026-07-17' }; // fresh
    expect(shouldUpdate(model, meta, today)).toBe(false);
  });

  test('returns true when lastSynced is malformed (defensive)', async () => {
    const { shouldUpdate } = await import(HELPERS_PATH);
    const today = new Date('2026-07-18T00:00:00Z');
    expect(shouldUpdate({ lastSynced: 'not-a-date' }, undefined, today)).toBe(true);
  });
});
