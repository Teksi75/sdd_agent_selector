// @vitest-environment node
// tests/scrape-artificialanalysis.test.js
// Artificial Analysis scraper behavior — FIELD_MAP v2 + slug flow
// (Effort PR 2: field-level v2 contract + variant creation).
//
// v2 contract under test (spec #5827 / design #5828):
//   - Identity is the stable AA `slug` (UUID `id` is unstable and ignored).
//     mapAaSlug(slug) → {to, effort}; unknown non-curated slugs are
//     IGNORED (AA lists ~539 models we do not curate).
//   - FIELD_MAP v2 paths:
//       pricing.price_1m_input_tokens        → input
//       pricing.price_1m_output_tokens       → output
//       evaluations.terminalbench_v2_1       → term  (×100: AA 0-1 → 0-100)
//       evaluations.artificial_analysis_coding_index → codingIndex
//       evaluations.artificial_analysis_math_index   → mathIndex (optional)
//       median_output_tokens_per_second      → outputTokensPerSecond
//       median_time_to_first_token_seconds   → timeToFirstTokenSeconds
//       median_time_to_first_answer_token    → timeToFirstAnswerTokenSeconds
//   - blended = (3*input + output)/4 computed LOCALLY; the upstream
//     price_1m_blended_3_to_1 value is IGNORED.
//   - cacheRead/cacheWrite are NEVER written by AA (not in FIELD_MAP;
//     pre-existing non-AA cache fields are preserved untouched).
//   - Optional fields are finite-only: absent/non-finite values stay
//     absent and are documented in `notes` (never synthesized as 0/null).
//   - `effort` (from the alias table) is written on EVERY AA-covered entry.
//   - AA slug → curated key that does NOT exist in models.json → a minimal
//     new entry is CREATED (name/effort/AA fields/pricingSource/sources;
//     benchlm placeholder {score:null,...}; NO fabricated benchlm; no
//     arena/swePro/sweVer/tier).
//   - benchlm/arena/swePro/sweVer on existing entries stay untouched.
//   - schemaVersion = 4 on write. Consolidation is PR 3 — NOT this unit.
//   - Missing known curated keys → WARN + preserve (never delete).
//
// Pre-PR2 (current scraper): pricing.input/output paths, mapAaId flow,
// schema 3. Every v2 test below is RED until scripts/scrape-artificialanalysis.js
// is migrated (2.2).

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

/**
 * v2 alias table ({slug, to, effort}) with the curated keys the tests
 * merge into. Bare slugs carry their EXPLICIT effort (gpt-5-5 = xhigh,
 * never inferred from slug shape).
 */
function writeAliases() {
  fsImpl.writeFileSync(
    aliasesPath,
    JSON.stringify({
      _meta: { version: 2, notes: 'AA slug → curated key + effort (v2).' },
      aliases: [
        { slug: 'claude-sonnet-5', to: 'sonnet5', effort: 'max' },
        { slug: 'gpt-5-5', to: 'gpt55', effort: 'xhigh' },
        { slug: 'kimi-k3', to: 'kimik3', effort: 'max' },
        { slug: 'gpt-5-6-luna', to: 'gpt56luna', effort: 'max' },
        { slug: 'gpt-5-6-luna-xhigh', to: 'gpt56lunaXhigh', effort: 'xhigh' },
        { slug: 'gpt-5-6-luna-high', to: 'gpt56lunaHigh', effort: 'high' },
        { slug: 'gpt-5-6-luna-medium', to: 'gpt56lunaMedium', effort: 'medium' },
        { slug: 'gpt-5-6-luna-low', to: 'gpt56lunaLow', effort: 'low' },
        { slug: 'gpt-5-6-luna-non-reasoning', to: 'gpt56lunaNonReasoning', effort: 'non-reasoning' },
        { slug: 'deepseek-v4-flash', to: 'deepseekv4f', effort: 'max' },
      ],
    }, null, 2),
    'utf-8',
  );
}

