import assert from 'node:assert/strict';
import { guideFreshness } from '../lib/guide-freshness.ts';
const now = Date.parse('2026-09-06T12:00:00Z');
assert.equal(guideFreshness(null, now), null);
assert.equal(guideFreshness('invalid', now), null);
assert.equal(
  guideFreshness(new Date(now).toISOString(), now).label,
  '今天更新',
);
assert.equal(
  guideFreshness(new Date(now - 29 * 86400000).toISOString(), now).stale,
  false,
);
assert.equal(
  guideFreshness(new Date(now - 30 * 86400000).toISOString(), now).stale,
  true,
);
assert.equal(
  guideFreshness(new Date(now + 86400000).toISOString(), now).days,
  0,
);
assert.equal(guideFreshness('2026-09-05T17:00:00Z', now).date, '2026/09/06');
console.log(
  'PASS: guide freshness thresholds, invalid values and Shanghai date',
);
