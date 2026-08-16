// @vitest-environment node
// tests/scrape-artificialanalysis.test.js
// Artificial Analysis scraper behavior (PR 2): authenticated fetch,
// alias-mapped merge, 3:1 blended pricing, write-only-when-returned
// optional fields, provenance, and the CLI flags.
//
// Each test runs `runScrape` directly with a mocked `fetchText` so we
// never hit the real AA endpoint, and `args.file` points at a per-test
// temp models.json. `process.env.AA_API_KEY` is set per-test (the
// scraper reads it from env; it is never hardcoded).
//
// Pre-PR2: the scraper file does not exist (RED). Post-PR2: every test
// below must be GREEN.

import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import * as fsImpl from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScrape } from '../scripts/scrape-artificialanalysis.js';

const AA_FIXTURE = fileURLToPath(new URL('./fixtures/aa-sample.json', import.meta.url));
const TEST_API_KEY = 'test-aa-api-key';

let tmpDir;
let modelsPath;
let aliasesPath;

beforeEach(() => {
  process.env.AA_API_KEY = TEST_API_KEY;
  tmpDir = fsImpl.mkdtempSync(join(tmpdir(), 'scrape-aa-test-'));
  modelsPath = join(tmpDir, 'models.json');
  aliasesPath = join(tmpDir, 'aa-aliases.json');
});

afterEach(() => {
  delete process.env.AA_API_KEY;
  if (tmpDir && fsImpl.existsSync(tmpDir)) {
    fsImpl.rmSync(tmpDir, { recursive: true, force: true });
  }
});

/** Alias table with the curated keys the tests merge into. */
function writeAliases() {
  fsImpl.writeFileSync(
    aliasesPath,
    JSON.stringify({
      _meta: { version: 1 },
      aliases: [
        { from: 'claude-sonnet-5', slug: 'claude-sonnet-5', to: 'sonnet5' },
        { from: 'gpt-5-5', slug: 'gpt-5-5', to: 'gpt55' },
        { from: 'kimi-k3', slug: 'kimi-k3', to: 'kimik3' },
        { from: 'mimo-v2-5', slug: 'mimo-v2-5', to: 'mimo25' },
      ],
    }, null, 2),
    'utf-8',
  );
}

/**
 * Temp models.json: four curated models, each with full benchmark blocks
 * (benchlm / arena / swePro / sweVer — MUST stay unchanged) and vendor
 * pricing that AA may overwrite. `extra` per key lets tests place
 * pre-existing optional fields.
 */
function writeModels() {
  const mk = (key, extra = {}) => ({
    name: key,
    tier: 'high',
    benchlm: { score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } },
    arena: 1507,
    swePro: 62.4,
    sweVer: 77.8,
    input: 0.5,
    output: 1.5,
    notes: 'curated note',
    sources: [{ url: 'https://benchlm.ai', date: '2026-07-01', scraper: 'scrape-benchlm' }],
    ...extra,
  });
  fsImpl.writeFileSync(
    modelsPath,
    JSON.stringify(
      {
        _meta: { schemaVersion: 2, sources: ['scrape-benchlm'] },
        models: {
          sonnet5: mk('sonnet5', { cacheRead: 0.25, cacheWrite: 2.0, term: 50 }),
          gpt55: mk('gpt55', { cacheRead: 0.1 }),
          kimik3: mk('kimik3'),
          mimo25: mk('mimo25'),
        },
      },
      null,
      2,
    ),
    'utf-8',
  );
}

/** Serialize an AA-style payload: `{ models: [...] }`. */
function aaResponse(entries) {
  return JSON.stringify({ models: entries });
}

const BASE_ARGS = () => ({ dryRun: false, file: modelsPath, source: 'https://aa.test/api', quiet: true, aliasPath: aliasesPath });