/**
 * Temp models.json. Existing curated entries carry full benchmark blocks
 * (benchlm / arena / swePro / sweVer — MUST stay unchanged) and vendor
 * pricing that AA may overwrite. `mimo25` is tracked but NOT mentioned by
 * AA in most tests → warn/preserve path. sonnet5 keeps a legacy non-AA
 * `cacheRead` to prove AA never touches it.
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
        _meta: { schemaVersion: 3, sources: ['scrape-benchlm'] },
        models: {
          sonnet5: mk('sonnet5', { cacheRead: 0.25, term: 50 }),
          gpt55: mk('gpt55'),
          kimik3: mk('kimik3'),
          gpt56luna: mk('gpt56luna'),
          mimo25: mk('mimo25'), // tracked but absent from most AA payloads
        },
      },
      null,
      2,
    ),
    'utf-8',
  );
}

/** Serialize an AA-style payload: `{ data: [...] }` (AA v2 response shape). */
function aaResponse(entries) {
  return JSON.stringify({ data: entries });
}

const BASE_ARGS = () => ({ dryRun: false, file: modelsPath, source: 'https://aa.test/api', quiet: true, aliasPath: aliasesPath });

/** Minimal complete v2-shaped AA entry (all optional fields present). */
function v2Entry(overrides = {}) {
  return {
    id: 'uuid-0000-0000-0000-000000000000',
    slug: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    pricing: {
      price_1m_blended_3_to_1: 99, // MUST be IGNORED — blended is local
      price_1m_input_tokens: 2,
      price_1m_output_tokens: 10,
    },
    evaluations: {
      terminalbench_v2_1: 0.805243445692884, // 0-1 ratio → term ×100
      artificial_analysis_coding_index: 71.5,
      artificial_analysis_math_index: 93.4, // optional, present here
    },
    median_output_tokens_per_second: 79.985,
    median_time_to_first_token_seconds: 132.838,
    median_time_to_first_answer_token: 132.838,
    ...overrides,
  };
}

