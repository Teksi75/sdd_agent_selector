// tests/ref-table.test.js
// PR3 (benchlm-replace-custom-scoring) — ref-table cutover.
//
// Post-PR3 contract:
//   - Columns: name, tier, score, verified badge, reliability, input $,
//     output $, sources. Legacy 4-benchmark columns (arena / SWE-Pro /
//     SWE-Ver / Term) REMOVED.
//   - Score comes from benchlm.score; null is rendered as "—".
//   - Verified badge column reflects benchlm.verified (green / amber).
//   - Reliability column shows floor(reliability*5) filled dots (5-dot
//     scale per design).
//   - Source-badges cell still carries the inputs/outputs and NEW flag.
//   - Reference-tier models still sink to the bottom; sort still
//     descending by score; null scores rendered inline with "—".
//   - V5 follow-up: `isNew === true` rows are pinned to the top of the active
//     group (score/price tie-break unchanged inside each bucket).

import { describe, test, expect, beforeEach, vi } from 'vitest';
// S3b task 5.5 RED: II score/sort, null-II removed (not dimmed), shared note iff N>0.

describe('ref-table — S3b II-only (task 5.5)', () => {
  test('Score cell reads II and sorts II-desc; null-II rows removed with shared note', async () => {
    const { render } = await import('../js/components/ref-table.js');
    const models = {
      hi: { name: 'Hi', lifecycle: 'active', intelligenceIndex: 61.5, input: 2, output: 4, effort: 'high' },
      lo: { name: 'Lo', lifecycle: 'active', intelligenceIndex: 55.2, input: 1, output: 2, effort: 'medium' },
      nodata: { name: 'NoData', lifecycle: 'active', intelligenceIndex: null, input: 0.5, output: 1, effort: 'low' },
    };
    const t = document.createElement('div');
    document.body.appendChild(t);
    const summary = render(t, models, { modelsMeta: { lastSynced: '2026-09-13' } });
    expect(summary.rows).toBe(2);
    expect(t.querySelector('[data-model-key="nodata"]')).toBeNull();
    expect(t.textContent).toMatch(/1 models hidden/);
    expect(t.textContent).toMatch(/Artificial Analysis Intelligence Index/);
    const keys = Array.from(t.querySelectorAll('tr[data-model-key]')).map((tr) => tr.getAttribute('data-model-key'));
    expect(keys[0]).toBe('hi');
  });
  test('N=0 renders no hidden note', async () => {
    const { render } = await import('../js/components/ref-table.js');
    const models = { a: { name: 'A', lifecycle: 'active', intelligenceIndex: 42.3, input: 1, output: 2 } };
    const t = document.createElement('div');
    document.body.appendChild(t);
    render(t, models, { modelsMeta: { lastSynced: '2026-09-13' } });
    expect(t.textContent).not.toMatch(/models hidden/);
  });
});


import { render, rowsFor, buildExportFormats } from '../js/components/ref-table.js';

// Mixed-fixture: verified + estimated + unavailable + reference. Score
// ordering is clear: alpha (verified 85) > beta (estimated 65) >
// placeholder (null). Reference row delta also surfaces a score.
const FIXTURE = {
  alpha: {
    name: 'Alpha-1',
    tier: 'high',
    intelligenceIndex: 85,
    benchlm: { score: 85, verified: true, reliability: 0.92, categories: {} },
    input: 1.00,
    output: 3.00,
  },
  beta: {
    name: 'Beta-2',
    tier: 'balanced',
    intelligenceIndex: 65,
    benchlm: { score: 65, verified: false, reliability: 0.7, categories: {} },
    input: 0.50,
    output: 2.00,
    isNew: true,
  },
  pending: {
    name: 'Pending',
    tier: 'balanced',
    intelligenceIndex: 70,
    benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    input: 1.0,
    output: 2.0,
  },
  gamma: {
    name: 'Gamma-Reference',
    intelligenceIndex: 95,
    benchlm: { score: 95, verified: true, reliability: 0.95, categories: {} },
    input: 5.00,
    output: 25.00,
    tier: 'reference',
    isReference: true,
  },
  // isReference flag without tier=reference — also excluded from active pool.
  // Higher benchlm.score than gamma so it sorts first within references
  // (matches the legacy V3 baseline-comparison intent).
  delta: {
    name: 'Delta-Flagged-Reference',
    intelligenceIndex: 97,
    benchlm: { score: 97, verified: true, reliability: 0.9, categories: {} },
    input: 4.00,
    output: 20.00,
    isReference: true,
  },
};