describe('scrape-artificialanalysis — happy path', () => {
  test('authenticated GET + mapped merge: AA pricing, local blended, provenance; benchmarks untouched', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async (url, opts) => {
      // Authenticated GET against the real AA endpoint, key from env.
      expect(url).toBe('https://artificialanalysis.ai/api/v2/data/llms/models');
      expect(opts.headers['x-api-key']).toBe(TEST_API_KEY);
      return aaResponse([
        {
          id: 'claude-sonnet-5', slug: 'claude-sonnet-5', name: 'Claude Sonnet 5',
          pricing: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 4.5 },
          term: 84.2, codingIndex: 61.3,
          median_output_tokens_per_second: 92.4, median_time_to_first_token_seconds: 0.31,
          blended: 99, // must be IGNORED — blended is computed locally
        },
        {
          id: 'gpt-5-5', slug: 'gpt-5-5', name: 'GPT-5.5',
          pricing: { input: 1.25, output: 10 },
          blended: 42, // must be IGNORED
        },
      ]);
    });

    const result = await runScrape({ ...BASE_ARGS(), source: null }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.changes).toBeGreaterThan(0);
    expect(fetchText).toHaveBeenCalledTimes(1);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // AA-authored pricing overwrites the vendor values.
    expect(after.models.sonnet5.input).toBe(3);
    expect(after.models.sonnet5.output).toBe(15);
    expect(after.models.sonnet5.cacheRead).toBe(0.3);
    expect(after.models.sonnet5.cacheWrite).toBe(4.5);
    expect(after.models.sonnet5.pricingSource).toBe('artificialanalysis');

    // 3:1 blended computed locally — upstream `blended` is never trusted.
    expect(after.models.sonnet5.blended).toBe((3 * 3 + 15) / 4);
    expect(after.models.gpt55.blended).toBe((3 * 1.25 + 10) / 4);

    // Optional AA observations are written when returned.
    expect(after.models.sonnet5.term).toBe(84.2);
    expect(after.models.sonnet5.codingIndex).toBe(61.3);
    expect(after.models.sonnet5.median_output_tokens_per_second).toBe(92.4);
    expect(after.models.sonnet5.median_time_to_first_token_seconds).toBe(0.31);

    // Provenance: per-model sources[] append + _meta.sources tag + schema v3.
    expect(after.models.sonnet5.sources).toContainEqual({
      url: 'https://artificialanalysis.ai/',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      scraper: 'scrape-artificialanalysis',
    });
    expect(after._meta.sources).toContain('scrape-artificialanalysis');
    expect(after._meta.sources).toContain('scrape-benchlm'); // prior tags preserved
    expect(after._meta.schemaVersion).toBe(3);

    // benchlm / arena / swePro / sweVer MUST stay unchanged.
    expect(after.models.sonnet5.benchlm).toEqual({ score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } });
    expect(after.models.sonnet5.arena).toBe(1507);
    expect(after.models.sonnet5.swePro).toBe(62.4);
    expect(after.models.sonnet5.sweVer).toBe(77.8);
    expect(after.models.gpt55.benchlm).toEqual({ score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } });
    expect(after.models.gpt55.tier).toBe('high'); // curated field preserved
  });

  test('partial pricing: absent optional fields are NOT synthesized (no 0/null) and are documented in notes', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'claude-sonnet-5', slug: 'claude-sonnet-5', pricing: { input: 3, output: 15 } },
      { id: 'kimi-k3', slug: 'kimi-k3', pricing: { input: 0.6, output: 2.2, cacheWrite: 0.9 }, codingIndex: 55 },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // sonnet5: AA returned NO optional fields — prior values preserved
    // (never deleted, never zeroed) and nothing new is fabricated.
    expect(after.models.sonnet5.cacheRead).toBe(0.25);
    expect(after.models.sonnet5.cacheWrite).toBe(2.0);
    expect(after.models.sonnet5.term).toBe(50);
    expect('codingIndex' in after.models.sonnet5).toBe(false);
    expect('median_output_tokens_per_second' in after.models.sonnet5).toBe(false);
    expect('median_time_to_first_token_seconds' in after.models.sonnet5).toBe(false);

    // Absence is documented in notes; curated note content is preserved.
    expect(after.models.sonnet5.notes).toMatch(/AA sync \d{4}-\d{2}-\d{2}: omitted cacheRead, cacheWrite, term, codingIndex, median_output_tokens_per_second, median_time_to_first_token_seconds/);
    expect(after.models.sonnet5.notes).toContain('curated note');

    // kimik3: partially returned — present fields written, absent ones absent.
    expect(after.models.kimik3.cacheWrite).toBe(0.9);
    expect(after.models.kimik3.codingIndex).toBe(55);
    expect(after.models.kimik3.cacheRead).toBeUndefined();
    expect(after.models.kimik3.notes).toMatch(/omitted cacheRead, term, median_output_tokens_per_second, median_time_to_first_token_seconds/);
  });

  test('tracked model absent from the AA response is preserved (warn list returned)', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'claude-sonnet-5', slug: 'claude-sonnet-5', pricing: { input: 3, output: 15 } },
    ]));

    const result = await runScrape({ ...BASE_ARGS(), quiet: false }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual(['gpt55', 'kimik3', 'mimo25']); // sorted

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.mimo25).toBeDefined(); // preserved, not deleted
    expect(after.models.mimo25.benchlm.score).toBe(77);
  });
});

describe('scrape-artificialanalysis — CLI flags', () => {
  test('--dry-run: merges in memory but does NOT write (file byte-identical)', async () => {
    writeAliases();
    writeModels();
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'claude-sonnet-5', slug: 'claude-sonnet-5', pricing: { input: 3, output: 15 } },
    ]));

    const result = await runScrape({ ...BASE_ARGS(), dryRun: true }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.changes).toBeGreaterThan(0);
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });

  test('--file: writes to the override path only; default models.json untouched', async () => {
    writeAliases();
    writeModels();
    const defaultPath = join(tmpDir, 'data', 'models.json');
    fsImpl.mkdirSync(dirname(defaultPath), { recursive: true });
    fsImpl.copyFileSync(modelsPath, defaultPath);
    const defaultBefore = fsImpl.readFileSync(defaultPath, 'utf-8');

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'claude-sonnet-5', slug: 'claude-sonnet-5', pricing: { input: 3, output: 15 } },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText }); // file = modelsPath (override)
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.sonnet5.input).toBe(3);
    expect(fsImpl.readFileSync(defaultPath, 'utf-8')).toBe(defaultBefore);
  });

  test('--source <local fixture>: reads tests/fixtures/aa-sample.json, no HTTP, mapped merge applied', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => {
      throw new Error('fetchText must not be called when --source is a local fixture');
    });

    const result = await runScrape({ ...BASE_ARGS(), source: AA_FIXTURE }, { fetchText });
    expect(result.ok).toBe(true);
    expect(fetchText).not.toHaveBeenCalled();

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.sonnet5.input).toBe(3);
    expect(after.models.sonnet5.blended).toBe(6); // fixture has blended:99 — ignored
    expect(after.models.gpt55.blended).toBe((3 * 1.25 + 10) / 4); // fixture has blended:42 — ignored
    expect(after.models.kimik3.cacheWrite).toBe(0.9);
    expect(after.models.kimik3.codingIndex).toBe(55);
    expect(after._meta.schemaVersion).toBe(3);
    expect(after.models.sonnet5.benchlm.score).toBe(77); // untouched
  });
});
