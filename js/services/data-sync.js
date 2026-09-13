// js/services/data-sync.js
// Phase 3 — auto-sync service.
//
// Contract (per design.md "Sync Service" + spec.md "Auto-Sync"):
//   - refresh()         → fetches the 6 data files from the public raw URL,
//                          updates sessionStorage cache (via data-loader),
//                          emits a "sdd-data-refreshed" CustomEvent on success,
//                          and falls back to cached data + console.warn on failure.
//   - getStalenessDays(meta)
//                       → whole-day delta between `meta.lastSynced` and `now`
//                          using UTC midnight (DST-safe).
//   - isStale(meta, thresholdDays = 7)
//                       → boolean — true when days > thresholdDays.
//
// The default URL points at the `Teksi75/sdd-data` repo (a separate data
//   repo Pablo plans to publish alongside the picker). At V4 initial
//   release the repo does not exist yet; the URL is a placeholder so
//   the fetch failures are honest about the gap. The freshness-badge
//   warning banner surfaces the staleness until the data repo ships.
//
// Storage shape (delegated to data-loader): sessionStorage key
//   `sdd-models-v6` carries `{ schemaVersion, sourceSchemaVersions, timestamp, data }`.
//
// The CustomEvent detail carries `{ lastSynced, source, files }` so
//   consumers (e.g., app.js forced-refresh re-validation) can react
//   without re-reading storage.

import {
  clearCache,
  invalidateMemoryCache,
  composePayload,
  CACHE_KEY,
  CURRENT_SCHEMA_VERSION,
  DATA_FILES,
} from './data-loader.js';

/**
 * Default upstream URL for the auto-sync source. Points at the
 * `Teksi75/sdd-data` repo on the `main` branch. Adjust here when
 * the repo is published or when the spec moves to a different host.
 *
 * @type {string}
 */
export const DEFAULT_DATA_URL =
  'https://raw.githubusercontent.com/Teksi75/sdd-data/main/data/models.json';

/**
 * Default staleness threshold in days. Used by `isStale` when no
 * explicit threshold is supplied. Picked at 7 to align with the
 * weekly GitHub Actions cron (every 5 days = <=7 day max gap).
 *
 * @type {number}
 */
export const STALENESS_THRESHOLD_DAYS = 7;

// V5: the file list is the loader's exported DATA_FILES descriptor — both
// paths MUST fetch the same 6 files, so the single source of truth lives in
// data-loader.js and this service just consumes it.

/**
 * Resolve the cache backend (sessionStorage). Mirrors the helper in
 * data-loader.js so a missing sessionStorage (SSR / tests) does not
 * break the refresh flow.
 *
 * @returns {Storage | null}
 */
