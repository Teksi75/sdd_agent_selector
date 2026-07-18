// scripts/_pricing-safety.mjs
// Pure pricing safety helpers for the Phase 3 pricing scrapers.
//
// Extracted from scrape-openai-pricing.js / scrape-anthropic-pricing.js so
// the safety logic can be unit-tested without hitting the network or the
// upstream HTML shape.
//
// Contract (per spec: fix-sync-scraper-corruption):
//   - buildDefinedPricePatch(values)
//       Strips null / undefined fields. Returns a new object containing
//       only fields with defined values. Does NOT coerce strings, does
//       NOT round, does NOT add curated keys (tier, isReference, notes).
//
//   - sanitizeOpenAiPricePatch(parsed, existing, key)
//       Returns a patch object with the same keys as `parsed` minus any
//       field that is:
//         1. null / undefined               → silently dropped
//         2. non-positive (≤0)               → warn + drop
//         3. finite positive > 1000x prior   → warn + drop
//         4. (only if `key` matches flagship) null `output` → warn + drop
//         5. `input > output`               → warn + drop both
//       Never includes curated keys (tier, isReference, notes).
//
//   - shouldUpdate(model, meta, today, thresholdDays = 5)
//       Returns true when the scraper should overwrite the existing
//       record. Falls back to `meta.lastSynced` when per-model
//       `lastSynced` is absent so the cron doesn't blank out curated
//       data every run.

export const STALENESS_COOLDOWN_DAYS = 5;
export const OVERSIZED_MULTIPLIER = 1000;
const FLAGSHIP_KEYS = new Set(['gpt55', 'gpt55Pro']);

function isFinitePositive(n) {
  return Number.isFinite(n) && n > 0;
}

/**
 * Build a patch object containing only fields with non-null/undefined
 * values. Curated keys are NEVER included — callers must not derive
 * tier/isReference/notes from upstream.
 *
 * @param {Object<string, any>} values
 * @returns {Object<string, any>}
 */
export function buildDefinedPricePatch(values) {
  if (!values || typeof values !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Decide whether a single parsed value should be skipped because it is
 * implausible relative to the prior value (>1000x the prior finite
 * positive). Returns null when the value should be kept, or a string
 * reason when it should be skipped.
 *
 * @param {number|null|undefined} parsed
 * @param {number|null|undefined} prior
 * @param {string} field
 * @returns {string|null}
 */
export function oversizedReason(parsed, prior, field) {
  if (!isFinitePositive(parsed)) return null;
  if (!isFinitePositive(prior)) return null;
  if (parsed > OVERSIZED_MULTIPLIER * prior) {
    return `oversized ${field}=${parsed} (>${OVERSIZED_MULTIPLIER}x prior ${prior})`;
  }
  return null;
}

/**
 * Sanitize a parsed OpenAI row against the existing model record and
 * produce a safe patch object. See module header for the full contract.
 *
 * @param {{input?: number|null, output?: number|null, cacheRead?: number|null}} parsed
 * @param {Object<string, any>} existing
 * @param {string} key
 * @returns {Object<string, any>}
 */
export function sanitizeOpenAiPricePatch(parsed, existing, key) {
  if (!parsed || typeof parsed !== 'object') return {};

  const patch = {};
  const flags = {};
  const isFlagship = FLAGSHIP_KEYS.has(key);

  for (const field of ['input', 'output', 'cacheRead']) {
    const v = parsed[field];
    if (v === null || v === undefined) {
      // Flagship gating: null output is a parser regression we want to
      // surface loudly. Other null fields just drop silently.
      if (field === 'output' && isFlagship) {
        console.warn(
          `[scrape-openai-pricing] ${key}.${field} parsed as null on flagship — skipping to preserve prior value`
        );
      }
      continue;
    }
    if (!isFinitePositive(v)) {
      console.warn(
        `[scrape-openai-pricing] ${key}.${field}=${v} is non-positive — skipping`
      );
      continue;
    }
    const oversized = oversizedReason(v, existing?.[field], field);
    if (oversized) {
      console.warn(`[scrape-openai-pricing] ${key} ${oversized} — skipping`);
      continue;
    }
    patch[field] = v;
    flags[field] = true;
  }

  // Inversion: if parsed input > parsed output AND both fields passed the
  // per-field checks, drop both — we can't tell which side is corrupt.
  if (
    flags.input &&
    flags.output &&
    isFinitePositive(patch.input) &&
    isFinitePositive(patch.output) &&
    patch.input > patch.output
  ) {
    console.warn(
      `[scrape-openai-pricing] ${key} inversion detected input=${patch.input} > output=${patch.output} — skipping both`
    );
    delete patch.input;
    delete patch.output;
  }

  return patch;
}

/**
 * Decide whether a model record should be overwritten.
 *
 * - Missing model → true (first-time insert).
 * - Missing / malformed `lastSynced` on the model → fall back to
 *   `meta.lastSynced`. When BOTH are missing, return true.
 * - Effective date fresher than `thresholdDays` ago → false (skip).
 *
 * @param {Object|undefined} model
 * @param {Object|undefined} meta
 * @param {Date} today
 * @param {number} [thresholdDays=5]
 * @returns {boolean}
 */
export function shouldUpdate(model, meta, today, thresholdDays = STALENESS_COOLDOWN_DAYS) {
  if (!model) return true;
  const modelLast = model.lastSynced;
  const metaLast = meta?.lastSynced;
  // Prefer model.lastSynced, fall back to meta.lastSynced.
  const effective = modelLast || metaLast;
  if (!effective) return true;
  const last = new Date(`${effective}T00:00:00Z`).getTime();
  if (Number.isNaN(last)) return true;
  const diffDays = (today.getTime() - last) / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}
