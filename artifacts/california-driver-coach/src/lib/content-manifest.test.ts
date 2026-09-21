import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeContentNotice,
  bundledContentManifest,
  checkContentManifest,
  compareContentPackVersions,
  contentManifestStorageKey,
  getContentAcknowledgements,
  getMaterialContentNotice,
  parseContentManifest,
} from './content-manifest';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('accepts all bundled versioned jurisdiction manifests', () => {
  assert.deepEqual(parseContentManifest(bundledContentManifest), bundledContentManifest);
  assert.deepEqual(bundledContentManifest.packs.map((pack) => pack.jurisdiction), ['US-CA', 'US-TX', 'US-FL']);
  assert.equal(compareContentPackVersions('us-ca-2026.10.0', 'us-ca-2026.09.1'), 1);
  assert.equal(compareContentPackVersions('us-ca-2026.08.9', 'us-ca-2026.09.1'), -1);
});

test('distinguishes ordinary corrections from material updates', () => {
  const manifest = structuredClone(bundledContentManifest);
  const texas = manifest.packs.find((pack) => pack.jurisdiction === 'US-TX');
  assert.ok(texas);
  texas.notices.push(
    {
      id: 'tx-wording-correction',
      jurisdiction: 'US-TX',
      packVersion: texas.version,
      level: 'correction',
      effectiveDate: '2026-09-21',
      title: 'Source wording clarified',
      summary: 'A citation label was clarified without changing the correct answer.',
      affectedTopics: ['Signs, signals & markings'],
      sourceUrl: texas.sourceUrl,
    },
    {
      id: 'tx-material-rule',
      jurisdiction: 'US-TX',
      packVersion: texas.version,
      level: 'material',
      effectiveDate: '2026-09-21',
      title: 'Practice requirement changed',
      summary: 'A rule changed and requires acknowledgement.',
      affectedTopics: ['Licensing & permits'],
      sourceUrl: texas.sourceUrl,
    },
  );
  assert.equal(parseContentManifest(manifest)?.packs.length, 3);
  assert.equal(getMaterialContentNotice(manifest, 'US-TX', [])?.id, 'tx-material-rule');
  assert.equal(getMaterialContentNotice(manifest, 'US-TX', ['tx-material-rule']), undefined);
});

test('retains the bundled last-known-good pack when update checks fail', async () => {
  const status = await checkContentManifest({
    storage: memoryStorage(),
    fetcher: async () => { throw new Error('offline'); },
  });
  assert.equal(status.kind, 'unavailable');
  assert.equal(status.source, 'bundled');
  assert.match(status.message, /last-known-good/i);
});

test('material content acknowledgements remain device-local', () => {
  const storage = memoryStorage();
  const manifest = structuredClone(bundledContentManifest);
  manifest.packs[0].notices.push({
    id: 'us-ca-material-example',
    jurisdiction: 'US-CA',
    packVersion: 'us-ca-2026.10.0',
    level: 'material',
    effectiveDate: '2026-10-01',
    title: 'California permit rule update',
    summary: 'A material permit requirement changed.',
    affectedTopics: ['Licensing & permits'],
    sourceUrl: manifest.packs[0].sourceUrl,
  });
  assert.equal(getMaterialContentNotice(manifest, 'US-CA', [])?.id, 'us-ca-material-example');
  acknowledgeContentNotice(storage, 'us-ca-material-example');
  assert.deepEqual(getContentAcknowledgements(storage), ['us-ca-material-example']);
  assert.equal(getMaterialContentNotice(manifest, 'US-CA', getContentAcknowledgements(storage)), undefined);
});

test('rejects mismatched notice provenance', () => {
  const manifest = structuredClone(bundledContentManifest);
  manifest.packs[0].notices.push({
    id: 'wrong-pack-notice',
    jurisdiction: 'US-CA',
    packVersion: 'us-ca-2026.10.0',
    level: 'material',
    effectiveDate: '2026-10-01',
    title: 'Mismatched notice',
    summary: 'This notice does not belong to the enclosing pack.',
    affectedTopics: [],
    sourceUrl: manifest.packs[0].sourceUrl,
  });
  assert.equal(parseContentManifest(manifest), null);
});

test('does not cache a rollback or missing-pack manifest', async () => {
  for (const manifest of [
    { ...structuredClone(bundledContentManifest), packs: [{ ...bundledContentManifest.packs[0], version: 'us-ca-2026.08.9' }] },
    { ...structuredClone(bundledContentManifest), packs: [] },
  ]) {
    const storage = memoryStorage();
    const status = await checkContentManifest({
      storage,
      currentVersion: 'us-ca-2026.09.1',
      fetcher: async () => new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });
    assert.equal(status.kind, 'unavailable');
    assert.equal(storage.getItem(contentManifestStorageKey), null);
  }
});