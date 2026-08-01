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
    // The section may carry aria-busy and skeleton placeholders for
    // P2-8 (the pattern is a laxa match on the wrapper + the id).
    expect(INDEX_HTML).toMatch(/<div class="config-sticky">[\s\S]*?<section id="config-mount"/);
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

// ============================================================================
// P2-4 — glossary (html)
// ============================================================================
describe('P2-4 — glossary details en el hero', () => {
  test('index.html tiene un <details> con data-test="glossary" (o el patrón equivalente)', () => {
    // El match es laxo: el summary puede tener hijos (icon ▸, etc.)
    // antes del texto. Buscamos "Glosario de abreviaciones" en
    // cualquier parte del HTML y un <dl> con data-test="glossary".
    expect(INDEX_HTML).toMatch(/Glosario de abreviaciones/);
    expect(INDEX_HTML).toMatch(/data-test="glossary"/);
  });

  test('el glossary cubre las 5 abreviaciones críticas + tier + lifecycle + soft fallback', () => {
    const expected = [
      'arena', 'swePro', 'sweVer', 'term', 'BenchLM',
      'tier', 'lifecycle', 'minReasoning', 'costRatio', 'soft fallback',
    ];
    for (const term of expected) {
      // Cada abreviación aparece en un <dt> adentro del glossary <dl>.
      // El match es laxo: <dt> seguido de cualquier cosa (que puede
      // incluir un <code> adentro) y luego el término.
      const re = new RegExp(`<dt[^>]*>[\\s\\S]{0,40}?\\b${term}\\b`, 'i');
      expect(INDEX_HTML).toMatch(re);
    }
  });
});

// ============================================================================
// P2-7 — print stylesheet
// ============================================================================
describe('P2-7 — @media print', () => {
  test('tokens.css tiene un bloque @media print', () => {
    expect(TOKENS_CSS).toMatch(/@media\s+print\s*\{/);
  });

  test('@media print oculta los botones interactivos', () => {
    // El print stylesheet debe esconder: refresh, export, summary
    // toggles. El selector CSS exacto puede variar, pero la regla
    // "button" global + la exclusion de details summary es el patrón
    // que estamos verificando.
    expect(TOKENS_CSS).toMatch(/@media\s+print[\s\S]*?button[^}]*display:\s*none/);
  });

  test('@media print quita el fondo oscuro del body', () => {
    expect(TOKENS_CSS).toMatch(/@media\s+print[\s\S]*?body\s*\{[^}]*background:\s*#fff/);
  });

  test('@media print esconde los skeleton placeholders (artefacto de pre-hidratación)', () => {
    expect(TOKENS_CSS).toMatch(/@media\s+print[\s\S]*?\.skeleton\s*\{[^}]*display:\s*none/);
  });

  test('@media print convierte el sticky config-selector a static', () => {
    // El sticky no tiene sentido en papel — pasa a static.
    expect(TOKENS_CSS).toMatch(/@media\s+print[\s\S]*?\.config-sticky\s*\{[^}]*position:\s*static/);
  });
});

// ============================================================================
// P2-8 — skeleton placeholders
// ============================================================================
describe('P2-8 — skeleton placeholders en el HTML', () => {
  test('tokens.css tiene .skeleton con animación shimmer', () => {
    expect(TOKENS_CSS).toMatch(/\.skeleton\s*\{[^}]*animation:\s*skeleton-shimmer/);
    expect(TOKENS_CSS).toMatch(/@keyframes\s+skeleton-shimmer/);
  });

  test('tokens.css desactiva el skeleton con prefers-reduced-motion', () => {
    // El @media reduce ya está global; el skeleton también.
    expect(TOKENS_CSS).toMatch(/@media\s+\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.skeleton/);
  });

  test('index.html tiene skeleton placeholders en los 8 mount points', () => {
    // Los mount points que reciben contenido dinámico: config,
    // cli-mirror, justification, workflow, composite-chart,
    // pricing-chart, ref-table, freshness. Más el hero-stats nuevo.
    const mountIds = [
      'hero-stats-mount',
      'freshness-mount',
      'config-mount',
      'cli-mirror-mount',
      'justification-mount',
      'workflow-mount',
      'composite-chart-mount',
      'pricing-chart-mount',
      'ref-table-mount',
    ];
    for (const id of mountIds) {
      // Cada mount point debe tener al menos un .skeleton adentro del
      // contenedor para el render inicial.
      const re = new RegExp(`id="${id}"[\\s\\S]*?class="skeleton`, 'i');
      expect(INDEX_HTML).toMatch(re);
    }
  });

  test('los mount points tienen aria-busy="true" durante la hidratación', () => {
    // ARIA: el contenido dinámico debe marcarse busy hasta que el
    // render() corra. Esto le dice a screen readers "esperá, no
    // leas esto todavía". El hero-stats-mount y freshness-mount no
    // tienen aria-busy porque no son secciones con jerarquía
    // semántica de <section> — son inline <div>s.
    const mountIds = [
      'config-mount', 'cli-mirror-mount',
      'justification-mount', 'workflow-mount', 'composite-chart-mount',
      'pricing-chart-mount', 'ref-table-mount',
    ];
    for (const id of mountIds) {
      const re = new RegExp(`<section[^>]*id="${id}"[^>]*aria-busy="true"`, 'i');
      expect(INDEX_HTML).toMatch(re);
    }
  });
});
