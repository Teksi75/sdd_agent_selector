// @vitest-environment node
// tests/_aa-safety.test.js
// Alias + slug safety for the Artificial Analysis scraper — v2 contract
// (Effort PR 1: alias v2 + slug safety).
//
// The safety module (`scripts/_aa-safety.mjs`) owns:
//   - loadAaAliases(filePath)          : read + parse data/aa-aliases.json
//                                        (v2 schema {slug,to,effort}; throws on
//                                        missing file / bad JSON / missing
//                                        `aliases` / invalid v2 entry)
//   - mapAaSlug(slug, aliases)         : slug → {to, effort}; null for unknown
//                                        non-curated slugs (IGNORED, not fatal);
//                                        throws AA_UNKNOWN_SLUG when the slug is
//                                        expected-but-absent (fail closed)
//   - detectRename(id, slug, aliases)  : slug-based drift guard (v2): UUID
//                                        changes are NOT fatal, unknown slugs
//                                        are ignored, missing slug fails closed;
//                                        legacy v1 `from` check kept as a PR-1
//                                        compatibility shim
//   - detectMissing(knownIds, present) : curated keys AA did NOT mention;
//                                        caller WARNs + preserves (no delete)
//
// Pre-PR1: mapAaSlug does not exist, loadAaAliases has no v2 validation, and
// detectRename has no slug-based path. Every v2 test is RED until
// scripts/_aa-safety.mjs lands.

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAaAliases,
  mapAaSlug,
  detectRename,
  detectMissing,
} from '../scripts/_aa-safety.mjs';

const REAL_ALIASES_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'aa-aliases.json');
const AA_EFFORTS = ['max', 'xhigh', 'high', 'medium', 'low', 'non-reasoning'];

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
 * Fixture aliases in the canonical v2 `{slug, to, effort}` shape.
 */
const V2_ALIASES = [
  { slug: 'gpt-5-5', to: 'gpt55', effort: 'xhigh' },
  { slug: 'gpt-5-5-high', to: 'gpt55High', effort: 'high' },
  { slug: 'gpt-5-5-medium', to: 'gpt55Medium', effort: 'medium' },
  { slug: 'claude-4-5-haiku', to: 'haiku45', effort: 'non-reasoning' },
  { slug: 'claude-4-5-haiku-reasoning', to: 'haiku45Reasoning', effort: 'max' },
  { slug: 'claude-sonnet-5', to: 'sonnet5', effort: 'max' },
];

