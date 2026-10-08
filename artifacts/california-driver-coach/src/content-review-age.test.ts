import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_MAX_AGE_DAYS, staleReviews } from '../scripts/check-content-sources';

test(`content reviews older than ${REVIEW_MAX_AGE_DAYS} days are flagged for a law-change review`, () => {
  assert.deepEqual(staleReviews('2026-10-08'), []);
  const later = staleReviews('2027-06-01');
  assert.ok(later.length > 0);
  assert.ok(later.every((line) => /last reviewed \d{4}-\d{2}-\d{2} \(\d+ days ago\)/.test(line)));
});
