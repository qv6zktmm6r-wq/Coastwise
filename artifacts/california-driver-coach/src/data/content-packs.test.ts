import assert from 'node:assert/strict';
import test from 'node:test';
import { contentPacks, contentScenarios } from './content-packs';
import { getCurrentContentPackVersion, supportedJurisdictions } from '../lib/jurisdiction';

const officialHosts: Record<string, string[]> = {
  'US-CA': ['dmv.ca.gov'],
  'US-TX': ['dps.texas.gov', 'txdot.gov', 'txdmv.gov', 'tdi.texas.gov', 'statutes.capitol.texas.gov'],
  'US-FL': ['flhsmv.gov', 'leg.state.fl.us', 'flsenate.gov'],
};

test('every bundled jurisdiction has a current, complete, attributable pack', () => {
  const ids = new Set<string>();
  for (const pack of Object.values(contentPacks)) {
    const jurisdictionCode = pack.jurisdiction;
    assert.equal(pack.version, getCurrentContentPackVersion(jurisdictionCode));
    assert.match(pack.version, /^us-[a-z]{2}-\d{4}\.\d{2}\.\d+$/);
    assert.match(pack.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(pack.sections.length >= 12);
    assert.ok(pack.questions.length >= 24);
    for (const section of pack.sections) {
      assert.ok(pack.questions.filter((question) => question.section === section.id).length >= 2, `${jurisdictionCode} ${section.id} coverage`);
    }
    for (const question of pack.questions) {
      assert.equal(question.jurisdiction, jurisdictionCode);
      assert.equal(question.contentPackVersion, pack.version);
      assert.equal(question.options.length, 3);
      assert.ok(question.answer >= 0 && question.answer < question.options.length);
      assert.ok(!ids.has(question.id), `duplicate question id ${question.id}`);
      ids.add(question.id);
      assert.ok(officialHosts[jurisdictionCode].some((host) => new URL(question.sourceUrl).hostname.endsWith(host)), `${question.id} official source`);
      if (question.scope === 'universal') {
        assert.ok(!/(California|Texas|Florida|DMV|DPS|FLHSMV)/i.test(question.prompt), `${question.id} has state-specific universal wording`);
      }
    }
    assert.equal(contentScenarios[jurisdictionCode].length, 3);
    for (const scenario of contentScenarios[jurisdictionCode]) {
      assert.equal(scenario.choices.length, 3);
      assert.ok(scenario.bestChoice >= 0 && scenario.bestChoice < scenario.choices.length);
      assert.ok(officialHosts[jurisdictionCode].some((host) => new URL(scenario.sourceUrl).hostname.endsWith(host)));
    }
  }
});

test('only jurisdictions with approved source-matrix review are selectable', () => {
  assert.deepEqual(supportedJurisdictions.map((jurisdiction) => jurisdiction.code), ['US-CA']);
  for (const jurisdiction of supportedJurisdictions) {
    assert.equal(jurisdiction.sourceMatrixReview.status, 'approved');
    assert.match(jurisdiction.sourceMatrixReview.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('state-specific packs do not contain another state name or jurisdiction code', () => {
  const forbidden = {
    'US-CA': /(Texas|Florida|US-TX|US-FL)/i,
    'US-TX': /(California|Florida|US-CA|US-FL)/i,
    'US-FL': /(California|Texas|US-CA|US-TX)/i,
  };
  for (const [jurisdiction, pack] of Object.entries(contentPacks)) {
    for (const question of pack.questions) {
      const text = [question.prompt, ...question.options, question.explanation].join(' ');
      assert.doesNotMatch(text, forbidden[jurisdiction as keyof typeof forbidden], question.id);
    }
  }
});

test('Texas and Florida packs explicitly cover launch-critical state requirements', () => {
  const texasText = contentPacks['US-TX'].questions.map((question) => `${question.objective} ${question.prompt} ${question.explanation}`).join(' ');
  assert.match(texasText, /30 .*hours/i);
  assert.match(texasText, /10 .*night/i);
  assert.match(texasText, /provisional license/i);
  assert.match(texasText, /Impact Texas Teen Drivers/i);
  const floridaText = contentPacks['US-FL'].questions.map((question) => `${question.objective} ${question.prompt} ${question.explanation}`).join(' ');
  assert.match(floridaText, /50 .*hours/i);
  assert.match(floridaText, /10 .*night/i);
  assert.match(floridaText, /TLSAE/i);
  assert.match(floridaText, /first three months/i);
});