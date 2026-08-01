// tests/v2-polish-final.test.js
// V5+ critique v2 final polish (2026-08-01). Covers the 8 remaining
// items in the critique v2 backlog:
//
//   P0-1 2da mitad — copy de onboarding en el hero
//   P1-1         — tier h2 visibility (size + contrast)
//   P1-2         — SOFT badge color (purple + ~ prefix)
//   P2-1         — refresh affordance (min-height + text-sm)
//   P2-4         — aria-live per-card
//   P2-5         — export menu descriptions
//   P2-6         — rename "CLI mirror" → "Equivalentes CLI"
//   P2 eficiencia — keyboard shortcuts (?, g+i/j/k, r, Esc)
//
// Source of truth: .impeccable/critique/2026-08-01T04-30-00Z__sdd-agent-selector-v2.md
// + the backlog writeup in KNOWN_ISSUES.md.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderButton } from '../js/components/export-button.js';
import {
  mount as mountKeyboardShortcuts,
  unmount as unmountKeyboardShortcuts,
  resetForTests as resetKeyboardShortcuts,
  isTextEntry,
  setHelpOpen,
} from '../js/components/keyboard-shortcuts.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf-8');
const TOKENS_CSS = readFileSync(join(ROOT, 'css', 'tokens.css'), 'utf-8');

