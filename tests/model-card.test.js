// tests/model-card.test.js
// Phase 2e — model-card TDD (jsdom). The model-card is a reusable
// building block used by cli-mirror-table and justification-ui. It is
// small but its branches need explicit coverage so the global threshold
// stays above the 70% bar.

import { describe, test, expect, beforeEach } from 'vitest';

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, buildCard;

describe('model-card — render() contract', () => {
  test('mounts a card with model name and tier badge', async () => {
    ({ render, buildCard } = await import('../js/components/model-card.js'));
    render(target, {
      name: 'MiMo V2.5',
      tier: 'budget',
      arena: 1435,
      swePro: null,
      term: null,
      input: 0.14,
      output: 0.28,
    });
    const card = target.querySelector('.model-card');
    expect(card).toBeDefined();
    expect(card.textContent).toMatch(/MiMo V2\.5/);
    expect(card.querySelector('.model-tier-tag').textContent).toMatch(/min/);
    // Missing benchmarks render as "—".
    expect(card.textContent).toMatch(/—/);
  });

  test('renders NEW badge when isNew=true', async () => {
    ({ render } = await import('../js/components/model-card.js'));
    render(target, {
      name: 'GLM-5.2',
      tier: 'high',
      arena: 1595, swePro: 62.1, term: 81.0,
      input: 1.40, output: 4.40,
      isNew: true,
    });
    expect(target.querySelector('.src-new')).toBeDefined();
  });

  test('buildCard() returns HTML even without a targetEl', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({ name: 'X', tier: 'high' });
    expect(html).toMatch(/model-card/);
    expect(html).toMatch(/X/);
  });

  test('buildCard() handles null/undefined model with empty placeholder', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    expect(buildCard(null)).toMatch(/empty/);
    expect(buildCard(undefined)).toMatch(/empty/);
  });

  test('reference tier renders "reference" label', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({ name: 'Opus 4.8', tier: 'reference' });
    expect(html).toMatch(/reference/);
  });

  test('4-column grid renders Arena / SWE-Pro / SWE-Ver / Term cells', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'GLM-5.2',
      tier: 'high',
      arena: 1595,
      swePro: 62.1,
      sweVer: 77.8,
      term: 81.0,
      input: 1.4,
      output: 4.4,
    });
    // Root grid uses grid-cols-4 (4 benchmark cells, not 3).
    expect(html).toMatch(/grid-cols-4/);
    expect(html).not.toMatch(/grid-cols-3/);
    // All four benchmark values render in order.
    expect(html).toMatch(/1595/);
    expect(html).toMatch(/62\.1%/);
    expect(html).toMatch(/77\.8%/);
    expect(html).toMatch(/81\.0%/);
    // Labels present in the same order: Arena / SWE-Pro / SWE-Ver / Term.
    const arenaIdx = html.indexOf('Arena');
    const proIdx = html.indexOf('SWE-Pro');
    const verIdx = html.indexOf('SWE-Ver');
    const termIdx = html.indexOf('Term');
    expect(arenaIdx).toBeGreaterThan(-1);
    expect(proIdx).toBeGreaterThan(arenaIdx);
    expect(verIdx).toBeGreaterThan(proIdx);
    expect(termIdx).toBeGreaterThan(verIdx);
  });

  test('sweVer numeric value formats as percentage with 1 decimal', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'X', tier: 'high',
      arena: 1500, swePro: 70.0, sweVer: 89.0, term: 75.0,
    });
    expect(html).toMatch(/89\.0%/);
  });

  test('sweVer null renders exactly "—" placeholder, never "—%"', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'X', tier: 'high',
      arena: 1500, swePro: 70.0, sweVer: null, term: 75.0,
    });
    // Grid layout must stay intact.
    expect(html).toMatch(/grid-cols-4/);
    // sweVer cell shows the placeholder; it MUST NOT carry a stray "%".
    // Find the SWE-Ver <div> block and assert its numeric span.
    const verBlock = html.match(/SWE-Ver[\s\S]{0,200}?<\/div>/);
    expect(verBlock, 'SWE-Ver cell block should be present').toBeTruthy();
    expect(verBlock[0]).toMatch(/—/);
    expect(verBlock[0]).not.toMatch(/—%/);
  });

  test('swePro / term null placeholders also render exactly "—" (alignment)', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'X', tier: 'budget',
      arena: null, swePro: null, sweVer: 78.0, term: null,
    });
    expect(html).toMatch(/grid-cols-4/);
    // None of the percent cells may render "—%".
    expect(html).not.toMatch(/—%/);
    // Each percent cell renders the bare placeholder.
    expect(html).toMatch(/SWE-Pro[\s\S]{0,200}?—/);
    expect(html).toMatch(/Term[\s\S]{0,200}?—/);
  });
});