describe('scrape-artificialanalysis — v2 mapping + merge', () => {
  test('FIELD_MAP v2: price_1m_* → input/output, local blended (upstream IGNORED), term ×100, codingIndex, mathIndex, speed fields, effort; benchlm/arena/swePro/sweVer untouched; schema 4', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry(), // sonnet5 — every optional field present
      {
        id: 'uuid-5555-5555-5555-555555555555', slug: 'gpt-5-5', name: 'GPT-5.5',
        pricing: { price_1m_blended_3_to_1: 42, price_1m_input_tokens: 1.25, price_1m_output_tokens: 10 },
        evaluations: { terminalbench_v2_1: 0.5, artificial_analysis_coding_index: 74.9 },
        median_output_tokens_per_second: 0,
        median_time_to_first_token_seconds: 0,
        median_time_to_first_answer_token: 0,
      },
    ]));

    const result = await runScrape({ ...BASE_ARGS(), source: null }, { fetchText });
    expect(result.ok).toBe(true);
    expect(result.changes).toBeGreaterThan(0);
    expect(fetchText).toHaveBeenCalledTimes(1);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // FIELD_MAP v2 pricing paths (the OLD pricing.input/output shape is gone).
    expect(after.models.sonnet5.input).toBe(2);
    expect(after.models.sonnet5.output).toBe(10);
    expect(after.models.sonnet5.blended).toBe((3 * 2 + 10) / 4); // upstream 99 IGNORED
    expect(after.models.gpt55.blended).toBe((3 * 1.25 + 10) / 4); // upstream 42 IGNORED

    // term = terminalbench_v2_1 × 100 (0-1 ratio → 0-100).
    expect(after.models.sonnet5.term).toBeCloseTo(0.805243445692884 * 100, 10);
    expect(after.models.gpt55.term).toBe(50); // 0.5 × 100 — clean value

    // Evaluations + speed fields mapped to their v2 curated names.
    expect(after.models.sonnet5.codingIndex).toBe(71.5);
    expect(after.models.sonnet5.mathIndex).toBe(93.4); // optional, present → written
    expect(after.models.sonnet5.outputTokensPerSecond).toBe(79.985);
    expect(after.models.sonnet5.timeToFirstTokenSeconds).toBe(132.838);
    expect(after.models.sonnet5.timeToFirstAnswerTokenSeconds).toBe(132.838);
    // The OLD curated names must NOT exist anymore.
    expect('median_output_tokens_per_second' in after.models.sonnet5).toBe(false);
    expect('median_time_to_first_token_seconds' in after.models.sonnet5).toBe(false);

    // effort written on every AA-covered entry (explicit per alias).
    expect(after.models.sonnet5.effort).toBe('max');
    expect(after.models.gpt55.effort).toBe('xhigh'); // bare gpt-5-5 is xhigh, never inferred

    // Non-AA cache field preserved (AA never touches it).
    expect(after.models.sonnet5.cacheRead).toBe(0.25);

    // Provenance: per-model sources[] append + _meta.sources tag + schema v4.
    expect(after.models.sonnet5.sources).toContainEqual({
      url: 'https://artificialanalysis.ai/',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      scraper: 'scrape-artificialanalysis',
    });
    expect(after._meta.sources).toContain('scrape-artificialanalysis');
    expect(after._meta.sources).toContain('scrape-benchlm'); // prior tags preserved
    expect(after._meta.schemaVersion).toBe(4);

    // benchlm / arena / swePro / sweVer MUST stay unchanged.
    expect(after.models.sonnet5.benchlm).toEqual({ score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } });
    expect(after.models.sonnet5.arena).toBe(1507);
    expect(after.models.sonnet5.swePro).toBe(62.4);
    expect(after.models.sonnet5.sweVer).toBe(77.8);
    expect(after.models.gpt55.benchlm).toEqual({ score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } });
    expect(after.models.gpt55.tier).toBe('high'); // curated field preserved
  });

  test('NO cacheRead/cacheWrite are ever written by AA (payload cache keys ignored; pre-existing non-AA cache fields preserved)', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry({
        pricing: { price_1m_input_tokens: 2, price_1m_output_tokens: 10, cacheRead: 0.3, cacheWrite: 4.5 },
      }),
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    // AA must NOT write the payload cache keys — sonnet5 keeps its legacy 0.25.
    expect(after.models.sonnet5.cacheRead).toBe(0.25);
    expect('cacheWrite' in after.models.sonnet5).toBe(false);
  });

  test('partial optional data: non-finite/absent optional fields are NOT written (no 0/null fabrication) and are documented in notes; finite zero IS written', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      // sonnet5: NO optional fields at all.
      { id: 'uuid-s1', slug: 'claude-sonnet-5', name: 'Claude Sonnet 5', pricing: { price_1m_input_tokens: 3, price_1m_output_tokens: 15 } },
      // kimik3: codingIndex finite; everything else non-finite/absent.
      {
        id: 'uuid-k3', slug: 'kimi-k3', name: 'Kimi K3',
        pricing: { price_1m_input_tokens: 0.6, price_1m_output_tokens: 2.2 },
        evaluations: { terminalbench_v2_1: null, artificial_analysis_coding_index: 55, artificial_analysis_math_index: null },
        median_output_tokens_per_second: 'n/a', // string — NOT finite
        median_time_to_first_token_seconds: null,
      },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // sonnet5: nothing optional returned → all six stay absent, documented.
    expect('term' in after.models.sonnet5).toBe(false);
    expect('codingIndex' in after.models.sonnet5).toBe(false);
    expect('mathIndex' in after.models.sonnet5).toBe(false);
    expect('outputTokensPerSecond' in after.models.sonnet5).toBe(false);
    expect('timeToFirstTokenSeconds' in after.models.sonnet5).toBe(false);
    expect('timeToFirstAnswerTokenSeconds' in after.models.sonnet5).toBe(false);
    expect(after.models.sonnet5.notes).toMatch(/AA sync \d{4}-\d{2}-\d{2}: omitted term, codingIndex, mathIndex, outputTokensPerSecond, timeToFirstTokenSeconds, timeToFirstAnswerTokenSeconds/);
    expect(after.models.sonnet5.notes).toContain('curated note'); // curated content preserved

    // kimik3: only the finite codingIndex is written; non-finite stay absent + documented.
    expect(after.models.kimik3.codingIndex).toBe(55);
    expect('term' in after.models.kimik3).toBe(false);
    expect('mathIndex' in after.models.kimik3).toBe(false);
    expect('outputTokensPerSecond' in after.models.kimik3).toBe(false);
    expect('timeToFirstTokenSeconds' in after.models.kimik3).toBe(false);
    expect(after.models.kimik3.notes).toMatch(/omitted term, mathIndex, outputTokensPerSecond, timeToFirstTokenSeconds, timeToFirstAnswerTokenSeconds/);
  });

  test('finite ZERO speed values from AA are written (finite-only, not positive-only)', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      {
        id: 'uuid-z', slug: 'gpt-5-5', name: 'GPT-5.5',
        pricing: { price_1m_input_tokens: 5, price_1m_output_tokens: 30 },
        evaluations: { terminalbench_v2_1: 0.842696629213483, artificial_analysis_coding_index: 74.9 },
        median_output_tokens_per_second: 0,
        median_time_to_first_token_seconds: 0,
        median_time_to_first_answer_token: 0,
      },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.gpt55.outputTokensPerSecond).toBe(0);
    expect(after.models.gpt55.timeToFirstTokenSeconds).toBe(0);
    expect(after.models.gpt55.timeToFirstAnswerTokenSeconds).toBe(0);
    // A returned 0 is NOT absence — no omission note for the speed fields.
    expect(after.models.gpt55.notes).not.toMatch(/omitted outputTokensPerSecond/);
  });
});

