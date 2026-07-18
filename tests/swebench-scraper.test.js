// @vitest-environment node
// tests/swebench-scraper.test.js
// Assertion-only coverage of existing merge behavior; red-first is not applicable.
// Boundary: exercise the pure merge seam used by the CLI. Fetching and HTML parsing
// stay outside this preservation test so it never requires network access.

import { describe, expect, test } from 'vitest';
import { mergeSweBenchResults } from '../scripts/swebench-merge.mjs';

describe('SWE-bench scraper merge preservation', () => {
  test('updates only sweVer and appends scraper provenance to manual fields', () => {
    const manualSource = {
      url: 'https://lmarena.ai/leaderboard',
      date: '2026-07-17',
    };
    const existing = {
      name: 'Kimi K3',
      arena: 1486,
      swePro: null,
      sweVer: null,
      term: null,
      input: 3,
      output: 15,
      tier: 'high',
      notes: 'Manual dated provenance that the scraper must preserve.',
      sources: [manualSource],
    };
    const models = { kimik3: existing };
    const matched = [
      {
        name: 'Kimi K3',
        key: 'kimik3',
        stats: { pct: 83.7, resolved: 837, total: 1000 },
      },
    ];

    const merged = mergeSweBenchResults(
      models,
      matched,
      'https://www.swebench.com/',
      '2026-07-18',
      'scrape-swebench-leaderboard'
    );

    expect(merged.kimik3).toEqual({
      ...existing,
      sweVer: 83.7,
      sources: [
        manualSource,
        {
          url: 'https://www.swebench.com/',
          date: '2026-07-18',
          scraper: 'scrape-swebench-leaderboard',
          resolved: '837/1000',
        },
      ],
    });
    expect(models.kimik3).toBe(existing);
    expect(models.kimik3.sweVer).toBeNull();
    expect(models.kimik3.notes).toBe(existing.notes);
    expect(models.kimik3.sources).toEqual([manualSource]);
  });
});
