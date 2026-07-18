// @vitest-environment node
// tests/_scraper-utils.test.js
// Combined test suite for scripts/_scraper-utils.mjs::writeModelsJson.
//
// Block 1 (atomic write semantics) — added in PR #22 / commit 35abae7
//   "benchlm-replace-custom-scoring: atomic write helper + BenchLM scraper".
//   Covers tmp + renameSync, EXDEV fallback, stale-tmp cleanup.
//
// Block 2 (_meta.sources append-only migration) — added in PR #20
//   "fix(scraper): harden pricing scrapers against field corruption".
//   Covers legacy string → array migration, dedupe, fallback, monotonic growth.

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import {
  readModelsJson,
  writeModelsJson,
  _setFsForTesting,
  _resetFsForTesting,
} from '../scripts/_scraper-utils.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — atomic write semantics
// ─────────────────────────────────────────────────────────────────────────────

let tmpDir;
let targetPath;
const TARGET_NAME = 'models.json';

beforeEach(() => {
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'scraper-utils-test-'));
  targetPath = join(tmpDir, TARGET_NAME);
});

afterEach(() => {
  // Always restore the real fs even if a test threw mid-mock.
  _resetFsForTesting();
  if (tmpDir && fsImpl.existsSync(tmpDir)) {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeDoc(score = 50) {
  return {
    _meta: {},
    models: {
      foo: {
        name: 'Foo',
        tier: 'high',
        benchlm: { score, verified: true, reliability: 0.5, categories: {} },
      },
    },
  };
}

/** List leftover `<basename>.*.tmp` files in the target's directory. */
function listTmpFiles(dir, base) {
  if (!fsImpl.existsSync(dir)) return [];
  return fsImpl.readdirSync(dir).filter((f) => f.startsWith(base + '.') && f.endsWith('.tmp'));
}

/** Parse the `<base>.<pid>.<ts>.tmp` filename pattern. */
function isOurTmpPath(p, base) {
  const name = basename(String(p));
  if (!name.startsWith(base + '.')) return false;
  if (!name.endsWith('.tmp')) return false;
  const middle = name.slice(base.length + 1, -'.tmp'.length);
  return /^\d+\.\d+$/.test(middle);
}

describe('writeModelsJson — atomic write', () => {
  test('success: writeModelsJson writes via tmp + renameSync, no .tmp residue', () => {
    const renameSpy = vi.fn(fsImpl.renameSync);
    const mockFs = { ...fsImpl, renameSync: renameSpy };
    _setFsForTesting(mockFs);

    writeModelsJson(targetPath, makeDoc(78.3), 'scrape-benchlm-test');

    // (a) renameSync was called with src=tmp, dst=target.
    expect(renameSpy).toHaveBeenCalled();
    const [src, dst] = renameSpy.mock.calls[0];
    expect(isOurTmpPath(src, TARGET_NAME)).toBe(true);
    expect(dst).toBe(targetPath);

    // (a) no tmp residue after success.
    expect(listTmpFiles(tmpDir, TARGET_NAME)).toEqual([]);

    // Target has the new content.
    const parsed = JSON.parse(fsImpl.readFileSync(targetPath, 'utf-8'));
    expect(parsed.models.foo.benchlm.score).toBe(78.3);
  });

  test('rename failure (non-EXDEV): tmp remains, target is unchanged byte-for-byte', () => {
    // Pre-write the target so we can verify it's untouched after the failure.
    const originalBytes =
      '{"_meta":{"schemaVersion":2,"lastSynced":"2026-01-01"},"models":{"preexisting":{"name":"untouched"}}}\n';
    fsImpl.writeFileSync(targetPath, originalBytes, 'utf-8');

    // Mock renameSync to throw a non-EXDEV error (e.g., EBUSY / EPERM).
    const renameSpy = vi.fn(() => {
      const err = new Error('EBUSY: resource busy or locked');
      err.code = 'EBUSY';
      throw err;
    });
    _setFsForTesting({ ...fsImpl, renameSync: renameSpy });

    expect(() => writeModelsJson(targetPath, makeDoc(99), 'scrape-benchlm-test')).toThrow(/EBUSY/);

    // Tmp file remains (forensic value).
    const leftover = listTmpFiles(tmpDir, TARGET_NAME);
    expect(leftover.length).toBeGreaterThan(0);

    // Target is byte-identical to the pre-write state.
    expect(fsImpl.readFileSync(targetPath, 'utf-8')).toBe(originalBytes);
  });

  test('tmp path lives in the same directory as the target', () => {
    const renameSpy = vi.fn(fsImpl.renameSync);
    _setFsForTesting({ ...fsImpl, renameSync: renameSpy });

    writeModelsJson(targetPath, makeDoc(60), 'scrape-benchlm-test');

    expect(renameSpy).toHaveBeenCalled();
    const [src, dst] = renameSpy.mock.calls[0];
    expect(dirname(String(src))).toBe(dirname(targetPath));
    expect(dst).toBe(targetPath);
  });

  test('stale tmp files from a prior crashed run are cleaned up before write', () => {
    // Pre-create a stale tmp with a different pid+ts (simulates a prior crashed run).
    const staleName = `${TARGET_NAME}.99999.1700000000000.tmp`;
    fsImpl.writeFileSync(join(tmpDir, staleName), 'stale from a crashed prior sync', 'utf-8');
    expect(listTmpFiles(tmpDir, TARGET_NAME)).toContain(staleName);

    writeModelsJson(targetPath, makeDoc(42), 'scrape-benchlm-test');

    // (d) After a successful sync, no tmp residue accumulates — the stale one was swept.
    expect(listTmpFiles(tmpDir, TARGET_NAME)).toEqual([]);

    // And the target was written.
    const parsed = JSON.parse(fsImpl.readFileSync(targetPath, 'utf-8'));
    expect(parsed.models.foo.benchlm.score).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Block 2 — _meta.sources append-only migration
// ─────────────────────────────────────────────────────────────────────────────

let tempDir;
let tempFile;

beforeEach(() => {
  tempDir = fsImpl.mkdtempSync(join(tmpdir(), 'scraper-utils-test-'));
  tempFile = join(tempDir, 'models.json');
});

afterEach(() => {
  if (tempDir && fsImpl.existsSync(tempDir)) {
    fsImpl.rmSync(tempDir, { recursive: true, force: true });
  }
});

function seedDoc(meta) {
  fsImpl.writeFileSync(
    tempFile,
    JSON.stringify({ _meta: meta, models: { foo: { name: 'foo' } } }, null, 2),
    'utf-8'
  );
}

describe('writeModelsJson — _meta.sources migration', () => {
  test('migrates legacy `_meta.source` (string) into `_meta.sources` (array) on first write', async () => {
    seedDoc({ lastSynced: '2026-07-16', source: 'scrape-glm-blog', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-openai-pricing');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual([
      'scrape-glm-blog',
      'scrape-openai-pricing',
    ]);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('appends to existing `_meta.sources` array on subsequent writes', async () => {
    seedDoc({
      lastSynced: '2026-07-16',
      sources: ['scrape-glm-blog', 'scrape-openai-pricing'],
      schemaVersion: 1,
    });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-anthropic-pricing');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual([
      'scrape-glm-blog',
      'scrape-openai-pricing',
      'scrape-anthropic-pricing',
    ]);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('dedupes when the same tag is written twice (history preserved, no duplicates)', async () => {
    seedDoc({
      lastSynced: '2026-07-16',
      sources: ['scrape-glm-blog', 'scrape-openai-pricing'],
      schemaVersion: 1,
    });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'scrape-openai-pricing'); // duplicate of index 1
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['scrape-glm-blog', 'scrape-openai-pricing']);
  });

  test('falls back to `auto-sync` when no sourceTag is provided AND no prior provenance exists', async () => {
    seedDoc({ lastSynced: '2026-07-16', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, undefined);
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['auto-sync']);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('always emits plural `_meta.sources` array, never singular `_meta.source`', async () => {
    seedDoc({ lastSynced: '2026-07-16', source: 'old-string', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'new-tag');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(Array.isArray(result._meta.sources)).toBe(true);
    expect(result._meta).not.toHaveProperty('source');
  });

  test('preserves lastSynced + nextSync + schemaVersion alongside the migrated sources', async () => {
    seedDoc({ lastSynced: '2026-07-16', source: 'old', schemaVersion: 1 });
    const doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'new-tag');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(typeof result._meta.lastSynced).toBe('string');
    expect(typeof result._meta.nextSync).toBe('string');
    expect(result._meta.schemaVersion).toBe(1);
    expect(result._meta.sources).toContain('old');
    expect(result._meta.sources).toContain('new-tag');
  });

  test('append-only: three sequential writes grow the array monotonically (no history lost)', async () => {
    seedDoc({ lastSynced: '2026-07-16', schemaVersion: 1 });
    let doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'a');
    doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'b');
    doc = readModelsJson(tempFile);
    writeModelsJson(tempFile, doc, 'c');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result._meta.sources).toEqual(['a', 'b', 'c']);
    expect(result._meta).not.toHaveProperty('source');
  });
});
