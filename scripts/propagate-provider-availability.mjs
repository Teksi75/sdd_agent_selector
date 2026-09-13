#!/usr/bin/env node
// scripts/propagate-provider-availability.mjs
// V5 deterministic authoring pass (design "Familias y herencia mecánica"):
//
//   validate registry -> clone base-family maps into effort variants ->
//   honour declared overrides -> report every override -> stable write.
//
// Manual curation lives ONLY on base families (familyKey(id) === id). Effort
// variants (suffixes NonReasoning/Medium/Xhigh/High/Low) materialize the base
// map; a variant keeps a different map ONLY when its id is declared in
// `models._meta.availabilityOverrides`, and every honored override is
// reported. Any undeclared override, stale override, or variant whose base
// family has no valid map fails with the offending id (non-zero exit).
//
// Usage: node scripts/propagate-provider-availability.mjs [--dry-run] [--file <path>]

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const MODELS_PATH = resolve(REPO_ROOT, 'data/models.json');
export const PROVIDERS_PATH = resolve(REPO_ROOT, 'data/providers.json');

// Registry record contract: exactly these five keys, nothing else (design
// "Registry normativo").
const REGISTRY_KEYS = Object.freeze(['id', 'name', 'tier', 'updated', 'url']);

// Effort suffixes, checked in this order; at most ONE is stripped, matching
// case-sensitively, and only when the resulting base record exists.
export const EFFORT_SUFFIXES = Object.freeze(['NonReasoning', 'Medium', 'Xhigh', 'High', 'Low']);

/**
 * Family key of a model id: the id minus one known effort suffix, only when
 * the base record exists. Ids that merely end in a suffix-like string are
 * their own family and must be curated explicitly.
 *
 * @param {string} id
 * @param {Record<string, object>} models
 * @returns {string}
 */
export function familyKey(id, models) {
  for (const suffix of EFFORT_SUFFIXES) {
    if (id.endsWith(suffix)) {
      const base = id.slice(0, -suffix.length);
      if (Object.hasOwn(models, base)) return base;
    }
  }
  return id;
}

/**
 * A valid availability map has exactly the registry ids as keys and boolean
 * values (no missing key, no extra key, no null/string).
 *
 * @param {unknown} map
 * @param {string[]} providerIds
 * @returns {boolean}
 */
export function isValidAvailabilityMap(map, providerIds) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  const keys = Object.keys(map);
  if (keys.length !== providerIds.length) return false;
  for (const provider of providerIds) {
    if (typeof map[provider] !== 'boolean') return false;
  }
  return keys.every((key) => providerIds.includes(key));
}

/**
 * Every problem that makes the `families × providers` matrix incomplete or
 * inconsistent. An empty result means the matrix is fully materialized.
 *
 * @param {Record<string, object>} models
 * @param {string[]} providerIds
 * @returns {Array<{kind: string, id: string, family: string, provider: string}>}
 */
export function missingMatrixCells(models, providerIds) {
  const problems = [];
  for (const [id, record] of Object.entries(models)) {
    const family = familyKey(id, models);
    const map = record?.availability;
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      problems.push({ kind: 'missing-map', id, family, provider: '*' });
      continue;
    }
    for (const provider of providerIds) {
      if (typeof map[provider] !== 'boolean') {
        problems.push({ kind: 'missing-cell', id, family, provider });
      }
    }
    for (const key of Object.keys(map)) {
      if (!providerIds.includes(key)) {
        problems.push({ kind: 'unknown-provider', id, family, provider: key });
      }
    }
  }
  return problems;
}

/**
 * Read + validate `data/providers.json`. Returns the closed id set plus every
 * structural error found (empty `errors` means valid).
 *
 * @param {string} [path]
 * @returns {{providerIds: string[], errors: Array<{kind: string, detail?: string}>}}
 */
export function readRegistry(path = PROVIDERS_PATH) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    return { providerIds: [], errors: [{ kind: 'registry-unreadable', detail: err.message }] };
  }
  const errors = [];
  if (raw?._meta?.schemaVersion !== 1) {
    errors.push({ kind: 'registry-schema', detail: String(raw?._meta?.schemaVersion) });
  }
  const providers = raw?.providers;
  if (!Array.isArray(providers) || providers.length === 0) {
    errors.push({ kind: 'registry-empty', detail: String(providers?.length) });
    return { providerIds: [], errors };
  }
  const providerIds = [];
  for (const record of providers) {
    const keys = Object.keys(record || {}).sort().join(',');
    if (keys !== REGISTRY_KEYS.join(',')) {
      errors.push({ kind: 'registry-record', detail: `${record?.id}: [${keys}]` });
    }
    if (providerIds.includes(record?.id)) {
      errors.push({ kind: 'registry-duplicate-id', detail: String(record?.id) });
    }
    providerIds.push(record?.id);
  }
  return { providerIds, errors };
}

/**
 * Place `availability` as the FIRST property of a record: uniform placement
 * and pure additive diffs (no existing line needs a comma change).
 */
function withAvailability(record, map) {
  const next = { availability: structuredClone(map) };
  for (const [key, value] of Object.entries(record)) {
    if (key === 'availability') continue;
    next[key] = value;
  }
  return next;
}

