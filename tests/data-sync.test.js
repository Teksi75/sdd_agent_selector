// tests/data-sync.test.js
// Phase 3 — data-sync service TDD (RED stage).
//
// Tests four exported functions per spec.md "Sync Service":
//   1. refresh() on success → updates sessionStorage cache + emits event
//   2. refresh() on failure → keeps cached data + console.warn
//   3. getStalenessDays(meta) → days since lastSynced (UTC, whole-day)
//   4. isStale(meta, thresholdDays = 7) → boolean
//
// Pure-function helpers (getStalenessDays, isStale) are tested directly.
// refresh() is tested with mock fetch + sessionStorage so we don't hit
// the network and the test stays deterministic.

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

class FakeStorage {
  constructor(initial = {}) {
    this.store = { ...initial };
  }
  getItem(k) {
    return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] ?? null;
  }
}

const freshFiles = {
  'data/models.json': {
    _meta: { schemaVersion: 1, lastSynced: '2026-07-04', source: 'manual', nextSync: '2026-07-09' },
    models: { glm52: { name: 'GLM-5.2' } },
  },
  'data/phases.json': {
    _meta: { schemaVersion: 1 },
    phases: [{ id: 'init' }],
  },
  'data/configs.json': {
    _meta: { schemaVersion: 1 },
    configs: [{ key: 'economico', strategy: 'min-cost' }],
  },
  'data/agent-roles.json': {
    _meta: { schemaVersion: 1 },
    roles: { 'gentle-orchestrator': { minReasoning: 95, costRatio: 1.0 } },
  },
  'data/agent-request-profiles.json': {
    _meta: { schemaVersion: 1 },
    profiles: { 'gentle-orchestrator': { inputTokens: 4000, outputTokens: 2000 } },
  },
};

function mockFetchSuccess(files, baseUrl = 'https://example.test/data/') {
  globalThis.fetch = vi.fn(async (url) => {
    const urlStr = typeof url === 'string' ? url : url?.url ?? String(url);
    // Map any URL ending in the relative path to the fixture.
    for (const [rel, body] of Object.entries(files)) {
      if (urlStr.endsWith(rel) || urlStr.endsWith(rel.replace(/^data\//, ''))) {
        return {
          ok: true,
          status: 200,
          async json() {
            return JSON.parse(JSON.stringify(body));
          },
        };
      }
    }
    return { ok: false, status: 404, statusText: 'Not Found' };
  });
  return baseUrl;
}

describe('data-sync — pure helpers (getStalenessDays, isStale)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('getStalenessDays: same day → 0', async () => {
    const { getStalenessDays } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-04T12:00:00Z');
    expect(getStalenessDays({ lastSynced: '2026-07-04' }, now)).toBe(0);
  });

  test('getStalenessDays: 1 day ago → 1', async () => {
    const { getStalenessDays } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-04T12:00:00Z');
    expect(getStalenessDays({ lastSynced: '2026-07-03' }, now)).toBe(1);
  });

  test('getStalenessDays: 14 days ago → 14', async () => {
    const { getStalenessDays } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-04T12:00:00Z');
    expect(getStalenessDays({ lastSynced: '2026-06-20' }, now)).toBe(14);
  });

  test('getStalenessDays: malformed lastSynced → 0 (defensive)', async () => {
    const { getStalenessDays } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-04T12:00:00Z');
    expect(getStalenessDays({ lastSynced: 'not-a-date' }, now)).toBe(0);
    expect(getStalenessDays({ lastSynced: null }, now)).toBe(0);
    expect(getStalenessDays({}, now)).toBe(0);
  });

  test('isStale: 0 days old + threshold=7 → false', async () => {
    const { isStale } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-04T12:00:00Z');
    expect(isStale({ lastSynced: '2026-07-04' }, 7, now)).toBe(false);
  });

  test('isStale: exactly 7 days old → false (strictly >)', async () => {
    const { isStale } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-11T12:00:00Z');
    expect(isStale({ lastSynced: '2026-07-04' }, 7, now)).toBe(false);
  });

  test('isStale: 8 days old + threshold=7 → true', async () => {
    const { isStale } = await import('../js/services/data-sync.js');
    const now = new Date('2026-07-12T12:00:00Z');
    expect(isStale({ lastSynced: '2026-07-04' }, 7, now)).toBe(true);
  });

  test('isStale: default threshold is 7', async () => {
    const { isStale, STALENESS_THRESHOLD_DAYS } = await import('../js/services/data-sync.js');
    expect(STALENESS_THRESHOLD_DAYS).toBe(7);
    const now = new Date('2026-07-15T12:00:00Z');
    expect(isStale({ lastSynced: '2026-07-04' }, undefined, now)).toBe(true);
  });
});