function cacheBackend() {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const probe = '__sdd_probe__';
    sessionStorage.setItem(probe, '1');
    sessionStorage.removeItem(probe);
    return sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Resolve the upstream URL for a given data file path. Defaults to
 * `DEFAULT_DATA_URL` (which is `models.json`) and derives the sibling
 * file URLs by replacing the file name. This avoids needing 5 separate
 * constants and keeps the path-shape contract in one place.
 *
 * @param {string} filePath - e.g., "data/phases.json"
 * @param {string} [baseUrl] - override the default upstream URL
 * @returns {string}
 */
export function resolveUrl(filePath, baseUrl) {
  const base = baseUrl || DEFAULT_DATA_URL;
  // Replace the file name portion of the base URL.
  //   base = ".../data/models.json"
  //   result = ".../data/<file basename>"
  const lastSlash = base.lastIndexOf('/');
  if (lastSlash < 0) return base;
  const prefix = base.slice(0, lastSlash + 1);
  return `${prefix}${filePath.replace(/^.*\//, '')}`;
}

/**
 * Whole-day delta between `meta.lastSynced` (ISO date YYYY-MM-DD)
 * and `now` (defaults to today). Uses UTC midnight for both endpoints
 * to avoid DST off-by-one errors — `2026-07-04T00:00:00Z` vs
 * `2026-07-04T23:59:59Z` is 0 days, not 1.
 *
 * Returns 0 for malformed input (defensive — never throws inside render).
 *
 * @param {{lastSynced?: string|null}|null|undefined} meta
 * @param {Date|string} [now]
 * @returns {number} integer day delta (>= 0)
 */
export function getStalenessDays(meta, now) {
  if (!meta || typeof meta !== 'object') return 0;
  const lastSynced = meta.lastSynced;
  if (!lastSynced || typeof lastSynced !== 'string') return 0;
  const sync = new Date(`${lastSynced}T00:00:00Z`);
  if (Number.isNaN(sync.getTime())) return 0;

  let today;
  if (now instanceof Date) {
    today = now;
  } else if (typeof now === 'string') {
    const parsed = new Date(now);
    today = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    today = new Date();
  }

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const diffMs = todayUtc.getTime() - sync.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * True when `getStalenessDays(meta) > thresholdDays`. Uses
 * `STALENESS_THRESHOLD_DAYS` when no threshold is supplied.
 *
 * @param {{lastSynced?: string|null}|null|undefined} meta
 * @param {number} [thresholdDays=7]
 * @param {Date|string} [now]
 * @returns {boolean}
 */
export function isStale(meta, thresholdDays = STALENESS_THRESHOLD_DAYS, now) {
  const t = Number.isFinite(thresholdDays) ? thresholdDays : STALENESS_THRESHOLD_DAYS;
  return getStalenessDays(meta, now) > t;
}

/**
 * Fetch a single JSON file. Returns the parsed body on 2xx.
 *
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Read the cached payload (if any) from sessionStorage. Returns null
 * for missing / corrupted / schema-mismatched entries — the caller
 * must handle the no-cache fallback path.
 *
 * @returns {Object|null}
 */
function readCache() {
  const backend = cacheBackend();
  if (!backend) return null;
  const raw = backend.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Persist a payload to sessionStorage under the data-loader cache key.
 * Failures are swallowed — caching is best-effort and must never break
 * the refresh flow.
 *
 * @param {Object} data
 * @param {{models: number, providers: number}} sourceSchemaVersions
 */
function writeCache(data, sourceSchemaVersions) {
  const backend = cacheBackend();
  if (!backend) return;
  try {
    backend.setItem(
      CACHE_KEY,
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sourceSchemaVersions,
        timestamp: Date.now(),
        data,
      })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Refresh the 6 data files from the upstream URL. On success: update
 * sessionStorage, invalidate the data-loader in-memory cache (so the
 * next `loadAll()` call picks up the fresh data), and dispatch a
 * `sdd-data-refreshed` CustomEvent on `window` so UI components can
 * react. On failure: log `console.warn`, keep the cached data intact,
 * and return `{ ok: false, error }`.
 *
 * The `baseUrl` parameter is optional — defaults to `DEFAULT_DATA_URL`.
 * Tests pass a mock URL to keep the suite deterministic.
 *
 * V5+ KI-2: optional `onProgress` callback fires on every phase so the
 * caller can wire UI feedback (toast, button-disable, etc.) without
 * coupling the service to the toast module.
 *   - `{ phase: 'start' }`                  — emitted once before fetch
 *   - `{ phase: 'success', files, lastSynced, source }` — on cache write
 *   - `{ phase: 'failure', error, source }` — on fetch error or no fetch
 *
 * @param {{baseUrl?: string, fetchImpl?: typeof fetch, dispatchEvent?: boolean, onProgress?: (event: object) => void}} [options]
 * @returns {Promise<{ok: boolean, files?: number, lastSynced?: string, error?: string}>}
 */
export async function refresh(options) {
  const opts = options || {};
  const baseUrl = opts.baseUrl || DEFAULT_DATA_URL;
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const dispatchEvent = opts.dispatchEvent !== false; // default true
  // V5+ KI-2: optional progress callback. Safe to call even if the
  // caller didn't pass one. The callback is sync (caller decides what
  // to do — toast, disable button, etc.) so we don't await it.
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

  const doFetch = fetchImpl;
  if (typeof doFetch !== 'function') {
    const error = 'No fetch implementation available (SSR or unsupported env)';
    console.warn(`data-sync.refresh: ${error}`);
    if (onProgress) {
      try { onProgress({ phase: 'failure', error, source: baseUrl }); } catch { /* ignore */ }
    }
    return { ok: false, error };
  }

  // V5+ KI-2: emit start so the UI can disable the button + show "loading".
  if (onProgress) {
    try { onProgress({ phase: 'start', source: baseUrl }); } catch { /* ignore */ }
  }

  try {
    const urls = DATA_FILES.map(([file]) => resolveUrl(file, baseUrl));
    const results = await Promise.all(urls.map((u) => doFetch(u).then((r) => {
      if (!r || !r.ok) {
        throw new Error(`Failed to fetch ${u}: ${r?.status || 'no-response'} ${r?.statusText || ''}`);
      }
      return r.json();
    })));

    // Same validation + join as the boot loader — throws BEFORE any cache
    // write, so a broken registry/race keeps the previous envelope intact.
    const { data: composed, sourceSchemaVersions } = composePayload(results);
    writeCache(composed, sourceSchemaVersions);
    // Invalidate data-loader's in-memory memo (NOT sessionStorage — we just
    //   wrote fresh data to it; clearing it would erase the refresh). The
    //   next loadAll() call will re-read sessionStorage and return the new
    //   payload, then re-populate the in-memory memo.
    try {
      invalidateMemoryCache();
    } catch {
      /* data-loader may not be initialized in tests — ignore */
    }

    // Pull the lastSynced stamp from models.json _meta if present.
    const modelsRaw = results[0];
    const lastSynced =
      modelsRaw && typeof modelsRaw === 'object' && modelsRaw._meta && typeof modelsRaw._meta.lastSynced === 'string'
        ? modelsRaw._meta.lastSynced
        : undefined;

    if (dispatchEvent && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(
          new CustomEvent('sdd-data-refreshed', {
            detail: {
              lastSynced,
              source: baseUrl,
              files: results.length,
            },
          })
        );
      } catch {
        /* jsdom older versions: fall back to Event constructor */
        try {
          window.dispatchEvent(
            new Event('sdd-data-refreshed')
          );
        } catch {
          /* no-op */
        }
      }
    }

    if (onProgress) {
      try {
        onProgress({
          phase: 'success',
          files: results.length,
          lastSynced,
          source: baseUrl,
        });
      } catch { /* ignore */ }
    }

    return { ok: true, files: results.length, lastSynced };
  } catch (err) {
    const error = err && err.message ? err.message : String(err);
    console.warn(`data-sync.refresh: fallback to cache (${error})`);
    if (onProgress) {
      try { onProgress({ phase: 'failure', error, source: baseUrl }); } catch { /* ignore */ }
    }
    return { ok: false, error };
  }
}

// Re-export for convenience so consumers can `import { CACHE_KEY } from
//   './data-sync.js'` if they want. data-loader is still the source of truth.
export { CACHE_KEY };