describe('loadAaAliases (v2)', () => {
  test('the real data/aa-aliases.json is the v2 69-entry table from the design', () => {
    const doc = JSON.parse(fsImpl.readFileSync(REAL_ALIASES_PATH, 'utf-8'));
    expect(doc._meta.version).toBe(2);
    const aliases = loadAaAliases(REAL_ALIASES_PATH);
    expect(aliases).toHaveLength(69);
    const slugs = new Set();
    for (const a of aliases) {
      expect(typeof a.slug).toBe('string');
      expect(a.slug.length).toBeGreaterThan(0);
      expect(typeof a.to).toBe('string');
      expect(a.to.length).toBeGreaterThan(0);
      expect(AA_EFFORTS).toContain(a.effort); // explicit effort, never inferred
      expect(slugs.has(a.slug)).toBe(false); // no duplicate slugs
      slugs.add(a.slug);
    }
  });

  test('corrected slugs from the design are present; wrong provisional slugs are absent', () => {
    const aliases = loadAaAliases(REAL_ALIASES_PATH);
    const slugs = new Set(aliases.map((a) => a.slug));
    expect(slugs.has('kimi-k2-7-code')).toBe(true); // was kimi-k2-7-c
    expect(slugs.has('kimi-k2-7-c')).toBe(false);
    expect(slugs.has('hy3')).toBe(true); // was opencode-hybrid-3
    expect(slugs.has('opencode-hybrid-3')).toBe(false);
    expect(slugs.has('claude-4-5-haiku')).toBe(true); // was claude-haiku-4-5
    expect(slugs.has('claude-haiku-4-5')).toBe(false);
    expect(slugs.has('mimo-v2-5-0424')).toBe(true); // was mimo-v2-5
    expect(slugs.has('mimo-v2-5')).toBe(false);
    expect(slugs.has('gpt-5-6-luna-max')).toBe(false); // consolidated away
  });

  test('reads a well-formed v2 alias file', () => {
    const path = writeAliasesFile({
      _meta: { version: 2, notes: 'AA slug → curated key + effort.' },
      aliases: [
        { slug: 'claude-sonnet-5', to: 'sonnet5', effort: 'max' },
        { slug: 'claude-opus-5', to: 'claudeOpus5', effort: 'max' },
      ],
    });
    const aliases = loadAaAliases(path);
    expect(Array.isArray(aliases)).toBe(true);
    expect(aliases).toHaveLength(2);
    expect(aliases[0]).toEqual({ slug: 'claude-sonnet-5', to: 'sonnet5', effort: 'max' });
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
    const path = writeAliasesFile({ _meta: { version: 2 } });
    expect(() => loadAaAliases(path)).toThrow(/aliases/i);
  });

  test('v2 entry missing `effort` → throws, naming the slug (never inferred from slug shape)', () => {
    const path = writeAliasesFile({
      _meta: { version: 2 },
      aliases: [{ slug: 'gpt-5-5', to: 'gpt55' }], // effort absent
    });
    expect(() => loadAaAliases(path)).toThrow(/gpt-5-5/);
    expect(() => loadAaAliases(path)).toThrow(/effort/i);
  });

  test('v2 entry with an invalid effort value → throws', () => {
    const path = writeAliasesFile({
      _meta: { version: 2 },
      aliases: [{ slug: 'gpt-5-5', to: 'gpt55', effort: 'ultra' }],
    });
    expect(() => loadAaAliases(path)).toThrow(/effort/i);
  });

  test('v2 entry missing `slug` → throws', () => {
    const path = writeAliasesFile({
      _meta: { version: 2 },
      aliases: [{ to: 'gpt55', effort: 'max' }],
    });
    expect(() => loadAaAliases(path)).toThrow(/slug/i);
  });

  test('legacy v1-shaped file (no effort) loads leniently — PR-1 compatibility', () => {
    const path = writeAliasesFile({
      _meta: { version: 1 },
      aliases: [{ from: 'aa-id-001', slug: 'claude-sonnet-5', to: 'sonnet5' }],
    });
    const aliases = loadAaAliases(path);
    expect(aliases).toHaveLength(1);
    expect(aliases[0].to).toBe('sonnet5');
  });
});

