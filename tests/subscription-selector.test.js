// tests/subscription-selector.test.js
// V5 slice 2 — Tier-1 subscription selector (task 2.6).
//
// Contract (delta spec "Provider Preference Persistence" + design
// "Preferencias de proveedor"):
//   - default all-enabled; one control per registry provider.
//   - localStorage `sdd-providers-v1` shape `{ version: 1, enabled: {...} }`
//     with EVERY known id present (including `false`).
//   - invalid JSON / wrong version / unknown id / missing known id /
//     non-boolean value → reset to all-enabled and rewrite with known ids.
//   - localStorage unavailable → in-memory fallback, never throws.
//   - every change emits `sdd-provider-filter-change` with
//     `{ version, enabled, enabledIds }` (registry order) AFTER state+storage.
//   - `data-action="enable-all"` CTA behaves exactly like the "all" action.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  render,
  getEnabled,
  enableAll,
  disableAll,
  setVisibleCount,
  setEmptyState,
  STORAGE_KEY,
} from '../js/components/subscription-selector.js';

const providers = [
  { id: 'opencode-go', name: 'Opencode Go', tier: 'Go', url: 'https://a.test', updated: '2026-09-12' },
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', tier: 'Plus', url: 'https://b.test', updated: '2026-09-12' },
  { id: 'minimax', name: 'MiniMax', tier: 'Coding', url: 'https://c.test', updated: '2026-09-12' },
];

function allTrue() {
  return { 'opencode-go': true, 'chatgpt-plus': true, minimax: true };
}

function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  render(el, providers);
  return el;
}

function captureEvents() {
  const details = [];
  const handler = (e) => details.push(e.detail);
  window.addEventListener('sdd-provider-filter-change', handler);
  return { details, stop: () => window.removeEventListener('sdd-provider-filter-change', handler) };
}

describe('subscription-selector — render + default state', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  test('defaults to all-enabled with one checkbox per registry provider', () => {
    const el = mount();
    const boxes = el.querySelectorAll('input[data-provider-id]');
    expect(boxes).toHaveLength(3);
    for (const box of boxes) expect(box.checked).toBe(true);
    expect(getEnabled()).toEqual(allTrue());
  });

  test('associates a label with each control and exposes aria-live count', () => {
    const el = mount();
    for (const provider of providers) {
      const label = el.querySelector(`label[for="provider-${provider.id}"]`);
      expect(label).not.toBeNull();
      expect(label.textContent).toContain(provider.name);
    }
    expect(el.querySelector('[data-role="visible-count"]').getAttribute('aria-live')).toBe('polite');
  });
});

describe('subscription-selector — toggles, shortcuts and events', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  test('toggle updates state, persists every known id and emits after storage', () => {
    const el = mount();
    const capture = captureEvents();
    let enabledAtEventTime = null;
    const probe = () => JSON.parse(localStorage.getItem(STORAGE_KEY)).enabled;
    const onEvent = () => {
      enabledAtEventTime = probe();
    };
    window.addEventListener('sdd-provider-filter-change', onEvent);
    try {
      const box = el.querySelector('input[data-provider-id="chatgpt-plus"]');
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));

      expect(getEnabled()).toEqual({ 'opencode-go': true, 'chatgpt-plus': false, minimax: true });
      expect(enabledAtEventTime).toEqual(allTrueWithChatGPTPlusOff());
      expect(enabledAtEventTime).not.toBeNull();
      expect(capture.details).toHaveLength(1);
      expect(capture.details[0].version).toBe(1);
      expect(capture.details[0].enabled).toEqual(allTrueWithChatGPTPlusOff());
      expect(capture.details[0].enabledIds).toEqual(['opencode-go', 'minimax']);
    } finally {
      window.removeEventListener('sdd-provider-filter-change', onEvent);
      capture.stop();
    }
  });

  test('"none" and "all" shortcuts update every control and the persisted map', () => {
    const el = mount();
    const capture = captureEvents();
    try {
      el.querySelector('[data-action="none"]').click();
      expect(getEnabled()).toEqual({ 'opencode-go': false, 'chatgpt-plus': false, minimax: false });
      for (const box of el.querySelectorAll('input[data-provider-id]')) expect(box.checked).toBe(false);

      el.querySelector('[data-action="all"]').click();
      expect(getEnabled()).toEqual(allTrue());
      expect(capture.details.at(-1).enabledIds).toEqual(['opencode-go', 'chatgpt-plus', 'minimax']);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).enabled).toEqual(allTrue());
    } finally {
      capture.stop();
    }
  });

  test('enable-all CTA behaves exactly like the "all" action', () => {
    const el = mount();
    const capture = captureEvents();
    try {
      disableAll();
      setEmptyState(true);
      expect(el.querySelector('[data-role="empty-state"]').hidden).toBe(false);

      el.querySelector('[data-action="enable-all"]').click();
      expect(getEnabled()).toEqual(allTrue());
      expect(capture.details).toHaveLength(2);
      expect(capture.details.at(-1).enabledIds).toEqual(['opencode-go', 'chatgpt-plus', 'minimax']);
    } finally {
      capture.stop();
    }
  });

  test('re-render restores the persisted selection (reload contract)', () => {
    const first = mount();
    first.querySelector('input[data-provider-id="minimax"]').checked = false;
    first.querySelector('input[data-provider-id="minimax"]').dispatchEvent(new Event('change', { bubbles: true }));

    const second = mount();
    expect(second.querySelector('input[data-provider-id="minimax"]').checked).toBe(false);
    expect(getEnabled().minimax).toBe(false);
  });

  test('visible count element renders the given count', () => {
    const el = mount();
    setVisibleCount(7);
    expect(el.querySelector('[data-role="visible-count"]').textContent).toContain('7');
  });
});