describe('scrape-artificialanalysis — slug-based mapping (mapAaSlug)', () => {
  test('unknown non-curated slug is IGNORED — run ok, no entry created/merged, no fail', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      {
        id: 'uuid-oss', slug: 'gpt-oss-120b', name: 'gpt-oss-120b (high)',
        pricing: { price_1m_input_tokens: 0.15, price_1m_output_tokens: 0.6 },
        evaluations: { terminalbench_v2_1: 0.262172284644195, artificial_analysis_coding_index: 30.4, artificial_analysis_math_index: 93.4 },
        median_output_tokens_per_second: 178.041,
        median_time_to_first_token_seconds: 0.498,
        median_time_to_first_answer_token: 11.731,
      },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);
    expect(result.changes).toBe(0); // nothing merged, nothing written

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect('gptoss120b' in after.models).toBe(false); // not created
    expect(after.models.sonnet5.input).toBe(0.5); // untouched
  });

  test('known slug + changed UUID → still mapped and merged (UUID changes are NOT fatal)', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry({ id: 'brand-new-uuid-abcdef' }), // UUID changed, slug stable
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);
    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.sonnet5.input).toBe(2);
  });

  test('entry with a MISSING slug → AA_UNKNOWN_SLUG fail closed; valid siblings NOT merged; file byte-identical (atomic)', async () => {
    writeAliases();
    writeModels();
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry(), // valid sibling
      { id: 'uuid-missing-slug', name: 'No Slug', pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 4 } }, // slug absent
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('alias');
    expect(result.code).toBe('AA_UNKNOWN_SLUG');
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });

  test('tracked model absent from the AA response is preserved (warn list returned, sorted)', async () => {
    writeAliases();
    writeModels();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const fetchText = vi.fn(async () => aaResponse([
        v2Entry(), // sonnet5 only
      ]));

      const result = await runScrape({ ...BASE_ARGS(), quiet: false }, { fetchText });
      expect(result.ok).toBe(true);
      expect(result.missing).toEqual(['gpt55', 'gpt56luna', 'kimik3', 'mimo25']); // sorted

      const warns = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(warns).toMatch(/warn: curated key "mimo25" was not returned/);

      const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
      expect(after.models.mimo25).toBeDefined(); // preserved, not deleted
      expect(after.models.mimo25.benchlm.score).toBe(77);
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('scrape-artificialanalysis — variant creation', () => {
  test('AA slug → curated key NOT in models.json → minimal entry created (name/effort/AA fields/pricingSource/sources; benchlm placeholder; NO fabricated benchlm; no arena/swePro/sweVer)', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry({
        slug: 'gpt-5-6-luna',
        name: 'GPT-5.6 Luna (max)',
        pricing: { price_1m_blended_3_to_1: 0.45, price_1m_input_tokens: 0.2, price_1m_output_tokens: 1.2 },
      }),
      {
        id: 'uuid-luna-x', slug: 'gpt-5-6-luna-xhigh', name: 'GPT-5.6 Luna (xhigh)',
        pricing: { price_1m_blended_3_to_1: 0.45, price_1m_input_tokens: 0.2, price_1m_output_tokens: 1.2 },
        evaluations: { terminalbench_v2_1: 0.779026217228464, artificial_analysis_coding_index: 68.6, artificial_analysis_math_index: null },
        median_output_tokens_per_second: 170.161,
        median_time_to_first_token_seconds: 21.142,
        median_time_to_first_answer_token: 21.142,
      },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // Existing bare entry merged (effort from alias, pricing from AA).
    expect(after.models.gpt56luna.effort).toBe('max');
    expect(after.models.gpt56luna.input).toBe(0.2);
    expect(after.models.gpt56luna.benchlm).toEqual({ score: 77, verified: true, reliability: 0.9, categories: { coding: 80 } }); // untouched

    // Variant CREATED as a minimal record.
    const v = after.models.gpt56lunaXhigh;
    expect(v).toBeDefined();
    expect(v.name).toBe('GPT-5.6 Luna (xhigh)');
    expect(v.effort).toBe('xhigh');
    expect(v.input).toBe(0.2);
    expect(v.output).toBe(1.2);
    expect(v.blended).toBe(0.45);
    expect(v.term).toBeCloseTo(0.779026217228464 * 100, 10);
    expect(v.codingIndex).toBe(68.6);
    expect(v.outputTokensPerSecond).toBe(170.161);
    expect(v.timeToFirstTokenSeconds).toBe(21.142);
    expect(v.timeToFirstAnswerTokenSeconds).toBe(21.142);
    expect(v.pricingSource).toBe('artificialanalysis');
    expect(v.sources).toContainEqual({
      url: 'https://artificialanalysis.ai/',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      scraper: 'scrape-artificialanalysis',
    });
    // NO fabricated benchlm: explicit null-score placeholder, not a number.
    expect(v.benchlm).toEqual({ score: null, verified: false, reliability: 0, categories: {} });
    expect(typeof v.benchlm.score).not.toBe('number'); // null is not a number
    // No curated-only or sibling-benchmark fields fabricated.
    expect('arena' in v).toBe(false);
    expect('swePro' in v).toBe(false);
    expect('sweVer' in v).toBe(false);
    expect('tier' in v).toBe(false);
    // mathIndex was null → absent + documented (never synthesized).
    expect('mathIndex' in v).toBe(false);
    expect(v.notes).toMatch(/omitted mathIndex/);
  });

  test('brand-new family: bare slug maps to a key with no prior entry → created with effort from the alias', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      {
        id: 'uuid-dsf', slug: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash',
        pricing: { price_1m_input_tokens: 0.3, price_1m_output_tokens: 0.6, price_1m_blended_3_to_1: 0.4 },
        evaluations: { terminalbench_v2_1: 0.65, artificial_analysis_coding_index: 70.1 },
        median_output_tokens_per_second: 300.5,
        median_time_to_first_token_seconds: 0.4,
        median_time_to_first_answer_token: 0.4,
      },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    const v = after.models.deepseekv4f;
    expect(v).toBeDefined();
    expect(v.name).toBe('DeepSeek V4 Flash');
    expect(v.effort).toBe('max');
    expect(v.blended).toBe((3 * 0.3 + 0.6) / 4); // upstream 0.4 IGNORED
    expect(v.term).toBe(65); // 0.65 × 100
    expect(v.codingIndex).toBe(70.1);
    expect(v.outputTokensPerSecond).toBe(300.5);
    expect(v.pricingSource).toBe('artificialanalysis');
    expect(v.benchlm).toEqual({ score: null, verified: false, reliability: 0, categories: {} });
  });
});

