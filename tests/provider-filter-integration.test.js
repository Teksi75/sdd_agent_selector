// tests/provider-filter-integration.test.js
// V5 Slice 3 — end-to-end integration over the app transaction with a fixture
// of exclusive + shared models.
//
// Fixture (see tests/fixtures/v5-surfaces-fixture.js):
//   ref       reference · available on alpha + beta
//   shared    active    · available on alpha + beta (shared provider)
//   alphaOnly active    · exclusively alpha
//   betaOnly  active    · exclusively beta
//
// Asserts hide-not-dim (removed from DOM, NOT dimmed/opacity), assignments and
// alternatives inside the eligible set, filtered export content, and the
// all-disabled empty state with a WORKING enable-all CTA that restores the
// all-enabled state through the same recompute pipeline.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

import { createApp } from '../js/app.js';
import { buildSurfaceFixture } from './fixtures/v5-surfaces-fixture.js';
import { resetForTests as resetConfigSelector } from '../js/components/config-selector.js';

const MOUNT_IDS = [
  'subscription-selector-mount',
  'config-mount',
  'hero-stats-mount',
  'ref-table-mount',
  'composite-chart-mount',
  'pricing-chart-mount',
  'workflow-mount',
  'cli-mirror-mount',
  'justification-mount',
];

function setupDom() {
  document.body.innerHTML = MOUNT_IDS.map((id) => `<section id="${id}"></section>`).join('');
}

async function bootApp() {
  const fixture = buildSurfaceFixture();
  const app = createApp({
    load: async () => fixture,
    document,
    wireShortcuts: false,
    wireFreshness: false,
  });
  await app.boot();
  return { app, fixture };
}

