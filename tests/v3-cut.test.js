// tests/v3-cut.test.js
// V5 Slice 4 — V3 cut sentinel.
//
// The V3 monolith was archived to `docs/legacy/v3-monolith-backup.html` as
// rollback documentation only. This sentinel locks the cut:
//   1. the root snapshot is gone;
//   2. the archived rollback copy exists under `docs/legacy/`;
//   3. no production file references `docs/legacy/` (never a build/runtime input);
//   4. no other test gate reads/nominates `docs/legacy/`;
//   5. the optional parity harness stays disabled: `V3_AVAILABLE = false` in the
//      integrity suite, with the V3 parser/allowlists/candidates removed.

import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ROOT_SNAPSHOT = join(ROOT, 'v3-monolith-backup.html');
const LEGACY_SNAPSHOT = join(ROOT, 'docs', 'legacy', 'v3-monolith-backup.html');

// Production surfaces that must never depend on the archived monolith.
const PRODUCTION_PATHS = ['js', 'scripts', 'css', 'index.html', '.github/workflows'];
// This sentinel is the only test allowed to name `docs/legacy/`; every other
// test gate must stay independent from the archived file.
const SENTINEL_FILE = relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');

function collectFiles(target, out = []) {
  const abs = join(ROOT, target);
  if (!existsSync(abs)) return out;
  if (statSync(abs).isFile()) {
    out.push(target.replace(/\\/g, '/'));
    return out;
  }
  for (const entry of readdirSync(abs)) {
    collectFiles(join(target, entry), out);
  }
  return out;
}

describe('V3 cut sentinel', () => {
  test('the V3 monolith no longer lives at the repository root', () => {
    expect(existsSync(ROOT_SNAPSHOT)).toBe(false);
  });

  test('the archived rollback copy exists under docs/legacy/', () => {
    expect(existsSync(LEGACY_SNAPSHOT)).toBe(true);
  });

  test('no production file reads docs/legacy/', () => {
    const offenders = [];
    for (const target of PRODUCTION_PATHS) {
      for (const file of collectFiles(target)) {
        if (readFileSync(join(ROOT, file), 'utf-8').includes('docs/legacy')) offenders.push(file);
      }
    }
    expect(offenders, `production files referencing docs/legacy/: ${offenders.join(', ')}`).toEqual([]);
  });

  test('no test gate other than this sentinel reads docs/legacy/', () => {
    const offenders = [];
    for (const file of collectFiles('tests')) {
      if (file === SENTINEL_FILE) continue;
      if (readFileSync(join(ROOT, file), 'utf-8').includes('docs/legacy')) offenders.push(file);
    }
    expect(offenders, `test gates referencing docs/legacy/: ${offenders.join(', ')}`).toEqual([]);
  });

  test('the optional V3 parity harness stays disabled (V3_AVAILABLE = false)', () => {
    const integrity = readFileSync(join(ROOT, 'tests', 'data-integrity.test.js'), 'utf-8');
    expect(integrity).toContain('const V3_AVAILABLE = false;');
    expect(integrity).not.toContain('V3_CANDIDATES');
    expect(integrity).not.toContain('SDD_V3_BACKUP_PATH');
    expect(integrity).not.toContain('parseV3Models');
    expect(integrity).not.toContain('KNOWN_V4_ONLY');
  });
});
