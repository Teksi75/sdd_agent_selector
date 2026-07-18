/**
 * Merge matched SWE-bench rows into a model map without mutating manual data.
 * The scraper owns only `sweVer` and appends its provenance to `sources`.
 *
 * @param {Object<string, Object>} models
 * @param {Array<{key: string, stats: {pct: number, resolved: number, total: number}}>} matched
 * @param {string} url
 * @param {string} date
 * @param {string} scraperName
 * @returns {Object<string, Object>}
 */
export function mergeSweBenchResults(models, matched, url, date, scraperName) {
  const updatedModels = { ...models };

  for (const { key, stats } of matched) {
    if (!updatedModels[key]) continue;
    const existing = updatedModels[key];
    updatedModels[key] = {
      ...existing,
      sweVer: stats.pct,
      sources: [
        ...(Array.isArray(existing.sources) ? existing.sources : []),
        {
          url,
          date,
          scraper: scraperName,
          resolved: `${stats.resolved}/${stats.total}`,
        },
      ],
    };
  }

  return updatedModels;
}
