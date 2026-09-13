// js/services/ii-ranking.js
// S3b (change 2026-09-14-aa-only-scoring) — shared II ranking context.
// Pure helpers: freshness resolver, ranked/hidden projection, hidden note.
// Candidate = provider-filtered AND lifecycle active; ranked = finite II;
// hidden = null II; non-candidates never counted.

import { compositeScore, lifecycleOf } from './model-scorer.js';

function normDate(v) {
  if (typeof v !== 'string' || v.length < 10) return null;
  const d = v.slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)) return null;
  return d;
}

export function resolveIiFreshness(modelsMeta) {
  const m = modelsMeta || {};
  const lastRun = m.scrapers && m.scrapers['scrape-artificialanalysis'] && m.scrapers['scrape-artificialanalysis'].lastRun;
  const aa = normDate(typeof lastRun === 'string' ? lastRun : null);
  if (aa) return aa;
  return normDate(m.lastSynced);
}

export function buildIiRankingContext(models, modelsMeta) {
  const entries = Object.entries(models || {}).filter(([, mo]) => mo && typeof mo === 'object');
  const ranked = [];
  const hidden = [];
  for (const [k, mo] of entries) {
    if (lifecycleOf(mo) !== 'active') continue;
    if (compositeScore(mo) != null) ranked.push([k, mo]);
    else hidden.push([k, mo]);
  }
  const asOfDate = resolveIiFreshness(modelsMeta);
  return { ranked, hidden, hiddenCount: hidden.length, asOfDate };
}

export function formatHiddenIiNote(hiddenCount, asOfDate) {
  const n = Number(hiddenCount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n + ' models hidden — no Artificial Analysis Intelligence Index on ' + asOfDate;
}
