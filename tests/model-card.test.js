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
});