describe('subscription-selector — storage validation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const invalidStored = {
    'invalid JSON': 'not-json::{{{}',
    'wrong version': JSON.stringify({ version: 0, enabled: allTrue() }),
    'unknown id': JSON.stringify({ version: 1, enabled: { ...allTrue(), 'unknown-provider': true } }),
    'missing known id': JSON.stringify({ version: 1, enabled: { 'opencode-go': true, 'chatgpt-plus': true } }),
    'non-boolean value': JSON.stringify({ version: 1, enabled: { ...allTrue(), minimax: 'yes' } }),
  };

  for (const [label, raw] of Object.entries(invalidStored)) {
    test(`${label} → resets to all-enabled and rewrites known ids only`, () => {
      localStorage.setItem(STORAGE_KEY, raw);
      mount();
      expect(getEnabled()).toEqual(allTrue());
      const rewritten = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(rewritten).toEqual({ version: 1, enabled: allTrue() });
    });
  }

  test('localStorage unavailable → in-memory fallback with no throw', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
      removeItem() { throw new Error('denied'); },
    });
    try {
      const el = mount();
      expect(getEnabled()).toEqual(allTrue());
      const box = el.querySelector('input[data-provider-id="minimax"]');
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      expect(getEnabled().minimax).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('subscription-selector — separation from the loader cache', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  test('clearCache() from data-loader never touches sdd-providers-v1', async () => {
    mount();
    const { clearCache } = await import('../js/services/data-loader.js');
    clearCache();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ version: 1, enabled: allTrue() });
  });
});

function allTrueWithChatGPTPlusOff() {
  return { 'opencode-go': true, 'chatgpt-plus': false, minimax: true };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

describe('subscription-selector — sticky mount (task 2.7)', () => {
  const INDEX_HTML = readFileSync(join(ROOT, 'index.html'), 'utf-8');
  const TOKENS_CSS = readFileSync(join(ROOT, 'css', 'tokens.css'), 'utf-8');

  test('index.html mounts #subscription-selector-mount before #config-mount in the single sticky bar', () => {
    // Segment between the sticky wrapper open and #config-mount must carry
    // the selector mount → it is the first child, same bar, no second bar.
    const segment = INDEX_HTML.match(/<div class="config-sticky">([\s\S]*?)<section id="config-mount"/);
    expect(segment).not.toBeNull();
    expect(segment[1]).toContain('id="subscription-selector-mount"');
    expect(INDEX_HTML.match(/class="config-sticky"/g)).toHaveLength(1);
  });

  test('tokens.css carries the provider chip/checkbox + aria-live count styles', () => {
    expect(TOKENS_CSS).toMatch(/\.provider-chip\s*\{/);
    expect(TOKENS_CSS).toMatch(/\.provider-selector\s*\[data-role="visible-count"\]\s*\{/);
    expect(TOKENS_CSS).toMatch(/\.provider-selector\s*\[data-role="empty-state"\]\[hidden\]\s*\{/);
  });
});