describe('scrape-artificialanalysis — failure paths (v2)', () => {
  test('malformed JSON response → fail loud (parse phase); canonical data untouched', async () => {
    writeAliases();
    writeModels();
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => '{ definitely not valid json !!');

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('parse');
    expect(result.error).toMatch(/not valid JSON/);
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });

  test('mapped entry missing required pricing (no price_1m_output_tokens) → SKIPPED with warn; valid siblings still merged; skipped record keeps old values', async () => {
    writeAliases();
    writeModels();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const fetchText = vi.fn(async () => aaResponse([
        v2Entry(), // sonnet5 complete
        { id: 'uuid-g55', slug: 'gpt-5-5', name: 'GPT-5.5', pricing: { price_1m_input_tokens: 5 } }, // output absent
      ]));

      const result = await runScrape({ ...BASE_ARGS(), quiet: false }, { fetchText });
      expect(result.ok).toBe(true); // partial data is NOT fatal

      const warns = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(warns).toMatch(/warn: curated key "gpt55" skipped/);

      const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
      expect(after.models.sonnet5.input).toBe(2); // valid sibling merged
      expect(after.models.gpt55.input).toBe(0.5); // skipped entry keeps old values
      expect(after.models.gpt55.output).toBe(1.5);
      expect(after._meta.schemaVersion).toBe(4); // write happened for sonnet5
    } finally {
      logSpy.mockRestore();
    }
  });

  test('required pricing absent on EVERY mapped entry → structural drift fail (AA_REQUIRED_FIELD_MISSING); file untouched', async () => {
    writeAliases();
    writeModels();
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'uuid-g55', slug: 'gpt-5-5', name: 'GPT-5.5', pricing: { price_1m_input_tokens: 5 } }, // output absent
      { id: 'uuid-s1', slug: 'claude-sonnet-5', name: 'Claude Sonnet 5', pricing: {} }, // both absent
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(result.code).toBe('AA_REQUIRED_FIELD_MISSING');
    expect(result.error).toMatch(/output/);
    expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
  });

  test('renamed required field (price_1m_output_tokens → price_1m_outputs) → never guessed: entry skipped, old value preserved', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      { id: 'uuid-s1', slug: 'claude-sonnet-5', name: 'Claude Sonnet 5', pricing: { price_1m_input_tokens: 3, price_1m_outputs: 15 } },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true); // partial-data skip, not fatal
    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    // The renamed value must NOT be mapped into `output` — no guessing.
    expect(after.models.sonnet5.output).toBe(1.5); // old vendor value preserved
    expect(after.models.sonnet5.input).toBe(0.5); // no partial patch either
  });

  test('non-finite required pricing (string input) → entry skipped, siblings unaffected', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry(),
      { id: 'uuid-k3', slug: 'kimi-k3', name: 'Kimi K3', pricing: { price_1m_input_tokens: '3 USD', price_1m_output_tokens: 15 } },
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText });
    expect(result.ok).toBe(true);
    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.sonnet5.input).toBe(2); // sibling merged
    expect(after.models.kimik3.input).toBe(0.5); // skipped, old value kept
  });
});