function setEnabledViaEvent(enabledIds) {
  window.dispatchEvent(
    new CustomEvent('sdd-provider-filter-change', {
      detail: {
        version: 1,
        enabled: Object.fromEntries(enabledIds.map((id) => [id, true])),
        enabledIds,
      },
    })
  );
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

async function copyFrom(mount, sectionId) {
  const toggle = mount.querySelector(`[data-action="toggle-export-dropdown"][data-section="${sectionId}"]`);
  expect(toggle).not.toBeNull();
  toggle.click();
  const format = mount.querySelector('[data-format-id="copy-md"]');
  expect(format).not.toBeNull();
  format.click();
  await new Promise((r) => setTimeout(r, 0));
}

const ALL_SURFACE_IDS = [
  'ref-table-mount',
  'composite-chart-mount',
  'pricing-chart-mount',
  'workflow-mount',
  'cli-mirror-mount',
  'justification-mount',
];

beforeEach(() => {
  localStorage.clear();
  setupDom();
  resetConfigSelector();
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('provider-filter-integration — hide-not-dim across every surface', () => {
  test('deshabilitar beta elimina betaOnly de todas las superficies (no dimming) y del export', async () => {
    const { app } = await bootApp();
    // Baseline: both providers enabled → betaOnly visible everywhere it belongs.
    expect(document.querySelector('#ref-table-mount [data-model-key="betaOnly"]')).not.toBeNull();
    expect(document.querySelector('#composite-chart-mount [data-model-key="betaOnly"]')).not.toBeNull();
    expect(document.querySelector('#pricing-chart-mount [data-model-key="betaOnly"]')).not.toBeNull();

    const writeText = mockClipboard();
    setEnabledViaEvent(['alpha']);

    // Removed from the DOM — never a dimmed placeholder.
    for (const id of ALL_SURFACE_IDS) {
      const mount = document.querySelector(`#${id}`);
      expect(mount.querySelector('[data-model-key="betaOnly"]')).toBeNull();
      expect(mount.querySelector('[data-model-key="betaOnly"][style*="opacity"]')).toBeNull();
      expect(mount.innerHTML).not.toContain('Beta Only');
    }
    // Eligible exclusive model stays.
    expect(document.querySelector('#ref-table-mount [data-model-key="alphaOnly"]')).not.toBeNull();

    // Assignments + alternatives only from the eligible set.
    const state = app.getState();
    const values = Object.values(state.assignments);
    expect(values.every((a) => a.key === 'shared')).toBe(true);
    expect(values[0].alternatives.map((a) => a.key)).toEqual(['alphaOnly']);
    for (const a of values) {
      for (const alt of a.alternatives || []) {
        expect(Object.keys(state.eligibleModels)).toContain(alt.key);
      }
    }

    // Hero: X de Y visibles (Y estable en 3 activos del catálogo).
    const heroText = document
      .querySelector('#hero-stats-mount')
      .textContent.replace(/\s+/g, ' ');
    expect(heroText).toMatch(/2 de 3 visibles/);

    // Filtered export content: header names the ACTIVE provider and the body
    // only carries the visible models.
    await copyFrom(document.querySelector('#ref-table-mount'), 'ref-table');
    const refExport = writeText.mock.calls[0][0];
    expect(refExport.split('\n')[0]).toMatch(
      /^<!-- sdd-export scope=filtered providers="Alpha" timestamp=".+?" -->$/
    );
    expect(refExport).toContain('Alpha Only');
    expect(refExport).not.toContain('Beta Only');

    // CLI export carries the visible assignments + provider header.
    await copyFrom(document.querySelector('#cli-mirror-mount'), 'cli-mirror');
    const cliExport = writeText.mock.calls[1][0];
    expect(cliExport.split('\n')[0]).toMatch(
      /^<!-- sdd-export scope=filtered providers="Alpha" timestamp=".+?" -->$/
    );
    expect(cliExport).toContain('Shared Model');
    expect(cliExport).not.toContain('Beta Only');
  });

  test('deshabilitar alpha elimina alphaOnly (snapshot del otro exclusivo)', async () => {
    const { app } = await bootApp();
    setEnabledViaEvent(['beta']);
    for (const id of ['ref-table-mount', 'composite-chart-mount', 'pricing-chart-mount']) {
      const mount = document.querySelector(`#${id}`);
      expect(mount.querySelector('[data-model-key="alphaOnly"]')).toBeNull();
      expect(mount.innerHTML).not.toContain('Alpha Only');
      expect(mount.querySelector('[data-model-key="betaOnly"]')).not.toBeNull();
    }
    // Assignment surfaces never show the ineligible exclusive model.
    for (const id of ['workflow-mount', 'cli-mirror-mount', 'justification-mount']) {
      expect(document.querySelector(`#${id}`).innerHTML).not.toContain('Alpha Only');
    }
    // Justification alternatives carry the eligible exclusive model.
    expect(document.querySelector('#justification-mount').innerHTML).toContain('Beta Only');
    const values = Object.values(app.getState().assignments);
    expect(values.every((a) => a.key === 'shared')).toBe(true);
    expect(values[0].alternatives.map((a) => a.key)).toEqual(['betaOnly']);
  });
});

describe('provider-filter-integration — all disabled empty state + enable-all CTA', () => {
  test('cero elegibles: 0 rows/bars, 9 workflow, 18 CLI, 18 cards, twin null, 0 de Y visibles', async () => {
    const { app } = await bootApp();
    setEnabledViaEvent([]);

    const state = app.getState();
    expect(state.enabledSet).toEqual([]);
    expect(Object.keys(state.eligibleModels)).toHaveLength(0);

    // Selector count + empty-state CTA visible.
    expect(
      document.querySelector('#subscription-selector-mount [data-role="visible-count"]').textContent
    ).toMatch(/0 modelos visibles/);
    const emptyState = document.querySelector('#subscription-selector-mount [data-role="empty-state"]');
    expect(emptyState.hidden).toBe(false);
    const cta = emptyState.querySelector('[data-action="enable-all"]');
    expect(cta).not.toBeNull();

    // Hero: 0 de Y visibles (Y sigue siendo el total activo del catálogo).
    const heroText = document
      .querySelector('#hero-stats-mount')
      .textContent.replace(/\s+/g, ' ');
    expect(heroText).toMatch(/0 de 3 visibles/);

    // Tables/charts: zero rows/bars + explicit empty label (no stale bars).
    expect(document.querySelectorAll('#ref-table-mount tr[data-model-key]').length).toBe(0);
    expect(document.querySelector('#ref-table-mount [data-test="empty-state"]')).not.toBeNull();
    expect(document.querySelectorAll('#composite-chart-mount [data-model-key]').length).toBe(0);
    expect(document.querySelector('#composite-chart-mount [data-test="empty-state"]')).not.toBeNull();
    expect(document.querySelectorAll('#pricing-chart-mount [data-model-key]').length).toBe(0);
    expect(document.querySelector('#pricing-chart-mount [data-test="empty-state"]')).not.toBeNull();

    // Workflow/CLI/justification keep their fixed row counts with warnings.
    expect(document.querySelectorAll('#workflow-mount tbody tr').length).toBe(9);
    expect(document.querySelectorAll('#workflow-mount .warn-row').length).toBe(9);
    expect(document.querySelectorAll('#cli-mirror-mount tbody tr').length).toBe(18);
    expect(document.querySelectorAll('#cli-mirror-mount .warn-row').length).toBe(18);
    expect(document.querySelectorAll('#justification-mount .justification-card').length).toBe(18);
    expect(
      document.querySelectorAll(
        '#justification-mount .justification-card[data-has-assignment="false"]'
      ).length
    ).toBe(18);

    // Twin judges normalize to null / unassigned without throwing.
    expect(state.assignments['jd-judge-a'].key).toBeNull();
    expect(state.assignments['jd-judge-b'].key).toBeNull();

    // Default export stays filtered (never silently the full catalog).
    const writeText = mockClipboard();
    await copyFrom(document.querySelector('#ref-table-mount'), 'ref-table');
    const refExport = writeText.mock.calls[0][0];
    expect(refExport).toContain('scope=filtered');
    expect(refExport).toContain('providers=""');
    expect(refExport).not.toContain('Shared Model');

    // The CTA restores all-enabled through the SAME pipeline.
    const revisionBefore = state.filterRevision;
    cta.click();
    const after = app.getState();
    expect(after.enabledSet).toEqual(['alpha', 'beta']);
    expect(after.filterRevision).toBe(revisionBefore + 1);
    expect(Object.keys(after.eligibleModels)).toHaveLength(4);
    expect(document.querySelector('#ref-table-mount [data-model-key="betaOnly"]')).not.toBeNull();
    expect(
      document.querySelector('#subscription-selector-mount [data-role="visible-count"]').textContent
    ).toMatch(/4 modelos visibles/);
    expect(document.querySelector('[data-role="empty-state"]').hidden).toBe(true);
  });
});
