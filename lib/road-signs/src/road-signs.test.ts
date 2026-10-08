import assert from 'node:assert/strict';
import test from 'node:test';
import { PICTURE_QUESTIONS, ROAD_FIGURES, roadFigureDataUri, type RoadFigureId } from './index';

test('every figure is a self-contained SVG with alt text', () => {
  for (const [id, figure] of Object.entries(ROAD_FIGURES)) {
    assert.match(figure.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100">.*<\/svg>$/, id);
    assert.ok(!/<(script|image|foreignObject)|href=/i.test(figure.svg), `${id} must not load anything`);
    assert.ok(figure.alt.length > 10, `${id} alt text`);
    assert.ok(roadFigureDataUri(id as RoadFigureId).startsWith('data:image/svg+xml;utf8,%3Csvg'));
  }
});

test('picture questions are well formed and use every figure', () => {
  const keys = new Set<string>();
  for (const question of PICTURE_QUESTIONS) {
    assert.ok(!keys.has(question.key), `duplicate ${question.key}`);
    keys.add(question.key);
    assert.ok(question.figure in ROAD_FIGURES);
    assert.equal(new Set(question.options).size, 3);
    assert.ok(question.answer >= 0 && question.answer < 3);
    assert.ok(!/(California|Texas|Florida|New York|Ohio|Illinois|DMV|DPS|BMV)/.test(
      [question.prompt, ...question.options, question.explanation].join(' ')), `${question.key} stays state-neutral`);
  }
  assert.deepEqual(new Set(PICTURE_QUESTIONS.map((question) => question.figure)), new Set(Object.keys(ROAD_FIGURES)));
});

test('the correct answer is not always in the same position', () => {
  const positions = new Set(PICTURE_QUESTIONS.map((question) => question.answer));
  assert.equal(positions.size, 3);
});