describe('scrape-artificialanalysis — CLI flags', () => {
  test('--dry-run: merges in memory but does NOT write (file byte-identical)', async () => {
    writeAliases();
    writeModels();
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');

    const fetchText = vi.fn(async () => aaResponse([
      v2Entry(),
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
      v2Entry(),
    ]));

    const result = await runScrape(BASE_ARGS(), { fetchText }); // file = modelsPath (override)
    expect(result.ok).toBe(true);

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));
    expect(after.models.sonnet5.input).toBe(2);
    expect(fsImpl.readFileSync(defaultPath, 'utf-8')).toBe(defaultBefore);
  });

  test('--source <real fixture>: reads tests/fixtures/aa-sample.json (true v2 shape), no HTTP; real merge + variant creation; uncurated slug ignored; schema 4', async () => {
    writeAliases();
    writeModels();

    const fetchText = vi.fn(async () => {
      throw new Error('fetchText must not be called when --source is a local fixture');
    });

    const result = await runScrape({ ...BASE_ARGS(), source: AA_FIXTURE }, { fetchText });
    expect(result.ok).toBe(true);
    expect(fetchText).not.toHaveBeenCalled();

    const after = JSON.parse(fsImpl.readFileSync(modelsPath, 'utf-8'));

    // Real AA v2 values — price_1m_* mapped, upstream blended IGNORED, term ×100.
    expect(after.models.gpt56luna.input).toBe(0.2);
    expect(after.models.gpt56luna.output).toBe(1.2);
    expect(after.models.gpt56luna.blended).toBe(0.45); // fixture price_1m_blended_3_to_1 = 0.45 — local formula wins anyway
    expect(after.models.gpt56luna.term).toBeCloseTo(0.808988764044944 * 100, 10);
    expect(after.models.gpt56luna.codingIndex).toBe(71.4);
    expect(after.models.gpt56luna.effort).toBe('max');
    expect(after.models.gpt56luna.outputTokensPerSecond).toBe(165.737);
    expect(after.models.gpt56luna.timeToFirstTokenSeconds).toBe(76.41);
    expect(after.models.gpt56luna.timeToFirstAnswerTokenSeconds).toBe(76.41);

    // gpt55: real zeros ARE written (finite-only), effort = xhigh (explicit).
    expect(after.models.gpt55.input).toBe(5);
    expect(after.models.gpt55.blended).toBe(11.25);
    expect(after.models.gpt55.term).toBeCloseTo(0.842696629213483 * 100, 10);
    expect(after.models.gpt55.effort).toBe('xhigh');
    expect(after.models.gpt55.outputTokensPerSecond).toBe(0);

    // claude-sonnet-5 + kimi-k3 merged; non-AA cache field preserved.
    expect(after.models.sonnet5.input).toBe(2);
    expect(after.models.sonnet5.effort).toBe('max');
    expect(after.models.sonnet5.cacheRead).toBe(0.25);
    expect(after.models.kimik3.blended).toBe(6);
    expect(after.models.kimik3.effort).toBe('max');

    // 6 luna slugs → 1 existing merged + 5 variants CREATED (no consolidation in PR 2).
    expect(after.models.gpt56lunaXhigh.effort).toBe('xhigh');
    expect(after.models.gpt56lunaXhigh.name).toBe('GPT-5.6 Luna (xhigh)');
    expect(after.models.gpt56lunaHigh.effort).toBe('high');
    expect(after.models.gpt56lunaMedium.effort).toBe('medium');
    expect(after.models.gpt56lunaLow.effort).toBe('low');
    expect(after.models.gpt56lunaNonReasoning.effort).toBe('non-reasoning');
    expect(after.models.gpt56lunaXhigh.benchlm).toEqual({ score: null, verified: false, reliability: 0, categories: {} });

    // Uncurated slug (gpt-oss-120b) is IGNORED — no entry created.
    expect('gptoss120b' in after.models).toBe(false);

    // Tracked-but-absent mimo25 preserved.
    expect(result.missing).toEqual(['mimo25']);
    expect(after.models.mimo25).toBeDefined();

    // Schema v4 on write.
    expect(after._meta.schemaVersion).toBe(4);
  });
});

describe('scrape-artificialanalysis — missing secret soft-fail', () => {
  test('no AA_API_KEY → ::warning:: on stderr + ok:true/skipped (CLI exits 0); no fetch; file untouched', async () => {
    writeAliases();
    writeModels();
    delete process.env.AA_API_KEY;
    const beforeBytes = fsImpl.readFileSync(modelsPath, 'utf-8');
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchText = vi.fn(async () => {
      throw new Error('fetchText must not be called when AA_API_KEY is missing');
    });

    try {
      const result = await runScrape({ ...BASE_ARGS(), source: null }, { fetchText });

      expect(result.ok).toBe(true);
      expect(result.skipped).toBe('missing-secret');
      expect(result.phase).toBeUndefined();
      expect(result.changes).toBeUndefined();
      expect(fetchText).not.toHaveBeenCalled();

      const warning = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(warning).toContain('::warning::');
      expect(warning).toContain('AA_API_KEY');

      expect(fsImpl.readFileSync(modelsPath, 'utf-8')).toBe(beforeBytes);
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
