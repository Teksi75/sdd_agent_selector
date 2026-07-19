// tests/model-card.test.js
// PR3 (benchlm-replace-custom-scoring) — model-card cutover.
//
// Pre-PR3 contract: model-card rendered a 4-column metric row (arena /
// swePro / sweVer / term) + a price row (input / output).
//
// Post-PR3 contract: the metric row collapses to a SINGLE BenchLM score
// row carrying the score, a verified/estimated badge, and a 5-dot
// reliability scale. Legacy 4-benchmark columns removed. Price row
// preserved unchanged.
//
// Tier badge, NEW badge, name, model-tier-tag, escaping, and null-model
// fallback retain their pre-PR3 behavior (regression coverage).

import { describe, test, expect, beforeEach } from 'vitest';

let target;
beforeEach(() => {
  target = document.createElement('section');
  document.body.appendChild(target);
});

let render, buildCard;

describe('model-card — render() contract (PR3 benchlm row)', () => {
  test('mounts a card with model name and tier badge', async () => {
    ({ render, buildCard } = await import('../js/components/model-card.js'));
    render(target, {
      name: 'MiMo V2.5',
      tier: 'budget',
      input: 0.14,
      output: 0.28,
      benchlm: { score: 87, verified: true, reliability: 0.88, categories: {} },
    });
    const card = target.querySelector('.model-card');
    expect(card).toBeDefined();
    expect(card.textContent).toMatch(/MiMo V2\.5/);
    expect(card.querySelector('.model-tier-tag').textContent).toMatch(/min/);
  });

  test('renders NEW badge when isNew=true', async () => {
    ({ render } = await import('../js/components/model-card.js'));
    render(target, {
      name: 'GLM-5.2',
      tier: 'high',
      input: 1.40,
      output: 4.40,
      isNew: true,
      benchlm: { score: 79.4, verified: true, reliability: 0.92, categories: {} },
    });
    expect(target.querySelector('.src-new')).toBeDefined();
  });

  test('buildCard() returns HTML even without a targetEl', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'X',
      tier: 'high',
      benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
    });
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
    const html = buildCard({
      name: 'Opus 4.8',
      tier: 'reference',
      benchlm: { score: 92, verified: true, reliability: 0.95, categories: {} },
    });
    expect(html).toMatch(/reference/);
  });

  // === PR3: BenchLM row contract ============================================

  test('(a) renders a SINGLE BenchLM row: score + verified badge + reliability dots', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'GLM-5.2',
      tier: 'high',
      input: 1.4,
      output: 4.4,
      benchlm: { score: 79.4, verified: true, reliability: 0.92, categories: {} },
    });
    // Score renders with one decimal.
    expect(html).toMatch(/79\.4/);
    // Verified badge with green styling.
    expect(html).toMatch(/data-badge="verified"/);
    expect(html).toMatch(/>verified</);
    // BenchLM row label.
    expect(html).toMatch(/benchlm/i);
    // Reliability dot container with at least the expected filled count.
    expect(html).toMatch(/data-reliability-dots/);
    expect(html).toMatch(/data-dot="filled"/);
    // Legacy 4-benchmark grid (grid-cols-4) is gone.
    expect(html).not.toMatch(/grid-cols-4/);
    // No SWE-Pro / SWE-Ver / Term cells (legacy fields).
    expect(html).not.toMatch(/SWE-Pro/);
    expect(html).not.toMatch(/SWE-Ver/);
    // Price row preserved.
    expect(html).toMatch(/In /);
    expect(html).toMatch(/Out /);
  });

  test('(a2) verified=false renders amber "estimated" badge', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'Weak',
      tier: 'balanced',
      input: 1,
      output: 2,
      benchlm: { score: 65, verified: false, reliability: 0.7, categories: {} },
    });
    // The badge text content must say "estimated" (not "verified").
    expect(html).toMatch(/data-badge="estimated"/);
    expect(html).toMatch(/>estimated</);
    // The data-verified attribute correctly mirrors the model's flag.
    expect(html).toMatch(/data-verified="false"/);
  });

  test('(b) benchlm.score=null renders "unavailable" placeholder (no score, no badge)', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'Pending',
      tier: 'balanced',
      input: 1,
      output: 2,
      benchlm: { score: null, verified: false, reliability: 0, categories: {} },
    });
    // The unavailable placeholder is shown.
    expect(html).toMatch(/unavailable/i);
    // No badge text on a placeholder row.
    expect(html).not.toMatch(/data-badge="verified"/);
    expect(html).not.toMatch(/data-badge="estimated"/);
    // Name still rendered so the user can identify the model.
    expect(html).toMatch(/Pending/);
  });

  test('(b2) no benchlm block at all also renders "unavailable"', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'NoBench',
      tier: 'balanced',
      input: 1,
      output: 2,
      // benchlm key ABSENT
    });
    expect(html).toMatch(/unavailable/i);
    expect(html).toMatch(/NoBench/);
  });

  test('price row preserved: input/output render with — placeholder when missing', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: 'X', tier: 'high',
      benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
    });
    expect(html).toMatch(/In —/);
    expect(html).toMatch(/Out —/);
  });

  test('escapes user-controlled strings in model names', async () => {
    ({ buildCard } = await import('../js/components/model-card.js'));
    const html = buildCard({
      name: '<img src=x onerror=alert(1)>',
      tier: 'high',
      benchlm: { score: 80, verified: true, reliability: 0.9, categories: {} },
    });
    expect(html).not.toMatch(/<img src=x onerror/);
    expect(html).toMatch(/&lt;img/);
  });
});
