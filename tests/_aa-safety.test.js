// @vitest-environment node
// tests/_aa-safety.test.js
// Alias + rename safety for the Artificial Analysis scraper (PR 1).
//
// The safety module (`scripts/_aa-safety.mjs`) owns four pure functions:
//   - loadAaAliases(filePath)             : read + parse data/aa-aliases.json
//   - mapAaId(identity, aliases)          : map an AA id OR slug → curated key
//                                          (throws on miss — fail loud, never guess)
//   - detectRename(id, slug, aliases)     : flag a renamed AA id (slug stable,
//                                          id changed) — throws, never guesses
//   - detectMissing(knownIds, mappedPresent) : curated keys AA did NOT mention;
//                                          caller WARNs + preserves (no delete)
//
// Pre-PR1: none of these exist. Every test is RED until
// scripts/_aa-safety.mjs lands.

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadAaAliases,
  mapAaId,
  detectRename,
  detectMissing,
} from '../scripts/_aa-safety.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'aa-safety-test-'));
});

afterEach(() => {
  if (tmpDir && fsImpl.existsSync(tmpDir)) {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** Minimal valid alias file used by loadAaAliases tests. */
function writeAliasesFile(content) {
  const path = join(tmpDir, 'aa-aliases.json');
  fsImpl.writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8');
  return path;
}

/**
 * Fixture aliases in the canonical `{from, slug, to}` shape. `from` is
 * the AA response `id`, `slug` the AA response `slug` (kept stable
 * across upstream renames), `to` the curated key in data/models.json.
 */
const ALIASES = [
  { from: 'aa-id-001', slug: 'claude-sonnet-5', to: 'sonnet5' },
  { from: 'aa-id-002', slug: 'claude-opus-5', to: 'claudeOpus5' },
  { from: 'aa-id-003', slug: 'gpt-5-5', to: 'gpt55' },
];

describe('loadAaAliases', () => {
  test('reads a well-formed alias file', () => {
    const path = writeAliasesFile({
      _meta: { version: 1, notes: 'AA id → curated key; slug captured for rename detection.' },
      aliases: [
        { from: 'aa-id-001', slug: 'claude-sonnet-5', to: 'sonnet5' },
        { from: 'aa-id-002', slug: 'claude-opus-5', to: 'claudeOpus5' },
      ],
    });
    const aliases = loadAaAliases(path);
    expect(Array.isArray(aliases)).toBe(true);
    expect(aliases.length).toBe(2);
    expect(aliases[0]).toEqual({ from: 'aa-id-001', slug: 'claude-sonnet-5', to: 'sonnet5' });
  });

  test('throws when the file is missing', () => {
    expect(() => loadAaAliases(join(tmpDir, 'does-not-exist.json'))).toThrow(/not found/i);
  });

  test('throws when the file is malformed JSON', () => {
    const path = join(tmpDir, 'bad.json');
    fsImpl.writeFileSync(path, '{not json', 'utf-8');
    expect(() => loadAaAliases(path)).toThrow(/not valid JSON/i);
  });

  test('throws when the aliases key is missing', () => {
    const path = writeAliasesFile({ _meta: { version: 1 } });
    expect(() => loadAaAliases(path)).toThrow(/aliases/i);
  });
});

describe('mapAaId', () => {
  test('alias-hit by id: maps the AA id to the curated key', () => {
    expect(mapAaId('aa-id-001', ALIASES)).toBe('sonnet5');
    expect(mapAaId('aa-id-003', ALIASES)).toBe('gpt55');
  });

  test('alias-hit by slug: maps the AA slug to the curated key', () => {
    expect(mapAaId('claude-sonnet-5', ALIASES)).toBe('sonnet5');
    expect(mapAaId('claude-opus-5', ALIASES)).toBe('claudeOpus5');
  });

  test('alias-miss: throws and NAMES the offending AA id', () => {
    expect(() => mapAaId('brand-new-id-from-aa', ALIASES)).toThrow(/brand-new-id-from-aa/);
  });

  test('alias-miss: throws an Error with code AA_UNKNOWN_ID so the scraper can phase-tag it', () => {
    try {
      mapAaId('totally-unknown-7', ALIASES);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.message).toContain('totally-unknown-7');
      expect(err.code).toBe('AA_UNKNOWN_ID');
    }
  });
});

describe('detectRename', () => {
  test('returns null when the id and slug both match the same alias (no rename)', () => {
    expect(detectRename('aa-id-001', 'claude-sonnet-5', ALIASES)).toBeNull();
    expect(detectRename('aa-id-002', 'claude-opus-5', ALIASES)).toBeNull();
  });

  test('throws AA_ID_RENAMED when the slug is known but the id changed (flag, never guess)', () => {
    try {
      detectRename('aa-id-007', 'claude-sonnet-5', ALIASES);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.code).toBe('AA_ID_RENAMED');
      expect(err.message).toContain('aa-id-001');
      expect(err.message).toContain('aa-id-007');
      expect(err.oldId).toBe('aa-id-001');
      expect(err.newId).toBe('aa-id-007');
    }
  });

  test('returns null when the slug is unknown (nothing to compare — mapAaId still fails loud)', () => {
    expect(detectRename('brand-new-id', 'brand-new-slug', ALIASES)).toBeNull();
  });

  test('returns null when the entry has no slug', () => {
    expect(detectRename('aa-id-001', undefined, ALIASES)).toBeNull();
  });
});

describe('detectMissing', () => {
  test('returns curated ids that were tracked but absent from the AA response', () => {
    const knownIds = ['sonnet5', 'claudeOpus5', 'gpt55', 'gpt54'];
    // AA response mentions sonnet5 and gpt55 (by id), claudeOpus5 (by slug) —
    // gpt54 is tracked but absent.
    const mappedPresent = new Set(['sonnet5', 'gpt55', 'claudeOpus5']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing.sort()).toEqual(['gpt54']);
  });

  test('returns an empty array when every known id is present', () => {
    const knownIds = ['sonnet5', 'claudeOpus5'];
    const mappedPresent = new Set(['sonnet5', 'claudeOpus5']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing).toEqual([]);
  });

  test('does not throw when the AA response is empty (all known ids are missing — preserve)', () => {
    const knownIds = ['sonnet5', 'claudeOpus5'];
    const mappedPresent = new Set();
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing.sort()).toEqual(['claudeOpus5', 'sonnet5']);
  });

  test('ignores AA ids that are not in the known set', () => {
    const knownIds = ['sonnet5'];
    const mappedPresent = new Set(['sonnet5', 'extra-id-from-aa']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing).toEqual([]);
  });
});
