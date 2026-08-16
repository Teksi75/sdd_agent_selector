#!/usr/bin/env node
// scripts/_aa-spike.mjs — TEMPORARY spike 1.2 (never merged; deleted with the
// spike branch). Dumps the full AA v2 payload to scripts/.aa-dump.json
// (gitignored) and prints a compact shape summary to stdout so the runner
// logs carry the discovery without downloading the artifact.
//
// Goal: discover (a) the real pricing/evaluations field names, (b) how AA
// represents effort variants (max/high/medium/low/xhigh/non-reasoning), and
// (c) the real id/slug/name triplets for rebuilding data/aa-aliases.json.
//
// Dependency-free: uses the Node >= 18 native fetch.

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://artificialanalysis.ai/api/v2/data/llms/models';
const DUMP_PATH = resolve(__dirname, '.aa-dump.json');

const key = process.env.AA_API_KEY;
if (!key) {
  console.error('AA_API_KEY is not set');
  process.exit(1);
}

const res = await fetch(ENDPOINT, { headers: { 'x-api-key': key } });
if (!res.ok) {
  console.error(`HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}

const payload = await res.json();
writeFileSync(DUMP_PATH, JSON.stringify(payload, null, 2));

// ---- Shape summary (stdout) ----
const lines = [];
const push = (s) => lines.push(s);

push('== top-level keys ==');
push(JSON.stringify(Object.keys(payload)));

if (payload.prompt_options !== undefined) {
  push('== prompt_options ==');
  push(JSON.stringify(payload.prompt_options, null, 2));
}

const list = Array.isArray(payload.data) ? payload.data : [];
push(`== data entries: ${list.length} ==`);

if (list.length > 0) {
  const first = list[0];
  push('== data[0] keys ==');
  push(JSON.stringify(Object.keys(first)));
  if (first.pricing && typeof first.pricing === 'object') {
    push('== data[0].pricing keys ==');
    push(JSON.stringify(Object.keys(first.pricing)));
  }
  if (first.evaluations && typeof first.evaluations === 'object') {
    push('== data[0].evaluations keys ==');
    push(JSON.stringify(Object.keys(first.evaluations)));
  }
}

// Effort-related fields: print any key whose name hints at effort/thinking
// level, plus the id/slug/name triplet per entry so the alias table can be
// rebuilt from real slugs.
push('== per-entry id | slug | name | effort-ish keys ==');
for (const e of list) {
  if (!e || typeof e !== 'object') continue;
  const effortish = Object.keys(e)
    .filter((k) => /effort|reasoning|thinking|variant/i.test(k))
    .map((k) => `${k}=${JSON.stringify(e[k])}`)
    .join(', ');
  push(`${e.id}\t${e.slug}\t${e.name}\t${effortish}`);
}

process.stdout.write(lines.join('\n') + '\n');