let target;

beforeEach(() => {
  target = document.createElement('div');
  target.id = 'ref-table-mount';
  document.body.appendChild(target);
});

describe('ref-table — render() (PR3 benchlm columns)', () => {
  test('renders one ranked row per II-covered eligible non-reference model (S3d F2)', () => {
    const summary = render(target, FIXTURE);
    // beta + alpha + pending are active with finite II; gamma/delta are
    // reference-lifecycle → excluded from the ranked DOM (delta scenario).
    expect(summary.rows).toBe(3);

    const activeRows = Array.from(target.querySelectorAll('[data-test="active-rows"] tr'));
    const activeKeys = activeRows.map((tr) => tr.getAttribute('data-model-key'));
    // V5 follow-up: beta carries `isNew`, so it leads the active group.
    expect(activeKeys).toEqual(['beta', 'alpha', 'pending']);

    const nonActiveSection = target.querySelector('[data-test="non-active-rows"]');
    expect(nonActiveSection, 'non-active section must be gone (S3d F2)').toBeNull();
    expect(target.querySelector('[data-model-key="gamma"]')).toBeNull();
    expect(target.querySelector('[data-model-key="delta"]')).toBeNull();
  });

  test('(d) isNew pins first; scored rows sort by benchlm.score descending; references last', () => {
    const summary = render(target, FIXTURE);
    const tbody = target.querySelector('tbody');
    const keys = Array.from(tbody.querySelectorAll('tr')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    // V5 follow-up: beta (isNew) is pinned above alpha despite the lower score;
    // score order still holds inside the non-isNew bucket.
    expect(keys[0]).toBe('beta');      // isNew (65)
    expect(keys[1]).toBe('alpha');     // 85
    expect(keys[2]).toBe('pending');   // null (unavailable)
    expect(summary.topKey).toBe('beta');
  });

  test('(a) delta columns: Modelo/Esfuerzo/Score-II/arena/swePro/sweVer/term/Input/Output/Sources; no Tier/Lifecycle/BenchLM (S3d F2)', () => {
    render(target, FIXTURE);
    // Modelo, Esfuerzo, Score, Arena, SWE-Pro, SWE-Ver, Term, Input $, Output $, Sources = 10.
    const ths = target.querySelectorAll('thead th');
    expect(ths.length).toBe(10);
    const labels = Array.from(ths).map((th) => th.textContent.trim());
    expect(labels).toEqual(['Modelo', 'Esfuerzo', 'Score', 'Arena', 'SWE-Pro', 'SWE-Ver', 'Term', 'Input $', 'Output $', 'Sources']);
    // Tier/Lifecycle/BenchLM headers are gone (effort-only delta contract).
    expect(labels).not.toContain('Tier');
    expect(labels).not.toContain('Lifecycle');
    expect(labels).not.toContain('BenchLM');
    // No tier markup survives anywhere in the rendered table.
    expect(target.querySelectorAll('[data-tier]').length).toBe(0);
    expect(target.querySelectorAll('.tier-tag').length).toBe(0);
    expect(target.querySelectorAll('.model-tier-tag').length).toBe(0);
    // BenchLM-provenance + reliability cells are gone from every row.
    expect(target.querySelectorAll('[data-benchlm-cell]').length).toBe(0);
    expect(target.querySelectorAll('[data-reliability-dots]').length).toBe(0);

    // The alpha row scores match the data.
    const alpha = target.querySelector('tr[data-model-key="alpha"]');
    expect(alpha.textContent).toMatch(/85/);
  });

  test('(b) source badges reflect available benchmarks; missing benchmark shows no badge (S3d F2)', () => {
    // Delta scenario: arena:1500 + swePro:60 + term:null → arena and swe
    // badges present, no term badge. Pricing badge unchanged.
    render(target, {
      m: { name: 'M', lifecycle: 'active', intelligenceIndex: 60, arena: 1500, swePro: 60, term: null, input: 1, output: 2 },
    });
    const row = target.querySelector('tr[data-model-key="m"]');
    const sources = row.querySelectorAll('td')[9].innerHTML;
    expect(sources).toMatch(/src-arena/);
    expect(sources).toMatch(/src-swe/);
    expect(sources).not.toMatch(/src-term/);
    expect(row.textContent).toMatch(/1500/);
  });

  test('(c) no BenchLM reliability scale survives the column removal (S3d F2)', () => {
    // Contract-correct rewrite (never softened): the BenchLM-provenance
    // column is removed per the delta column list, so floor(reliability*5)
    // dots MUST be absent from every row — pinning them would pin the defect.
    render(target, FIXTURE);
    expect(target.querySelectorAll('[data-reliability-dots]').length).toBe(0);
    expect(target.querySelectorAll('[data-dot="filled"]').length).toBe(0);
  });

  test('benchlm-null with finite II shows II; truly II-less rows hidden (S3b)', () => {
    render(target, FIXTURE, { modelsMeta: { lastSynced: '2026-09-13' } });
    const pending = target.querySelector('tr[data-model-key="pending"]');
    expect(pending, 'pending II 70 benchlm-null stays visible').not.toBeNull();
    expect(pending.textContent).toMatch(/70/);
    const t2 = document.createElement('div'); document.body.appendChild(t2);
    render(t2, { ok: { name: 'Ok', lifecycle: 'active', intelligenceIndex: 42.3, input: 1, output: 1 }, x: { name: 'X', lifecycle: 'active', intelligenceIndex: null, input: 1, output: 1 } }, { modelsMeta: { lastSynced: '2026-09-13' } });
    expect(t2.querySelector('[data-model-key="x"]')).toBeNull();
    expect(t2.textContent).toMatch(/1 models hidden/);
  });

  test('returns a summary with referenceModel when present', () => {
    const summary = render(target, FIXTURE);
    expect(summary.referenceModel).not.toBeNull();
    expect(summary.referenceModel.name).toBe('Gamma-Reference');
  });

  test('renders an empty-state card when models is empty', () => {
    const summary = render(target, {});
    expect(summary.rows).toBe(0);
    expect(summary.topKey).toBeNull();
    expect(target.querySelector('tbody')).toBeNull();
    expect(target.querySelector('[data-test="empty-state"]')).not.toBeNull();
    expect(target.textContent).toMatch(/No hay modelos elegibles/i);
  });

  test('renders an empty-state card when models is null', () => {
    const summary = render(target, null);
    expect(summary.rows).toBe(0);
    expect(summary.topKey).toBeNull();
    expect(target.textContent).toMatch(/No model data available|No data/i);
  });

  test('throws TypeError when targetEl is missing or not an HTMLElement', () => {
    expect(() => render(null, FIXTURE)).toThrow(TypeError);
    expect(() => render({}, FIXTURE)).toThrow(TypeError);
  });

  test('shows a NEW badge for isNew: true models', () => {
    render(target, FIXTURE);
    const html = target.innerHTML;
    expect(html).toMatch(/src-new/);
  });

  test('escapes user-controlled strings in model names', () => {
    const evil = {
      x: {
        name: '<img src=x onerror=alert(1)>',
        tier: 'high',
        intelligenceIndex: 80,
        benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
        input: 1,
        output: 2,
      },
    };
    render(target, evil);
    expect(target.innerHTML).not.toMatch(/<img src=x onerror/);
    expect(target.innerHTML).toMatch(/&lt;img/);
  });

  test('renders independent effort variants and leaves the badge absent when effort is missing', () => {
    const models = {
      gpt55: {
        name: 'GPT-5.5',
        tier: 'high',
        lifecycle: 'active',
        effort: 'xhigh',
        intelligenceIndex: 85,
        benchlm: { score: 85, verified: true, reliability: 0.9, categories: {} },
      },
      gpt55High: {
        name: 'GPT-5.5 High',
        tier: 'high',
        lifecycle: 'active',
        effort: 'high',
        intelligenceIndex: 80,
        benchlm: { score: 80, verified: true, reliability: 0.8, categories: {} },
      },
      gpt55Medium: {
        name: 'GPT-5.5 Medium',
        tier: 'high',
        lifecycle: 'active',
        effort: 'medium',
        intelligenceIndex: 75,
        benchlm: { score: 75, verified: true, reliability: 0.7, categories: {} },
      },
      legacy: {
        name: 'Legacy model',
        tier: 'balanced',
        lifecycle: 'active',
        intelligenceIndex: 60,
        benchlm: { score: 60, verified: false, reliability: 0.6, categories: {} },
      },
    };

    const summary = render(target, models);
    expect(summary.rows).toBe(4);
    expect(target.querySelectorAll('tr[data-model-key]')).toHaveLength(4);

    expect(target.querySelector('tr[data-model-key="gpt55"] [data-effort="xhigh"]')?.textContent)
      .toBe('Extremo alto');
    expect(target.querySelector('tr[data-model-key="gpt55High"] [data-effort="high"]')?.textContent)
      .toBe('Alto');
    expect(target.querySelector('tr[data-model-key="gpt55Medium"] [data-effort="medium"]')?.textContent)
      .toBe('Medio');
    expect(target.querySelector('tr[data-model-key="legacy"] [data-effort]')).toBeNull();
  });
});

describe('ref-table — reference display order and legacy filtering', () => {
  const CATALOG_FIXTURE = {
    glm52: {
      name: 'GLM-5.2',
      tier: 'high',
      lifecycle: 'active',
      intelligenceIndex: 63.96,
      benchlm: { score: 63.96, verified: false, reliability: 0.63, categories: {} },
      input: 1.4,
      output: 4.4,
    },
    gpt56sol: {
      name: 'GPT-5.6 Sol',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      intelligenceIndex: 81.96,
      benchlm: { score: 81.96, verified: true, reliability: 0.75, categories: {} },
      input: 5,
      output: 30,
      isNew: true,
    },
    opus48: {
      name: 'Claude Opus 4.8',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      intelligenceIndex: 78.34,
      benchlm: { score: 78.34, verified: true, reliability: 0.63, categories: {} },
      input: 5,
      output: 25,
    },
    gpt55: {
      name: 'gpt-5.5',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      intelligenceIndex: 73.51,
      benchlm: { score: 73.51, verified: false, reliability: 0.88, categories: {} },
      input: 5,
      output: 30,
    },
    gpt56terra: {
      name: 'GPT-5.6 Terra',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      intelligenceIndex: 72.57,
      benchlm: { score: 72.57, verified: false, reliability: 0.75, categories: {} },
      input: 2.5,
      output: 15,
      isNew: true,
    },
    gpt56luna: {
      name: 'GPT-5.6 Luna',
      tier: 'budget',
      lifecycle: 'reference',
      isReference: true,
      intelligenceIndex: 67.17,
      benchlm: { score: 67.17, verified: false, reliability: 0.5, categories: {} },
      input: 1,
      output: 6,
    },
    glm51: {
      name: 'GLM-5.1',
      tier: 'high',
      lifecycle: 'legacy',
      intelligenceIndex: 67.74,
      benchlm: { score: 67.74, verified: true, reliability: 0.5, categories: {} },
      input: 1.4,
      output: 4.4,
    },
    glm5: {
      name: 'GLM-5',
      tier: 'budget',
      lifecycle: 'legacy',
      intelligenceIndex: 66.06,
      benchlm: { score: 66.06, verified: true, reliability: 0.88, categories: {} },
      input: 1,
      output: 3.2,
    },
  };

  test('reference rows never reach the ranked DOM; only II-covered active rows render (S3d F2)', () => {
    const summary = render(target, CATALOG_FIXTURE);
    expect(summary.rows).toBe(1);
    expect(target.querySelector('[data-test="non-active-rows"]')).toBeNull();
    const keys = Array.from(target.querySelectorAll('tr[data-model-key]')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(keys).toEqual(['glm52']);
    for (const ref of ['gpt56sol', 'opus48', 'gpt56terra', 'gpt56luna', 'gpt55']) {
      expect(target.querySelector(`[data-model-key="${ref}"]`)).toBeNull();
    }
  });

  test('legacy rows (glm51, glm5) do not render', () => {
    render(target, CATALOG_FIXTURE);
    const allKeys = Array.from(target.querySelectorAll('tr[data-model-key]')).map(
      (tr) => tr.getAttribute('data-model-key')
    );
    expect(allKeys).not.toContain('glm51');
    expect(allKeys).not.toContain('glm5');
  });

  test('single ranked section: active ranked rows only, no reference section (S3d F2)', () => {
    render(target, CATALOG_FIXTURE);
    const activeRows = Array.from(target.querySelectorAll('[data-test="active-rows"] tr'));
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].getAttribute('data-model-key')).toBe('glm52');
    expect(target.querySelector('[data-test="non-active-rows"]')).toBeNull();
  });

  test('summary counts ranked rows only; header/footer never mention non-active (S3d F2)', () => {
    const summary = render(target, CATALOG_FIXTURE);
    expect(summary.rows).toBe(1);
    expect(summary.topKey).toBe('glm52');
    const summaryText = target.querySelector('p.mt-3').textContent;
    expect(summaryText).toMatch(/Showing 1 active model/);
    expect(summaryText).not.toMatch(/non-active/);
  });

  test('ranked rows show II scores with effort-only markup (no tier survivors, S3d F2)', () => {
    render(target, CATALOG_FIXTURE);
    const glm52 = target.querySelector('tr[data-model-key="glm52"]');
    expect(glm52.textContent).toMatch(/64\.0/);

    // Effort-only: no tier badge/attribute leaks through the ranked rows.
    expect(target.querySelectorAll('[data-tier]').length).toBe(0);
    expect(target.querySelectorAll('.tier-tag').length).toBe(0);
  });
});

