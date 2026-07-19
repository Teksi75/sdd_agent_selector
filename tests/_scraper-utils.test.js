// @vitest-environment node
// tests/_scraper-utils.test.js
// Atomic write semantics for scripts/_scraper-utils.mjs::writeModelsJson.
//
// Pre-PR2: writeModelsJson writes directly via writeFileSync — no tmp, no
// rename, no stale cleanup. Every test below is RED on the direct-write
// implementation. They turn GREEN only after scripts/_scraper-utils.mjs is
// migrated to a tmp + renameSync strategy with EXDEV fallback and stale
// tmp cleanup.
//
// Boundary: writeModelsJson is the shared seam all six scrapers (and the
// new BenchLM scraper) write through. Renaming it once protects every
// caller from partial-write corruption.

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import {
  writeModelsJson,
  _setFsForTesting,
  _resetFsForTesting,
} from '../scripts/_scraper-utils.mjs';

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