describe('mapAaSlug', () => {
  test('known slug → {to, effort}; bare gpt-5-5 is xhigh, NOT max (never inferred from slug shape)', () => {
    expect(mapAaSlug('gpt-5-5', V2_ALIASES)).toEqual({ to: 'gpt55', effort: 'xhigh' });
    expect(mapAaSlug('gpt-5-5-high', V2_ALIASES)).toEqual({ to: 'gpt55High', effort: 'high' });
    expect(mapAaSlug('gpt-5-5-medium', V2_ALIASES)).toEqual({ to: 'gpt55Medium', effort: 'medium' });
  });

  test('bare non-reasoning slug keeps its explicit effort (haiku45)', () => {
    expect(mapAaSlug('claude-4-5-haiku', V2_ALIASES)).toEqual({ to: 'haiku45', effort: 'non-reasoning' });
    expect(mapAaSlug('claude-4-5-haiku-reasoning', V2_ALIASES)).toEqual({ to: 'haiku45Reasoning', effort: 'max' });
  });

  test('real table maps the tricky effort entries explicitly (never inferred)', () => {
    const aliases = loadAaAliases(REAL_ALIASES_PATH);
    expect(mapAaSlug('gpt-5-5', aliases)).toEqual({ to: 'gpt55', effort: 'xhigh' });
    expect(mapAaSlug('grok-4-5', aliases)).toEqual({ to: 'grok45', effort: 'high' });
    expect(mapAaSlug('claude-4-5-haiku', aliases)).toEqual({ to: 'haiku45', effort: 'non-reasoning' });
    expect(mapAaSlug('hy3', aliases)).toEqual({ to: 'opencodeHy3', effort: 'max' });
    expect(mapAaSlug('mimo-v2-5-0424', aliases)).toEqual({ to: 'mimo25', effort: 'max' });
    expect(mapAaSlug('gpt-5-6-luna-high', aliases)).toEqual({ to: 'gpt56lunaHigh', effort: 'high' });
  });

  test('unknown non-curated slug → null (IGNORED, not fatal — AA lists ~539 uncurated models)', () => {
    expect(mapAaSlug('some-brand-new-model-9', V2_ALIASES)).toBeNull();
  });

  test('expected-but-absent slug (missing/empty) → throws AA_UNKNOWN_SLUG (fail closed)', () => {
    try {
      mapAaSlug(undefined, V2_ALIASES);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.code).toBe('AA_UNKNOWN_SLUG');
    }
    expect(() => mapAaSlug('', V2_ALIASES)).toThrow(/slug/i);
  });
});

describe('detectRename (slug-based, v2)', () => {
  test('known slug + changed UUID → null (UUID changes are NOT fatal; known slugs update)', () => {
    expect(detectRename('uuid-abc-123', 'gpt-5-5', V2_ALIASES)).toBeNull();
    expect(detectRename('uuid-zzz-999', 'claude-sonnet-5', V2_ALIASES)).toBeNull();
  });

  test('unknown non-curated slug → null (ignored, not fatal)', () => {
    expect(detectRename('uuid-xyz', 'brand-new-model-9', V2_ALIASES)).toBeNull();
  });

  test('missing slug (expected-but-absent) → throws AA_UNKNOWN_SLUG (fail closed)', () => {
    try {
      detectRename('uuid-abc-123', undefined, V2_ALIASES);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.code).toBe('AA_UNKNOWN_SLUG');
      expect(err.message).toContain('uuid-abc-123');
    }
  });

  test('legacy v1 aliases (with `from`): id drift is still flagged AA_ID_RENAMED (PR-1 shim)', () => {
    const v1 = [{ from: 'aa-id-001', slug: 'claude-sonnet-5', to: 'sonnet5' }];
    expect(detectRename('aa-id-001', 'claude-sonnet-5', v1)).toBeNull();
    try {
      detectRename('aa-id-007', 'claude-sonnet-5', v1);
      throw new Error('should not reach');
    } catch (err) {
      expect(err.code).toBe('AA_ID_RENAMED');
      expect(err.oldId).toBe('aa-id-001');
      expect(err.newId).toBe('aa-id-007');
    }
  });
});

describe('detectMissing', () => {
  test('returns curated keys tracked but absent from the AA response (sorted)', () => {
    const knownKeys = ['sonnet5', 'claudeOpus5', 'gpt55', 'gpt54'];
    const mappedPresent = new Set(['sonnet5', 'gpt55', 'claudeOpus5']);
    expect(detectMissing(knownKeys, mappedPresent)).toEqual(['gpt54']);
  });

  test('returns an empty array when every known key is present', () => {
    const knownKeys = ['sonnet5', 'claudeOpus5'];
    expect(detectMissing(knownKeys, new Set(['sonnet5', 'claudeOpus5']))).toEqual([]);
  });

  test('does not throw when the AA response is empty (all known keys missing — preserve)', () => {
    expect(detectMissing(['sonnet5', 'claudeOpus5'], new Set())).toEqual(['claudeOpus5', 'sonnet5']);
  });

  test('ignores AA keys that are not in the known set', () => {
    expect(detectMissing(['sonnet5'], new Set(['sonnet5', 'extra-key-from-aa']))).toEqual([]);
  });
});
