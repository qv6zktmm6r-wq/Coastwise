import assert from 'node:assert/strict';
import test from 'node:test';
import { PICTURE_QUESTIONS } from '@workspace/road-signs';
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
    'US-FL:us-fl-2026.09.2:fl-mobile-age': { correct: false, topic: 'Licensing & permits' },
    'US-FL:us-fl-2026.09.1:fl-mobile-age': { correct: true, topic: 'Licensing & permits' },
  };
  const texas = getMobileWeakTopics('US-TX', 'us-tx-2026.09.1', progress);
  const florida = getMobileWeakTopics('US-FL', 'us-fl-2026.09.2', progress);
  const texasLicensing = texas.find((topic) => topic.topic === 'Licensing & permits');
  assert.ok(!texasLicensing || texasLicensing.mastery === 100, 'mastered Texas topic is never reported as weak');
  assert.equal(florida.find((topic) => topic.topic === 'Licensing & permits')?.mastery, 0);
});
test('every state includes the same picture questions with its own handbook source', () => {
  for (const jurisdiction of ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-OH', 'US-IL'] as const) {
    const pictures = getMobilePracticePack(jurisdiction).filter((question) => question.figure);
    assert.equal(pictures.length, PICTURE_QUESTIONS.length, jurisdiction);
    assert.equal(new Set(pictures.map((question) => question.sourceUrl)).size, 1);
    assert.ok(pictures.every((question) => question.id.startsWith(jurisdiction.slice(3).toLowerCase())));
  }
  assert.notEqual(getMobilePracticePack('US-CA')[1].figure, undefined, 'a picture shows up early');
});
