// @vitest-environment node
// tests/aa-effort.test.js
// Catalog schema-4 and GPT-5.6 Luna consolidation contract for PR3A.

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const raw = JSON.parse(readFileSync(join(ROOT, 'data', 'models.json'), 'utf-8'));
const models = raw.models;

describe('AA effort catalog: schema 4 consolidation (PR3A)', () => {
  test('declares catalog schema version 4', () => {
    expect(raw._meta.schemaVersion).toBe(4);
  });

  test('uses gpt56luna as the sole canonical max-effort entry', () => {
    expect(models.gpt56lunaMax).toBeUndefined();
    expect(models.gpt56luna).toBeDefined();
    expect(models.gpt56luna.effort).toBe('max');
    expect(models.gpt56luna.name).toBe('GPT-5.6 Luna');
  });

  test('preserves the provisional BenchLM observation and family ordering', () => {
    const luna = models.gpt56luna;
    const sol = models.gpt56sol;

    expect(luna.benchlm).toMatchObject({
      score: 67.17,
      verified: false,
      evidence: 'estimated',
    });
    expect(sol.benchlm.verified).toBe(true);
    expect(sol.benchlm.score).toBe(81.96);
    expect(luna.benchlm.score).toBeLessThan(sol.benchlm.score);
  });

  test('adopts AA pricing and preserves both benchmark sources', () => {
    const luna = models.gpt56luna;

    expect(luna.input).toBe(0.2);
    expect(luna.output).toBe(1.2);
    expect(luna.blended).toBe(0.45);
    expect(luna.pricingSource).toBe('artificialanalysis');
    expect(luna.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: expect.stringContaining('benchlm.ai') }),
      expect.objectContaining({ url: expect.stringContaining('artificialanalysis.ai') }),
    ]));
    expect(luna.cacheRead).toBeUndefined();
    expect(luna.cacheWrite).toBeUndefined();
  });

  test('keeps the curated lifecycle semantics and documents the consolidation', () => {
    const luna = models.gpt56luna;

    expect(luna.tier).toBe('budget');
    expect(luna.lifecycle).toBe('active');
    expect(luna.isNew).toBeUndefined();
    expect(luna.notes).toMatch(/consolidat/i);
    expect(luna.notes).toMatch(/artificial analysis/i);
  });
});
