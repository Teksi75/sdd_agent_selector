// @vitest-environment node
// tests/benchlm-rename.test.js
// Rename detection + alias safety for the BenchLM scraper (PR2).
//
// The safety module (`scripts/_benchlm-safety.mjs`) owns three pure
// functions:
//   - loadAliases(filePath)       : read + parse data/benchlm-aliases.json
//   - mapBenchlmId(id, aliases)   : map a BenchLM id → curated id (throws on miss)
//   - detectMissing(known, bench) : list curated ids that BenchLM did NOT list
//
// Pre-PR2: none of these exist. Every test is RED until
// scripts/_benchlm-safety.mjs lands.

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadAliases,
  mapBenchlmId,
  detectMissing,
} from '../scripts/_benchlm-safety.mjs';

let tmpDir;

beforeEach(() => {
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'benchlm-rename-test-'));
});

afterEach(() => {
  if (tmpDir && fsImpl.existsSync(tmpDir)) {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** Minimal valid alias file used by loadAliases tests. */
function writeAliasesFile(content) {
  const path = join(tmpDir, 'benchlm-aliases.json');
  fsImpl.writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8');
  return path;
}

describe('loadAliases', () => {
  test('reads a well-formed alias file', () => {
    const path = writeAliasesFile({
      _meta: { version: 1 },
      aliases: [
        { from: 'claude-fable-5', to: 'claudeFable5' },
        { from: 'kimi-k3', to: 'kimik3' },
      ],
    });
    const aliases = loadAliases(path);
    expect(Array.isArray(aliases)).toBe(true);
    expect(aliases.length).toBe(2);
    expect(aliases[0]).toEqual({ from: 'claude-fable-5', to: 'claudeFable5' });
  });

  test('throws when the file is missing', () => {
    expect(() => loadAliases(join(tmpDir, 'does-not-exist.json'))).toThrow(/not found/i);
  });

  test('throws when the file is malformed JSON', () => {
    const path = join(tmpDir, 'bad.json');
    fsImpl.writeFileSync(path, '{not json', 'utf-8');
    expect(() => loadAliases(path)).toThrow(/not valid JSON/i);
  });

  test('throws when the aliases key is missing', () => {
    const path = writeAliasesFile({ _meta: { version: 1 } });
    expect(() => loadAliases(path)).toThrow(/aliases/i);
  });
});

describe('mapBenchlmId', () => {
  const aliases = [
    { from: 'claude-fable-5', to: 'claudeFable5' },
    { from: 'kimi-k3', to: 'kimik3' },
    { from: 'mimo-v2-5', to: 'mimo25' },
    { from: 'mimo-v2-5-pro', to: 'mimo25pro' },
    { from: 'minimax-m3', to: 'minimaxm3' },
  ];

  test('alias-hit: returns the curated id for a known BenchLM id', () => {
    expect(mapBenchlmId('claude-fable-5', aliases)).toBe('claudeFable5');
    expect(mapBenchlmId('kimi-k3', aliases)).toBe('kimik3');
    expect(mapBenchlmId('minimax-m3', aliases)).toBe('minimaxm3');
  });

  test('alias-miss: throws and NAMES the offending BenchLM id', () => {
    expect(() => mapBenchlmId('brand-new-id-from-benchlm', aliases)).toThrow(
      /brand-new-id-from-benchlm/,
    );
  });

  test('alias-miss: throws an Error with code-like property so the scraper can phase-tag it', () => {
    try {
      mapBenchlmId('totally-unknown-7', aliases);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.message).toContain('totally-unknown-7');
      expect(err.code).toBe('BENCHLM_UNKNOWN_ID');
    }
  });
});

describe('detectMissing', () => {
  test('returns curated ids that were tracked but absent from the BenchLM response', () => {
    const knownIds = ['glm52', 'qwen37max', 'kimik3', 'opus48', 'haiku45'];
    // BenchLM response references glm52, qwen37max, and kimik3 — opus48 + haiku45 missing.
    const benchlmResponse = [
      { id: 'glm52', score: 80, verified: true },
      { id: 'qwen37max', score: 78, verified: true },
      { id: 'kimi-k3', score: 75, verified: false },
    ];
    // After mapping, "kimi-k3" → "kimik3" so the curated set present is {glm52, qwen37max, kimik3}.
    const mappedPresent = new Set(['glm52', 'qwen37max', 'kimik3']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing.sort()).toEqual(['haiku45', 'opus48']);
  });

  test('returns an empty array when every known id is present', () => {
    const knownIds = ['glm52', 'kimik3'];
    const mappedPresent = new Set(['glm52', 'kimik3']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing).toEqual([]);
  });

  test('does not throw when BenchLM response is empty (all known ids are missing)', () => {
    const knownIds = ['glm52', 'kimik3'];
    const mappedPresent = new Set();
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing.sort()).toEqual(['glm52', 'kimik3']);
  });

  test('ignores BenchLM ids that are not in the known set', () => {
    const knownIds = ['glm52'];
    const mappedPresent = new Set(['glm52', 'extra-id-from-benchlm']);
    const missing = detectMissing(knownIds, mappedPresent);
    expect(missing).toEqual([]);
  });
});
