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
  MANUAL_MODEL_FIELDS,
  preserveManualModelFields,
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

    const candidate = makeDoc(99);
    candidate.models.preexisting = { name: 'untouched' };
    expect(() => writeModelsJson(targetPath, candidate, 'scrape-benchlm-test')).toThrow(/EBUSY/);

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

// ─────────────────────────────────────────────────────────────────────────────
// Block 3 — manual-field write-guard (V5 availability)
//
// `availability` is human-owned data curation. The 8 scrapers re-read the
// canonical target and may never create, replace or delete it: an existing id
// gets its on-disk map restored byte-semantically, a new id is forced to `{}`
// (fail-closed), and an accidental deletion aborts the write.

describe('preserveManualModelFields — availability is human-owned', () => {
  const onDisk = {
    foo: { name: 'Foo', tier: 'high', availability: { p1: true, p2: false } },
  };

  test('exports a frozen manual-field allowlist', () => {
    expect(MANUAL_MODEL_FIELDS).toEqual(['availability']);
    expect(Object.isFrozen(MANUAL_MODEL_FIELDS)).toBe(true);
  });

  test('restores the on-disk map when the candidate omits or replaces it', () => {
    const omitted = preserveManualModelFields(onDisk, { foo: { name: 'Foo', input: 9 } });
    expect(omitted.foo.availability).toEqual({ p1: true, p2: false });

    const replaced = preserveManualModelFields(onDisk, {
      foo: { name: 'Foo', availability: { p1: false, p2: true } },
    });
    expect(replaced.foo.availability).toEqual({ p1: true, p2: false });
    // Byte-semantic clone: never a shared reference with the on-disk record.
    expect(replaced.foo.availability).not.toBe(onDisk.foo.availability);
  });

  test('scraped fields keep precedence; manual fields do not', () => {
    const next = preserveManualModelFields(onDisk, {
      foo: { name: 'Foo v2', input: 1.5, availability: {} },
    });
    expect(next.foo.name).toBe('Foo v2');
    expect(next.foo.input).toBe(1.5);
    expect(next.foo.availability).toEqual({ p1: true, p2: false });
  });

  test('new ids are forced to an empty (fail-closed) map', () => {
    const next = preserveManualModelFields(onDisk, {
      foo: { name: 'Foo', availability: { p1: true, p2: false } },
      bar: { name: 'Bar', availability: { p1: true } },
    });
    expect(next.bar.availability).toEqual({});
    expect(Object.keys(next.bar.availability)).toEqual([]);
  });

  test('an on-disk id missing from the candidate aborts the write', () => {
    expect(() => preserveManualModelFields(onDisk, { bar: { name: 'Bar' } })).toThrow(/foo/);
  });

  test('writeModelsJson applies the guard against the canonical target', () => {
    fsImpl.writeFileSync(
      tempFile,
      JSON.stringify(
        { _meta: { schemaVersion: 5 }, models: { foo: { name: 'Foo', availability: { p1: true } } } },
        null,
        2
      ),
      'utf-8'
    );
    const doc = {
      _meta: { schemaVersion: 5 },
      models: { foo: { name: 'Foo v2', input: 2, availability: { p1: false } } },
    };
    writeModelsJson(tempFile, doc, 'scrape-x');
    const result = JSON.parse(fsImpl.readFileSync(tempFile, 'utf-8'));
    expect(result.models.foo.availability).toEqual({ p1: true });
    expect(result.models.foo.input).toBe(2);
  });
});