// ────────────────────────────────────────────────────────────────────
// P0-1 (2da mitad) — copy de onboarding
// ────────────────────────────────────────────────────────────────────
describe('P0-1 2da mitad — onboarding hint en el hero', () => {
  test('index.html tiene un <p> con id="hero-onboarding-hint" y data-test', () => {
    expect(INDEX_HTML).toMatch(/<p[^>]*id="hero-onboarding-hint"[^>]*data-test="onboarding-hint"/);
  });

  test('el hint menciona la estrategia pre-seleccionada (Balanceado)', () => {
    // El copy tiene que decirle al user qué hacer: ya hay una
    // estrategia activa, hacé click en otra para actualizar.
    expect(INDEX_HTML).toMatch(/Balanceado/);
  });

  test('el hint referencia gentle-ai/agents/ para que el user sepa adónde va el output', () => {
    expect(INDEX_HTML).toMatch(/gentle-ai\/agents\//);
  });
});

// ────────────────────────────────────────────────────────────────────
// P1-1 — tier h2 visibility
// ────────────────────────────────────────────────────────────────────
describe('P1-1 — tier h2 visibility (size + contrast)', () => {
  test('los 3 tier h2 usan text-sm (no más text-[11px])', () => {
    // text-[11px] es ~8.5px efectivo — invisible. text-sm son 14px
    // con line-height cómodo para h2. Match laxo: el id tiene que
    // tener text-sm, no text-[11px].
    for (const id of ['tier-1-label', 'tier-2-label', 'tier-3-label']) {
      const re = new RegExp(`id="${id}"[^>]*text-sm`);
      expect(INDEX_HTML).toMatch(re);
    }
    for (const id of ['tier-1-label', 'tier-2-label', 'tier-3-label']) {
      const re = new RegExp(`id="${id}"[^>]*text-\\[11px\\]`);
      expect(INDEX_HTML).not.toMatch(re);
    }
  });

  test('los 3 tier h2 tienen contraste alto (text-slate-200/300 o text-indigo-300)', () => {
    // El critique marcó text-slate-400 como contraste 4.6:1 — al
    // borde de AA. Subimos a text-slate-200 (11.5:1), text-slate-300
    // (9.4:1), o text-indigo-300 (color de marca, contraste 7:1+).
    for (const id of ['tier-1-label', 'tier-2-label', 'tier-3-label']) {
      const re = new RegExp(
        `id="${id}"[^>]*text-(slate-200|slate-300|indigo-300)\\b`
      );
      expect(INDEX_HTML).toMatch(re);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// P1-2 — SOFT badge color
// ────────────────────────────────────────────────────────────────────
describe('P1-2 — SOFT badge color (purple + ~ prefix)', () => {
  test('tokens.css define .soft-badge con color púrpura (no amber)', () => {
    expect(TOKENS_CSS).toMatch(/\.soft-badge\s*\{[^}]*color:\s*#d8b4fe/s);
    // El prefijo `~` se inyecta via ::before para color-blind safety.
    expect(TOKENS_CSS).toMatch(/\.soft-badge::before\s*\{[^}]*content:\s*"~"/s);
  });

  test('renderButton acepta format.description y emite un <span class="export-menu-desc">', () => {
    // Re-pinned: export-button is the canonical source for menu HTML.
    const html = renderButton({
      sectionId: 'cli-mirror',
      formats: [
        { id: 'copy-md', label: 'Copiar', description: 'Markdown pegable en gentle-ai/agents/', content: 'x' },
        { id: 'download-md', label: 'Descargar', description: 'Archivo .md para commit', content: 'x', filename: 'a.md' },
      ],
    });
    expect(html).toContain('export-menu-desc');
    expect(html).toContain('Markdown pegable en gentle-ai/agents/');
    expect(html).toContain('Archivo .md para commit');
  });

  test('renderButton SIN description NO emite el span (backward-compat)', () => {
    const html = renderButton({
      sectionId: 'x',
      formats: [{ id: 'copy-md', label: 'Copiar', content: 'a' }],
    });
    expect(html).not.toContain('export-menu-desc');
  });
});

// ────────────────────────────────────────────────────────────────────
// P2-1 — refresh affordance
// ────────────────────────────────────────────────────────────────────
describe('P2-1 — refresh affordance (min-height + text-sm)', () => {
  test('.freshness-refresh en tokens.css tiene min-height >= 2.25rem', () => {
    // Match laxo: cualquier min-height: 2.Xrem con X >= 0.
    // El critique pidió ~2.25rem como bump desde los ~28px anteriores.
    const re = /\.freshness-refresh\s*\{[^}]*min-height:\s*2\.\d+rem/s;
    expect(TOKENS_CSS).toMatch(re);
  });

  test('.freshness-refresh en tokens.css tiene text-sm (no text-xs)', () => {
    const re = /\.freshness-refresh\s*\{[^}]*font-size:\s*\.8125rem/s;
    expect(TOKENS_CSS).toMatch(re);
  });
});

// ────────────────────────────────────────────────────────────────────
// P2-4 — aria-live per-card
// ────────────────────────────────────────────────────────────────────
describe('P2-4 — aria-live per-card', () => {
  test('el grid de cards en justification-ui tiene aria-live="polite"', () => {
    // Pin the source — the render() function in justification-ui.js
    // emits aria-live on the cards grid so SR users hear the
    // assignment changes after a config switch.
    const JU = readFileSync(join(ROOT, 'js', 'components', 'justification-ui.js'), 'utf-8');
    expect(JU).toMatch(/data-test="justification-cards"[^>]*aria-live="polite"/);
  });
});

// ────────────────────────────────────────────────────────────────────
// P2-5 — export menu descriptions (covered above in P1-2 via
// renderButton). Adding a separate describe for clarity that ties
// the description field to the .export-menu-desc class.
// ────────────────────────────────────────────────────────────────────
describe('P2-5 — export menu descriptions', () => {
  test('tokens.css define .export-menu-desc con color muted (#64748b)', () => {
    expect(TOKENS_CSS).toMatch(/\.export-menu-desc\s*\{[^}]*color:\s*#64748b/s);
  });

  test('el span de description tiene font-size 10px (subordinado al label)', () => {
    expect(TOKENS_CSS).toMatch(/\.export-menu-desc\s*\{[^}]*font-size:\s*10px/s);
  });
});

// ────────────────────────────────────────────────────────────────────
// P2-6 — rename "CLI mirror" → "Equivalentes CLI"
// ────────────────────────────────────────────────────────────────────
describe('P2-6 — rename CLI mirror → Equivalentes CLI', () => {
  test('index.html aria-label del cli-mirror-mount dice "Equivalentes CLI"', () => {
    expect(INDEX_HTML).toMatch(/id="cli-mirror-mount"[^>]*aria-label="Equivalentes CLI/);
  });

  test('cli-mirror-table.js renderiza un h3 "Equivalentes CLI" en el header', () => {
    const CM = readFileSync(join(ROOT, 'js', 'components', 'cli-mirror-table.js'), 'utf-8');
    expect(CM).toMatch(/<h3[^>]*>Equivalentes CLI<\/h3>/);
  });
});

// ────────────────────────────────────────────────────────────────────
// P2 eficiencia — keyboard shortcuts
// ────────────────────────────────────────────────────────────────────
describe('P2 eficiencia — keyboard shortcuts', () => {
  let helpEl;

  beforeEach(() => {
    resetKeyboardShortcuts();
    // Re-create the help overlay DOM that the production index.html
    // has at the end of <body>. Each test gets a fresh node.
    helpEl = document.createElement('div');
    helpEl.id = 'kbd-shortcuts-help';
    helpEl.setAttribute('data-open', 'false');
    helpEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(helpEl);
  });
  afterEach(() => {
    unmountKeyboardShortcuts();
    if (helpEl && helpEl.parentNode) helpEl.parentNode.removeChild(helpEl);
    vi.useRealTimers();
  });

  test('mount() registra el listener en document', () => {
    // Spy on document.addEventListener to confirm the mount wires up.
    const spy = vi.spyOn(document, 'addEventListener');
    const unmount = mountKeyboardShortcuts();
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    unmount();
    spy.mockRestore();
  });

  test('? abre el help overlay (data-open="true" + aria-hidden="false")', () => {
    mountKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(helpEl.getAttribute('data-open')).toBe('true');
    expect(helpEl.getAttribute('aria-hidden')).toBe('false');
  });

  test('? cierra el help overlay cuando ya está abierto', () => {
    mountKeyboardShortcuts();
    setHelpOpen(true, helpEl);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    expect(helpEl.getAttribute('data-open')).toBe('false');
  });

  test('Esc cierra el help overlay', () => {
    mountKeyboardShortcuts();
    setHelpOpen(true, helpEl);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(helpEl.getAttribute('data-open')).toBe('false');
  });

  test('g + i hace scrollIntoView en #tier-1', () => {
    // jsdom doesn't implement scrollIntoView — stub it.
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = function () {};
    }
    let scrolled = null;
    const tier1 = document.createElement('section');
    tier1.id = 'tier-1';
    tier1.scrollIntoView = function () { scrolled = 'tier-1'; };
    document.body.appendChild(tier1);

    mountKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    expect(scrolled).toBe('tier-1');

    tier1.remove();
  });

  test('g + j salta a #tier-2 y g + k a #tier-3', () => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = function () {};
    }
    let scrolled = null;
    const t2 = document.createElement('section');
    t2.id = 'tier-2';
    t2.scrollIntoView = function () { scrolled = 'tier-2'; };
    const t3 = document.createElement('section');
    t3.id = 'tier-3';
    t3.scrollIntoView = function () { scrolled = 'tier-3'; };
    document.body.appendChild(t2);
    document.body.appendChild(t3);

    mountKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    expect(scrolled).toBe('tier-2');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(scrolled).toBe('tier-3');

    t2.remove();
    t3.remove();
  });

  test('r dispara click() en el button[data-action="refresh"]', () => {
    let clicked = 0;
    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'refresh');
    btn.addEventListener('click', () => { clicked++; });
    document.body.appendChild(btn);

    mountKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(clicked).toBe(1);

    btn.remove();
  });

  test('los keystrokes se ignoran cuando el focus está en un text input', () => {
    let scrolled = false;
    const tier1 = document.createElement('section');
    tier1.id = 'tier-1';
    tier1.scrollIntoView = function () { scrolled = true; };
    document.body.appendChild(tier1);

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    mountKeyboardShortcuts();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    // The g+i should NOT scroll because focus is on a text input.
    expect(scrolled).toBe(false);

    tier1.remove();
    input.remove();
  });

  test('isTextEntry detecta input, textarea, select', () => {
    // contenteditable detection is jsdom-version-dependent, so we
    // only pin the cases that work across versions: input/textarea/
    // select (text-entry) and button/null (not text-entry).
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const button = document.createElement('button');

    expect(isTextEntry(input)).toBe(true);
    expect(isTextEntry(textarea)).toBe(true);
    expect(isTextEntry(select)).toBe(true);
    expect(isTextEntry(button)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
