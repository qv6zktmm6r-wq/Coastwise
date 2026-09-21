import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  assert.deepEqual(bundledContentManifest.packs.map((pack) => pack.jurisdiction), ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-OH', 'US-IL']);
  assert.equal(compareContentPackVersions('us-ca-2026.10.0', 'us-ca-2026.09.1'), 1);
  assert.equal(compareContentPackVersions('us-ca-2026.08.9', 'us-ca-2026.09.1'), -1);
});

test('publishes the Florida DETS material notice under the corrected pack version', () => {
  const florida = bundledContentManifest.packs.find((pack) => pack.jurisdiction === 'US-FL');
  assert.ok(florida);
  assert.equal(florida.version, 'us-fl-2026.09.2');
  assert.equal(florida.notices[0]?.level, 'material');
  assert.match(florida.notices[0]?.sourceUrl ?? '', /driver-education-traffic-safety-dets/);
  assert.match(florida.notices[0]?.summary ?? '', /under-18.*DETS/i);
});

test('does not accept a superseded Florida manifest pack', async () => {
  const stale = structuredClone(bundledContentManifest);
  const florida = stale.packs.find((pack) => pack.jurisdiction === 'US-FL');
  assert.ok(florida);
  florida.version = 'us-fl-2026.09.1';
  florida.notices = [];
  const storage = memoryStorage();
  const status = await checkContentManifest({
    jurisdiction: 'US-FL',
    storage,
    fetcher: async () => new Response(JSON.stringify(stale), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });
  assert.equal(status.kind, 'unavailable');
  assert.equal(storage.getItem(contentManifestStorageKey), null);
});

test('public manifest exactly mirrors the bundled manifest', () => {
  const publicManifest = JSON.parse(readFileSync(resolve(process.cwd(), 'public/content-manifest.json'), 'utf8'));
  assert.deepEqual(publicManifest, bundledContentManifest);
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
   assert.equal(parseContentManifest(manifest)?.packs.length, 6);
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

test('accepts a current six-state manifest without reporting an update', async () => {
  const status = await checkContentManifest({
    jurisdiction: 'US-IL',
    storage: memoryStorage(),
    fetcher: async () => new Response(JSON.stringify(bundledContentManifest), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  });
  assert.equal(status.kind, 'current');
  assert.equal(status.source, 'network');
  assert.equal(status.manifest.packs.length, 6);
});

test('reports a newer ordinary correction without requiring a material acknowledgement', async () => {
  const manifest = structuredClone(bundledContentManifest);
  const texas = manifest.packs.find((pack) => pack.jurisdiction === 'US-TX');
  assert.ok(texas);
  texas.version = 'us-tx-2026.10.0';
  texas.notices.push({
    id: 'tx-correction-2026-10',
    jurisdiction: 'US-TX',
    packVersion: texas.version,
    level: 'correction',
    effectiveDate: '2026-10-01',
    title: 'Citation wording clarified',
    summary: 'A source label was clarified without changing the answer.',
    affectedTopics: ['Signs, signals & markings'],
    sourceUrl: texas.sourceUrl,
  });
  const status = await checkContentManifest({
    jurisdiction: 'US-TX',
    storage: memoryStorage(),
    currentVersion: 'us-tx-2026.09.1',
    fetcher: async () => new Response(JSON.stringify(manifest), { status: 200 }),
  });
  assert.equal(status.kind, 'update-available');
  assert.equal(status.pack.version, 'us-tx-2026.10.0');
  assert.equal(getMaterialContentNotice(status.manifest, 'US-TX', []), undefined);
});

test('preserves a material notice and its official source link', () => {
  const manifest = structuredClone(bundledContentManifest);
  const ohio = manifest.packs.find((pack) => pack.jurisdiction === 'US-OH');
  assert.ok(ohio);
  ohio.notices.push({
    id: 'oh-material-rule-2026',
    jurisdiction: 'US-OH',
    packVersion: ohio.version,
    level: 'material',
    effectiveDate: '2026-10-01',
    title: 'Probationary restriction update',
    summary: 'The official restriction guidance changed and requires review.',
    affectedTopics: ['Licensing & permits'],
    sourceUrl: 'https://bmv.ohio.gov/dl-gdl.aspx',
  });
  const notice = getMaterialContentNotice(manifest, 'US-OH', []);
  assert.ok(notice);
  assert.equal(notice.sourceUrl, 'https://bmv.ohio.gov/dl-gdl.aspx');
  assert.equal(getMaterialContentNotice(manifest, 'US-OH', [notice.id]), undefined);
});

test('uses a newer cached manifest while offline and rejects a stale cache', async () => {
  const newer = structuredClone(bundledContentManifest);
  const illinois = newer.packs.find((pack) => pack.jurisdiction === 'US-IL');
  assert.ok(illinois);
  illinois.version = 'us-il-2026.10.0';
  const cachedStorage = memoryStorage();
  cachedStorage.setItem(contentManifestStorageKey, JSON.stringify(newer));
  const cachedStatus = await checkContentManifest({
    jurisdiction: 'US-IL',
    storage: cachedStorage,
    currentVersion: 'us-il-2026.09.1',
    fetcher: async () => { throw new Error('offline'); },
  });
  assert.equal(cachedStatus.kind, 'update-available');
  assert.equal(cachedStatus.source, 'cache');

  const staleStorage = memoryStorage();
  const stale = structuredClone(bundledContentManifest);
  stale.packs[0].version = 'us-ca-2026.08.1';
  staleStorage.setItem(contentManifestStorageKey, JSON.stringify(stale));
  const staleStatus = await checkContentManifest({
    jurisdiction: 'US-CA',
    storage: staleStorage,
    currentVersion: 'us-ca-2026.09.1',
    fetcher: async () => { throw new Error('offline'); },
  });
  assert.equal(staleStatus.kind, 'unavailable');
  assert.equal(staleStatus.source, 'bundled');
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

test('rejects duplicate, mismatched, and malformed six-pack manifests atomically', () => {
  const duplicate = structuredClone(bundledContentManifest);
  duplicate.packs[1] = { ...duplicate.packs[0] };
  assert.equal(parseContentManifest(duplicate), null);
  const mismatch = structuredClone(bundledContentManifest);
  mismatch.packs[0].version = 'us-tx-2026.09.1';
  assert.equal(parseContentManifest(mismatch), null);
  const malformed = structuredClone(bundledContentManifest);
  malformed.packs[0].version = '2026-01';
  assert.equal(parseContentManifest(malformed), null);
});

test('does not use a cached manifest with a rollback in another jurisdiction', async () => {
  const cached = structuredClone(bundledContentManifest);
  cached.packs[1].version = 'us-tx-2026.08.1';
  const storage = memoryStorage();
  storage.setItem(contentManifestStorageKey, JSON.stringify(cached));
  const status = await checkContentManifest({
    jurisdiction: 'US-CA',
    storage,
    fetcher: async () => { throw new Error('offline'); },
  });
  assert.equal(status.source, 'bundled');
});