// V5 Slice 3 — eligible-only rendering + filtered export contract.
// The component renders exactly the eligible set it receives (app.js feeds
// applyProviderFilter's output) and exports that same view by default; the
// full catalog is an explicit opt-in action, never inferred.
describe('ref-table — V5 Slice 3 eligible-only + filtered export', () => {
  const CTX = {
    providerIds: ['alpha', 'beta'],
    providerNames: ['Alpha', 'Beta'],
    timestamp: '2026-09-12T00:00:00.000Z',
  };
  const CATALOG = {
    ...FIXTURE,
    catalogOnly: {
      name: 'Catalog Only',
      tier: 'balanced',
      intelligenceIndex: 50,
      benchlm: { score: 50, verified: true, reliability: 0.5, categories: {} },
      input: 1,
      output: 2,
    },
  };

  function mockClipboard() {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    return writeText;
  }

  async function clickFormat(mount, id) {
    const toggle = mount.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const btn = mount.querySelector(`[data-format-id="${id}"]`);
    expect(btn).not.toBeNull();
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
  }

  test('rinde solo el set elegible recibido: ninguna fila fuera del set', () => {
    const summary = render(target, { alpha: FIXTURE.alpha, beta: FIXTURE.beta });
    expect(summary.rows).toBe(2);
    const keys = Array.from(target.querySelectorAll('tr[data-model-key]')).map((tr) =>
      tr.getAttribute('data-model-key')
    );
    expect(keys.sort()).toEqual(['alpha', 'beta']);
    expect(target.querySelector('[data-model-key="pending"]')).toBeNull();
    expect(target.querySelector('[data-model-key="gamma"]')).toBeNull();
  });

  test('set elegible vacío: empty-state label dedicado, cero filas', () => {
    const summary = render(target, {});
    expect(summary.rows).toBe(0);
    expect(target.querySelectorAll('tr[data-model-key]').length).toBe(0);
    const empty = target.querySelector('[data-test="empty-state"]');
    expect(empty).not.toBeNull();
        expect(target.querySelector('[data-test="hidden-ii-note"]')).toBeNull();
    expect(empty.textContent).toMatch(/No hay modelos elegibles/i);
  });

  test('all-II-less set renders the empty state WITH the shared hidden note (S3d F3)', () => {
    // Every hiding surface iff N > 0: hidden N = total > 0 here, so the
    // empty-state path must carry the note. (The full-catalog export note
    // stays N/A there by spec — it hides nothing — see progress log.)
    const t2 = document.createElement('div');
    document.body.appendChild(t2);
    const summary = render(t2, {
      a: { name: 'A', lifecycle: 'active', intelligenceIndex: null, input: 1, output: 1 },
      b: { name: 'B', lifecycle: 'active', intelligenceIndex: null, input: 1, output: 1 },
    }, { modelsMeta: { lastSynced: '2026-09-13' } });
    expect(summary.rows).toBe(0);
    expect(t2.querySelector('[data-test="empty-state"]')).not.toBeNull();
    expect(t2.querySelector('[data-test="hidden-ii-note"]')).not.toBeNull();
    expect(t2.textContent).toMatch(/2 models hidden/);
  });

  test('export default (filtered): header con scope + providers activos y solo el set visible', async () => {
    const writeText = mockClipboard();
    render(target, { alpha: FIXTURE.alpha }, { exportContext: CTX, fullCatalogModels: CATALOG });
    await clickFormat(target, 'copy-md');
    expect(writeText).toHaveBeenCalledTimes(1);
    const captured = writeText.mock.calls[0][0];
    expect(captured.split('\n')[0]).toBe(
      '<!-- sdd-export scope=filtered providers="Alpha, Beta" timestamp="2026-09-12T00:00:00.000Z" -->'
    );
    expect(captured).toContain('Alpha-1');
    expect(captured).not.toContain('Catalog Only');
    expect(captured).not.toContain('Beta-2');
  });

  test('full-catalog explícito: scope=full-catalog, catálogo completo y providers activos registrados', async () => {
    const writeText = mockClipboard();
    render(target, { alpha: FIXTURE.alpha }, { exportContext: CTX, fullCatalogModels: CATALOG });
    await clickFormat(target, 'copy-md-full-catalog');
    const captured = writeText.mock.calls[0][0];
    expect(captured.split('\n')[0]).toBe(
      '<!-- sdd-export scope=full-catalog providers="Alpha, Beta" timestamp="2026-09-12T00:00:00.000Z" -->'
    );
    expect(captured).toContain('Catalog Only');
  });

  test('set elegible vacío NO cambia el default a full-catalog', async () => {
    const writeText = mockClipboard();
    render(target, {}, { exportContext: CTX, fullCatalogModels: CATALOG });
    await clickFormat(target, 'copy-md');
    const captured = writeText.mock.calls[0][0];
    expect(captured).toContain('scope=filtered');
    expect(captured).not.toContain('Catalog Only');
  });

  test('la acción full-catalog aparece marcada en el menú', () => {
    render(target, { alpha: FIXTURE.alpha }, { exportContext: CTX, fullCatalogModels: CATALOG });
    const toggle = target.querySelector('[data-action="toggle-export-dropdown"]');
    toggle.click();
    const full = target.querySelector('[data-format-id="copy-md-full-catalog"]');
    expect(full).not.toBeNull();
    expect(full.getAttribute('data-export-scope')).toBe('full-catalog');
    const filtered = target.querySelector('[data-format-id="copy-md"]');
    expect(filtered.getAttribute('data-export-scope')).toBe('filtered');
  });
});

