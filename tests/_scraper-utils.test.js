// @vitest-environment node
// tests/_scraper-utils.test.js
// Phase 1 RED — strict TDD for `_meta.sources` append-only migration in
// `scripts/_scraper-utils.mjs::writeModelsJson`.
//
// Spec: sdd/fix-sync-scraper-corruption/spec — "_meta.source Append":
//   - append each scraper run's source tag to `_meta.sources` (array)
//   - dedupe while preserving history
//   - migrate legacy `_meta.source` (string) into `_meta.sources` on first write
//   - always emit plural; never emit legacy `_meta.source`

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir;
let tempFile;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'scraper-utils-test-'));
  tempFile = join(tempDir, 'models.json');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function seedDoc(meta) {
  writeFileSync(
    tempFile,
    JSON.stringify({ _meta: meta, models: { foo: { name: 'foo' } } }, null, 2),
    'utf-8'
  );
}

describe('writeModelsJson — _meta.sources migration (RED)', () => {
  test('migrates legacy `_meta.source` (string) into `_meta.sources` (array) on first write', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({ lastSynced: '2026-07-16', source: 'scrape-glm-blog', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-openai-pricing');
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual([
      'scrape-glm-blog',
      'scrape-openai-pricing',
    ]);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('appends to existing `_meta.sources` array on subsequent writes', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({
      lastSynced: '2026-07-16',
      sources: ['scrape-glm-blog', 'scrape-openai-pricing'],
      schemaVersion: 1,
    });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-anthropic-pricing');
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual([
      'scrape-glm-blog',
      'scrape-openai-pricing',
      'scrape-anthropic-pricing',
    ]);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('dedupes when the same tag is written twice (history preserved, no duplicates)', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({
      lastSynced: '2026-07-16',
      sources: ['scrape-glm-blog', 'scrape-openai-pricing'],
      schemaVersion: 1,
    });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-openai-pricing'); // duplicate of index 1
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['scrape-glm-blog', 'scrape-openai-pricing']);
  });

  test('falls back to `auto-sync` when no sourceTag is provided AND no prior provenance exists', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({ lastSynced: '2026-07-16', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, undefined);
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['auto-sync']);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('always emits plural `_meta.sources` array, never singular `_meta.source`', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({ lastSynced: '2026-07-16', source: 'old-string', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'new-tag');
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(Array.isArray(result._meta.sources)).toBe(true);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('preserves lastSynced + nextSync + schemaVersion alongside the migrated sources', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({ lastSynced: '2026-07-16', source: 'old', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'new-tag');
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(typeof result._meta.lastSynced).toBe('string');
    expect(typeof result._meta.nextSync).toBe('string');
    expect(result._meta.schemaVersion).toBe(1);
    expect(result._meta.sources).toContain('old');
    expect(result._meta.sources).toContain('new-tag');
  });

  test('append-only: three sequential writes grow the array monotonically (no history lost)', async () => {
    const { readModelsJson, writeModelsJson } = await import('../scripts/_scraper-utils.mjs');
    seedDoc({ lastSynced: '2026-07-16', schemaVersion: 1 });
    let doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'a');
    doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'b');
    doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'c');
    const result = JSON.parse(readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['a', 'b', 'c']);
    expect(result._meta).not.toHaveProperty('source');
  });
});