/**
 * Serialize the models document with every `availability` map kept on ONE
 * line (design: compact maps so review cost stays visible, not hidden). The
 * rest of the document uses the canonical 2-space pretty print.
 *
 * @param {{_meta: object, models: Record<string, object>}} doc
 * @returns {string}
 */
export function serializeModels(doc) {
  const inline = new Map();
  const staged = { ...doc, models: {} };
  for (const [id, record] of Object.entries(doc.models)) {
    const copy = { ...record };
    if (copy.availability && typeof copy.availability === 'object') {
      const token = `\u0000AVAIL:${inline.size}\u0000`;
      const entries = Object.entries(copy.availability);
      inline.set(
        JSON.stringify(token),
        `{ ${entries.map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`
      );
      copy.availability = token;
    }
    staged.models[id] = copy;
  }
  let out = JSON.stringify(staged, null, 2);
  for (const [token, text] of inline) out = out.split(token).join(text);
  for (const token of inline.keys()) {
    if (out.includes(token)) {
      throw new Error('serializeModels: inline-map placeholder leaked into the output');
    }
  }
  return out + '\n';
}

/**
 * Compute the materialized model records and every error that must block the
 * write. Pure: inputs are never mutated.
 *
 * @param {Record<string, object>} models
 * @param {string[]} providerIds
 * @param {string[]} [overrides] ids declared in `_meta.availabilityOverrides`
 * @returns {{models: Record<string, object>, errors: Array<object>, honored: string[]}}
 */
export function propagate(models, providerIds, overrides = []) {
  const errors = [];
  const honored = [];
  const declared = new Set(overrides);
  const baseIds = new Set(Object.keys(models).filter((id) => familyKey(id, models) === id));

  for (const id of declared) {
    if (!Object.hasOwn(models, id)) {
      errors.push({ kind: 'stale-override', id, reason: 'unknown id' });
    } else if (baseIds.has(id)) {
      errors.push({ kind: 'stale-override', id, reason: 'base family, not a variant' });
    }
  }

  const next = {};
  for (const [id, record] of Object.entries(models)) {
    const family = familyKey(id, models);
    const own = record?.availability;

    if (family === id) {
      if (!isValidAvailabilityMap(own, providerIds)) {
        errors.push({ kind: 'base-missing-map', id });
        continue;
      }
      next[id] = withAvailability(record, own);
      continue;
    }

    const baseMap = models[family]?.availability;
    if (!isValidAvailabilityMap(baseMap, providerIds)) {
      errors.push({ kind: 'variant-without-base', id, family });
      continue;
    }

    const hasOwnMap = own !== undefined;
    const differs = hasOwnMap && JSON.stringify(own) !== JSON.stringify(baseMap);

    if (differs) {
      if (!declared.has(id)) {
        errors.push({ kind: 'undeclared-override', id, family });
        continue;
      }
      if (!isValidAvailabilityMap(own, providerIds)) {
        errors.push({ kind: 'override-invalid-map', id, family });
        continue;
      }
      honored.push(id);
      next[id] = withAvailability(record, own);
      continue;
    }

    if (declared.has(id)) {
      errors.push({ kind: 'stale-override', id, reason: 'declared but matches base map' });
    }
    next[id] = withAvailability(record, baseMap);
  }

  return { models: next, errors, honored };
}

function reportErrors(errors) {
  for (const error of errors) {
    const detail = [error.id, error.family, error.provider, error.detail, error.reason]
      .filter(Boolean)
      .join(' ');
    process.stderr.write(`[propagate-availability] ${error.kind}: ${detail}\n`);
  }
}

function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index !== -1 ? argv[index + 1] : undefined;
}

/** CLI entry point; returns the exit code (0 ok, 1 invalid input). */
export function runCli(argv = process.argv) {
  const dryRun = argv.includes('--dry-run');
  const file = resolve(flagValue(argv, '--file') || MODELS_PATH);

  const registry = readRegistry();
  if (registry.errors.length > 0) {
    reportErrors(registry.errors);
    return 1;
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    process.stderr.write(`[propagate-availability] models-unreadable: ${err.message}\n`);
    return 1;
  }

  const overrides = Array.isArray(doc._meta?.availabilityOverrides)
    ? doc._meta.availabilityOverrides
    : [];
  const result = propagate(doc.models, registry.providerIds, overrides);
  if (result.errors.length > 0) {
    reportErrors(result.errors);
    return 1;
  }

  for (const id of result.honored) {
    console.log(`[propagate-availability] honored override: ${id}`);
  }
  console.log(
    `[propagate-availability] overrides declared=${overrides.length} honored=${result.honored.length}`
  );

  doc.models = result.models;
  const serialized = serializeModels(doc);
  const current = readFileSync(file, 'utf-8');
  if (dryRun || current === serialized) {
    console.log(
      `[propagate-availability] ${dryRun ? 'dry-run: ' : ''}up to date (${Object.keys(result.models).length} records)`
    );
    return 0;
  }

  const tmp = join(dirname(file), `${basename(file)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, serialized, 'utf-8');
  try {
    renameSync(tmp, file);
  } catch (err) {
    process.stderr.write(`[propagate-availability] write-failed: ${err.message}\n`);
    return 1;
  }
  console.log(
    `[propagate-availability] materialized ${Object.keys(result.models).length} records at ${file}`
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = runCli();
}