// V5 follow-up (v5-fup-acquire-003) — `isNew === true` active models are pinned
// to the top of the active group. The pin is scoped to the active lifecycle
// group: every isNew row (including null-score newcomers such as GPT-6 Astra)
// ranks above every non-isNew active row, while score desc / cheaper-input
// tie-break stays untouched inside each bucket and non-active rows keep their
// reference ordering.
describe('ref-table — isNew pin inside the active group (V5 follow-up)', () => {
  const PIN_FIXTURE = {
    scoredOld: {
      name: 'Scored Old',
      tier: 'high',
      intelligenceIndex: 90,
      benchlm: { score: 90, verified: true, reliability: 0.9, categories: {} },
      input: 1,
      output: 2,
    },
    newScored: {
      name: 'New Scored',
      tier: 'high',
      intelligenceIndex: 70,
      benchlm: { score: 70, verified: true, reliability: 0.7, categories: {} },
      input: 1,
      output: 2,
      isNew: true,
    },
    newUnscored: {
      name: 'New Unscored',
      tier: 'high',
      benchlm: { score: null, verified: false, reliability: 0, categories: {} },
      input: 1,
      output: 2,
      isNew: true,
    },
    oldUnscored: {
      name: 'Old Unscored',
      tier: 'high',
      benchlm: { score: null, verified: false, reliability: 0, categories: {} },
      input: 1,
      output: 2,
    },
    refNew: {
      name: 'Reference New',
      tier: 'reference',
      lifecycle: 'reference',
      isReference: true,
      isNew: true,
      intelligenceIndex: 99,
      benchlm: { score: 99, verified: true, reliability: 0.9, categories: {} },
      input: 5,
      output: 25,
    },
  };

  test('rowsFor: isNew leads the active group; score tie-break unchanged inside each bucket', () => {
    const { active, nonActive } = rowsFor(PIN_FIXTURE);
    expect(active.map(([key]) => key)).toEqual([
      'newScored',   // isNew, 70
      'newUnscored', // isNew, null score — no longer sinks to the bottom
      'scoredOld',   // 90 (non-isNew)
      'oldUnscored', // null score (non-isNew)
    ]);
    // The pin never crosses lifecycle groups: refNew stays out of `active`.
    expect(nonActive.map(([key]) => key)).toEqual(['refNew']);
  });

  test('render: the visible active rows follow the pinned order', () => {
    render(target, PIN_FIXTURE);
    const activeTable = target.querySelector('[data-test="active-rows"]');
    expect(activeTable).not.toBeNull();
    const keys = Array.from(activeTable.querySelectorAll('tr')).map((tr) =>
      tr.getAttribute('data-model-key')
    );
    expect(keys).toEqual(['newScored', 'scoredOld']);
  });

  test('inside a bucket, equal scores fall back to the cheaper input (tie-break as today)', () => {
    const models = {
      newPricey: {
        name: 'New Pricey',
        tier: 'high',
        intelligenceIndex: 80,
        benchlm: { score: 80, verified: true, reliability: 0.8, categories: {} },
        input: 3,
        output: 2,
        isNew: true,
      },
      newCheap: {
        name: 'New Cheap',
        tier: 'high',
        intelligenceIndex: 80,
        benchlm: { score: 80, verified: true, reliability: 0.8, categories: {} },
        input: 1,
        output: 2,
        isNew: true,
      },
      oldCheapest: {
        name: 'Old Cheapest',
        tier: 'high',
        intelligenceIndex: 80,
        benchlm: { score: 80, verified: true, reliability: 0.8, categories: {} },
        input: 0.5,
        output: 2,
      },
    };
    const { active } = rowsFor(models);
    expect(active.map(([key]) => key)).toEqual(['newCheap', 'newPricey', 'oldCheapest']);
  });
});

