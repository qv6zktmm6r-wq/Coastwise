import assert from 'node:assert/strict';
import test from 'node:test';
import { getMobilePracticePack, getMobileWeakTopics } from './practice-content';

test('mobile practice uses distinct state packs with official sources', () => {
  const texas = getMobilePracticePack('US-TX');
  const florida = getMobilePracticePack('US-FL');
  assert.notDeepEqual(texas.map((question) => question.id), florida.map((question) => question.id));
  for (const question of [...texas, ...florida]) {
    assert.match(question.sourceUrl, /^https:\/\/(www\.)?/);
    assert.equal(question.options.length, 3);
    assert.ok(question.answer >= 0 && question.answer < question.options.length);
  }
});

test('mobile weak topics only use answers from the active jurisdiction and pack version', () => {
  const progress = {
    'US-TX:us-tx-2026.09.1:tx-mobile-supervision': { correct: true, topic: 'Licensing & permits' },
    'US-FL:us-fl-2026.09.1:fl-mobile-age': { correct: false, topic: 'Licensing & permits' },
  };
  const texas = getMobileWeakTopics('US-TX', 'us-tx-2026.09.1', progress);
  const florida = getMobileWeakTopics('US-FL', 'us-fl-2026.09.1', progress);
  assert.equal(texas.find((topic) => topic.topic === 'Licensing & permits')?.mastery, 100);
  assert.equal(florida.find((topic) => topic.topic === 'Licensing & permits')?.mastery, 0);
});