describe('data-sync — refresh() success path', () => {
  beforeEach(async () => {
    globalThis.sessionStorage = new FakeStorage();
    mockFetchSuccess(freshFiles);
    vi.resetModules();
    // Reset data-loader module cache so refresh() actually fetches.
    const loader = await import('../js/services/data-loader.js');
    loader.clearCache();
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('refresh() fetches all 5 files and updates sessionStorage', async () => {
    const { refresh } = await import('../js/services/data-sync.js');
    const result = await refresh();
    expect(result.ok).toBe(true);
    expect(result.files).toBe(5);
    // sessionStorage was updated.
    const cached = sessionStorage.getItem('sdd-models-v3');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.data.models.glm52.name).toBe('GLM-5.2');
  });

  test('refresh() emits a "sdd-data-refreshed" CustomEvent on window', async () => {
    const { refresh } = await import('../js/services/data-sync.js');
    let captured = null;
    const handler = (e) => {
      captured = e;
    };
    window.addEventListener('sdd-data-refreshed', handler);
    try {
      const result = await refresh();
      expect(result.ok).toBe(true);
      expect(captured).not.toBeNull();
      expect(captured.type).toBe('sdd-data-refreshed');
      expect(captured.detail).toHaveProperty('lastSynced');
    } finally {
      window.removeEventListener('sdd-data-refreshed', handler);
    }
  });

  test('DEFAULT_DATA_URL points at the sdd-data repo (raw GitHub)', async () => {
    const { DEFAULT_DATA_URL } = await import('../js/services/data-sync.js');
    expect(typeof DEFAULT_DATA_URL).toBe('string');
    expect(DEFAULT_DATA_URL).toMatch(/raw\.githubusercontent\.com/);
    expect(DEFAULT_DATA_URL).toMatch(/sdd-data/);
  });
});

describe('data-sync — refresh() failure path', () => {
  beforeEach(async () => {
    globalThis.sessionStorage = new FakeStorage();
    vi.resetModules();
    // Pre-seed sessionStorage with valid cached data so we can verify the
    //   fallback path keeps using the cache.
    sessionStorage.setItem(
      'sdd-models-v3',
      JSON.stringify({
        schemaVersion: 2,
        timestamp: Date.now(),
        data: {
          models: { glm52: { name: 'cached-glm52' } },
          phases: [],
          configs: [],
          roles: {},
          profiles: {},
        },
      })
    );
    // Make fetch fail.
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network down');
    });
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('refresh() failure → returns ok:false, preserves cached data, console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { refresh } = await import('../js/services/data-sync.js');
      const result = await refresh();
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/network|fetch|TypeError/i);
      // Cached data still in storage.
      const cached = JSON.parse(sessionStorage.getItem('sdd-models-v3'));
      expect(cached.data.models.glm52.name).toBe('cached-glm52');
      // A warning was emitted.
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('refresh() failure with no cache → ok:false, returns no fallback', async () => {
    sessionStorage.clear();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { refresh } = await import('../js/services/data-sync.js');
      const result = await refresh();
      expect(result.ok).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('data-loader — legacy cache fallback', () => {
  const legacyData = {
    models: { legacyModel: { name: 'LEGACY' } },
    phases: [],
    configs: [],
    roles: {},
    profiles: {},
  };

  beforeEach(() => {
    globalThis.sessionStorage = new FakeStorage();
    globalThis.fetch = vi.fn();
    vi.resetModules();
  });

  afterEach(() => {
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
  });

  test('valid v2 cache is used when v3 is absent without fetching', async () => {
    const { loadAll, CACHE_KEY, LEGACY_CACHE_KEYS } = await import('../js/services/data-loader.js');
    sessionStorage.setItem(
      LEGACY_CACHE_KEYS[0],
      JSON.stringify({ schemaVersion: 2, timestamp: Date.now(), data: legacyData })
    );
    const data = await loadAll();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(data.models.legacyModel.name).toBe('LEGACY');
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  test('clearCache removes current v3 and legacy v2 keys', async () => {
    const { clearCache, CACHE_KEY, LEGACY_CACHE_KEYS } = await import('../js/services/data-loader.js');
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ schemaVersion: 2, data: {} }));
    sessionStorage.setItem(LEGACY_CACHE_KEYS[0], JSON.stringify({ schemaVersion: 2, data: {} }));
    clearCache();
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
    expect(sessionStorage.getItem(LEGACY_CACHE_KEYS[0])).toBeNull();
  });
});
