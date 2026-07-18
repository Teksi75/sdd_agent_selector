// tests/staleness-parity.test.js
// Cross-module contract: the badge and sync service must agree on UTC day age.

import { describe, expect, test } from 'vitest';
import { daysOld } from '../js/components/freshness-badge.js';
import { getStalenessDays } from '../js/services/data-sync.js';

const CASES = [
  ['same UTC day', '2026-07-18', new Date('2026-07-18T23:59:59Z'), 0],
  ['one UTC day', '2026-07-18', new Date('2026-07-19T01:00:00Z'), 1],
  ['seven UTC days', '2026-07-11', new Date('2026-07-18T12:00:00Z'), 7],
  ['invalid last-synced date', 'not-a-date', new Date('2026-07-18T12:00:00Z'), 0],
  ['ISO-string now', '2026-07-18', '2026-07-19T01:00:00Z', 1],
];

describe('staleness day parity', () => {
  test.each(CASES)('%s', (_label, lastSynced, now, expected) => {
    const badgeDays = daysOld(lastSynced, now);
    const syncDays = getStalenessDays({ lastSynced }, now);

    expect(Number.isInteger(badgeDays)).toBe(true);
    expect(Number.isInteger(syncDays)).toBe(true);
    expect(badgeDays).toBe(expected);
    expect(syncDays).toBe(expected);
    expect(badgeDays).toBe(syncDays);
  });
});
