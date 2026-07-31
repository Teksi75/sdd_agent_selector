// tests/p2-polish.test.js
// V5+ P2 polish (2026-07-31). Covers the structural source-of-truth
// changes that the build pipeline inlines into dist/index.html. Behavior
// that's covered by other component tests (config-selector scroll-to-impact,
// tier-tag data-tier attribute) is duplicated here for self-containedness
// of the polish arc.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const TOKENS_CSS = readFileSync(join(ROOT, 'css', 'tokens.css'), 'utf-8');

describe('P2-1 — deep-link ids', () => {
  test('index.html tiene los 3 tier sections con id para deep-linking', () => {
    expect(INDEX_HTML).toMatch(/<section\s+id="tier-1"\s+aria-labelledby="tier-1-label"/);
    expect(INDEX_HTML).toMatch(/<section\s+id="tier-2"\s+aria-labelledby="tier-2-label"/);
    expect(INDEX_HTML).toMatch(/<section\s+id="tier-3"\s+aria-labelledby="tier-3-label"/);
  });

  test('tokens.css define scroll-margin-top para los tier sections', () => {
    // The rule must apply scroll-margin to the 3 deep-link targets so
    // the viewport scrolls past the (potentially sticky) config bar.
    expect(TOKENS_CSS).toMatch(/#tier-1,#tier-2,#tier-3\s*\{\s*scroll-margin-top/);
  });
});

describe('P2-3 — sticky config-selector', () => {
  test('index.html envuelve #config-mount en .config-sticky', () => {
    // The structural pattern is:
    //   <div class="config-sticky">
    //     <section id="config-mount" ...></section>
    //   </div>
    expect(INDEX_HTML).toMatch(/<div class="config-sticky">\s*<section id="config-mount"/);
  });

  test('tokens.css define .config-sticky con position:sticky + backdrop-blur', () => {
    expect(TOKENS_CSS).toMatch(/\.config-sticky\s*\{[^}]*position:\s*sticky/s);
    expect(TOKENS_CSS).toMatch(/\.config-sticky\s*\{[^}]*backdrop-filter:\s*blur/s);
  });
});

describe('P2-6 — color-blind safe tier-tag', () => {
  test('tokens.css inyecta shape prefix por data-tier (▲●▽◆)', () => {
    // high → ▲ (U+25B2)
    expect(TOKENS_CSS).toMatch(/\.tier-tag\[data-tier="high"\]::before\s*\{\s*content:\s*"\\25B2/);
    // balanced → ● (U+25CF)
    expect(TOKENS_CSS).toMatch(/\.tier-tag\[data-tier="balanced"\]::before\s*\{\s*content:\s*"\\25CF/);
    // budget → ▽ (U+25BD)
    expect(TOKENS_CSS).toMatch(/\.tier-tag\[data-tier="budget"\]::before\s*\{\s*content:\s*"\\25BD/);
    // reference → ◆ (U+25C6)
    expect(TOKENS_CSS).toMatch(/\.tier-tag\[data-tier="reference"\]::before\s*\{\s*content:\s*"\\25C6/);
  });

  test('tokens.css también cubre .model-tier-tag (model-card.js)', () => {
    // The model-card component uses .model-tier-tag instead of .tier-tag.
    // Color-blind users viewing the ref-table get the same shape prefix.
    const shapeRules = TOKENS_CSS.match(/\.model-tier-tag\[data-tier="[^"]+"\]::before/g) || [];
    expect(shapeRules.length).toBe(4);
  });
});