// PR-B (effort-only UI) — the reference table exports `Esfuerzo` and never
// `Tier`; the row/export contract forbids tierCell/data-tier/tier-tag.
describe('ref-table — effort-only export (PR-B)', () => {
  const EFFORT_MODELS = {
    alpha: {
      name: 'Alpha-1',
      tier: 'high',
      effort: 'max',
      lifecycle: 'active',
      intelligenceIndex: 85,
      benchlm: { score: 85, verified: true, reliability: 0.92, categories: {} },
      input: 1.0,
      output: 3.0,
    },
    legacy: {
      name: 'Legacy-No-Effort',
      tier: 'balanced',
      lifecycle: 'active',
      intelligenceIndex: 50,
      benchlm: { score: 50, verified: false, reliability: 0.5, categories: {} },
      input: 1.0,
      output: 2.0,
    },
  };

  test('filtered export mirrors the visible ranked set: 10 contract columns, no Lifecycle, no reference rows (S3e)', () => {
    const models = {
      ...EFFORT_MODELS,
      ref: {
        name: 'Ref-Model',
        tier: 'reference',
        isReference: true,
        intelligenceIndex: 99,
        benchlm: { score: 99, verified: true, reliability: 0.9, categories: {} },
        input: 5.0,
        output: 25.0,
      },
    };
    const formats = buildExportFormats(models);
    const md = formats.find((f) => f.id === 'copy-md').content;
    expect(md).toContain('| Modelo | Esfuerzo | Score | Arena | SWE-Pro | SWE-Ver | Term | Input $ | Output $ | Sources |');
    expect(md).not.toMatch(/\|\s*Lifecycle\s*\|/);
    expect(md).not.toMatch(/\|\s*Tier\s*\|/);
    expect(md).toContain('Alpha-1');
    expect(md).toContain('Máximo');
    // Missing effort exports as the em-dash placeholder, never an invented label.
    expect(md).toMatch(/Legacy-No-Effort \| —/);
    // Reference rows never reach the ranked export (visible-set rule).
    expect(md).not.toContain('Ref-Model');
    const json = formats.find((f) => f.id === 'download-json').content;
    expect(json).toContain('Alpha-1');
    expect(json).not.toContain('Ref-Model');
  });

  test('filtered export carries the shared hidden note iff N>0 (S3e)', () => {
    const clean = buildExportFormats(EFFORT_MODELS, { modelsMeta: { lastSynced: '2026-09-13' } });
    expect(clean.find((f) => f.id === 'copy-md').content).not.toMatch(/models hidden/);
    const withHidden = buildExportFormats(
      { ...EFFORT_MODELS, ghost: { name: 'Ghost', lifecycle: 'active', intelligenceIndex: null, input: 1, output: 1 } },
      { modelsMeta: { lastSynced: '2026-09-13' } }
    );
    expect(withHidden.find((f) => f.id === 'copy-md').content).toMatch(/1 models hidden/);
  });

  test('rendered rows carry at most the effort badge; invalid effort gets the placeholder, not a badge', () => {
    render(target, EFFORT_MODELS);
    expect(target.querySelector('[data-model-key="alpha"] [data-effort="max"]')?.textContent).toBe('Máximo');
    expect(target.querySelector('[data-model-key="legacy"] [data-effort]')).toBeNull();
    expect(target.querySelector('[data-model-key="legacy"]').textContent).toMatch(/—/);
  });

  test('out-of-vocabulary effort renders no badge and no invented label', () => {
    render(target, { weird: { name: 'Weird', tier: 'high', effort: 'turbo', lifecycle: 'active', intelligenceIndex: 42.3, benchlm: { score: 70, verified: true, reliability: 0.7, categories: {} } } });
    const row = target.querySelector('[data-model-key="weird"]');
    expect(row.querySelector('[data-effort]')).toBeNull();
    expect(row.textContent).not.toMatch(/turbo/);
  });
});
