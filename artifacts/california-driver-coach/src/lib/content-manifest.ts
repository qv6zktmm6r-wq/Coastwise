import {
  CALIFORNIA_CONTENT_PACK_VERSION,
  FLORIDA_CONTENT_PACK_VERSION,
  TEXAS_CONTENT_PACK_VERSION,
  NEW_YORK_CONTENT_PACK_VERSION,
  OHIO_CONTENT_PACK_VERSION,
  ILLINOIS_CONTENT_PACK_VERSION,
  defaultJurisdiction,
  isJurisdictionCode,
  getCurrentContentPackVersion,
  type JurisdictionCode,
} from './jurisdiction';

export type ContentChangeLevel = 'correction' | 'material';

export type ContentChangeNotice = {
  id: string;
  jurisdiction: JurisdictionCode;
  packVersion: string;
  level: ContentChangeLevel;
  effectiveDate: string;
  title: string;
  summary: string;
  affectedTopics: string[];
  sourceUrl: string;
};

export type ContentPackManifestEntry = {
  jurisdiction: JurisdictionCode;
  version: string;
  sourceRevision: string;
  effectiveDate: string;
  reviewedAt: string;
  sourceUrl: string;
  notices: ContentChangeNotice[];
};

export type ContentManifest = {
  schemaVersion: 1;
  generatedAt: string;
  packs: ContentPackManifestEntry[];
};

export type ContentManifestStatus =
  | { kind: 'current'; manifest: ContentManifest; source: 'network' | 'cache' | 'bundled' }
  | { kind: 'update-available'; manifest: ContentManifest; pack: ContentPackManifestEntry; source: 'network' | 'cache' }
  | { kind: 'unavailable'; manifest: ContentManifest; source: 'cache' | 'bundled'; message: string };

export const contentManifestStorageKey = 'coastwise-content-manifest-v1';
export const contentAcknowledgementStorageKey = 'coastwise-content-acknowledgements-v1';

export const bundledContentManifest: ContentManifest = {
  schemaVersion: 1,
  generatedAt: '2026-09-20T00:00:00.000Z',
  packs: [
    {
      jurisdiction: 'US-CA',
      version: CALIFORNIA_CONTENT_PACK_VERSION,
      sourceRevision: 'California Driver’s Handbook 2026',
      effectiveDate: '2026-01-01',
      reviewedAt: '2026-09-20',
      sourceUrl: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/',
      notices: [],
    },
    {
      jurisdiction: 'US-TX',
      version: TEXAS_CONTENT_PACK_VERSION,
      sourceRevision: 'Texas Driver Handbook DL-7, January 2026, with current official DPS/TxDOT/TxDMV/TDI sources',
      effectiveDate: '2026-09-21',
      reviewedAt: '2026-09-21',
      sourceUrl: 'https://www.dps.texas.gov/internetforms/forms/dl-7.pdf',
      notices: [],
    },
    {
      jurisdiction: 'US-FL',
      version: FLORIDA_CONTENT_PACK_VERSION,
      sourceRevision: 'Florida Class E Driver License Handbook 2023 with current official FLHSMV and statute sources',
      effectiveDate: '2026-09-21',
      reviewedAt: '2026-09-21',
      sourceUrl: 'https://www.flhsmv.gov/pdf/handbooks/englishdriverhandbook.pdf',
      notices: [],
    },
    {
      jurisdiction: 'US-NY', version: NEW_YORK_CONTENT_PACK_VERSION,
      sourceRevision: 'New York State Driver’s Manual and official DMV sources checked 2026-09-21',
      effectiveDate: '2026-09-21', reviewedAt: '2026-09-21',
      sourceUrl: 'https://dmv.ny.gov/new-york-state-drivers-manual-practice-tests', notices: [],
    },
    {
      jurisdiction: 'US-OH', version: OHIO_CONTENT_PACK_VERSION,
      sourceRevision: 'Ohio Driver Manual and official BMV sources checked 2026-09-21',
      effectiveDate: '2026-09-21', reviewedAt: '2026-09-21',
      sourceUrl: 'https://publicsafety.ohio.gov/who-we-are/resources/digest-of-motor-vehicle-laws', notices: [],
    },
    {
      jurisdiction: 'US-IL', version: ILLINOIS_CONTENT_PACK_VERSION,
      sourceRevision: 'Illinois Rules of the Road and official Secretary of State sources checked 2026-09-21',
      effectiveDate: '2026-09-21', reviewedAt: '2026-09-21',
      sourceUrl: 'https://www.ilsos.gov/publications/pdf_publications/dsd_a112.pdf', notices: [],
    },
  ],
};

function isNotice(value: unknown): value is ContentChangeNotice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const notice = value as Record<string, unknown>;
  return typeof notice.id === 'string'
    && isJurisdictionCode(notice.jurisdiction)
    && typeof notice.packVersion === 'string'
    && (notice.level === 'correction' || notice.level === 'material')
    && typeof notice.effectiveDate === 'string'
    && typeof notice.title === 'string'
    && typeof notice.summary === 'string'
    && Array.isArray(notice.affectedTopics)
    && notice.affectedTopics.every((topic) => typeof topic === 'string')
    && typeof notice.sourceUrl === 'string';
}

export function parseContentManifest(value: unknown): ContentManifest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || typeof candidate.generatedAt !== 'string' || !Array.isArray(candidate.packs)) return null;
  const packs: ContentPackManifestEntry[] = [];
  const seen = new Set<JurisdictionCode>();
  for (const value of candidate.packs) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const pack = value as Record<string, unknown>;
    if (
      !isJurisdictionCode(pack.jurisdiction)
      || typeof pack.version !== 'string'
      || typeof pack.sourceRevision !== 'string'
      || typeof pack.effectiveDate !== 'string'
      || typeof pack.reviewedAt !== 'string'
      || typeof pack.sourceUrl !== 'string'
      || !Array.isArray(pack.notices)
      || !pack.notices.every((notice) =>
        isNotice(notice)
        && notice.jurisdiction === pack.jurisdiction
        && notice.packVersion === pack.version
      )
    ) return null;
    if (seen.has(pack.jurisdiction)) return null;
    const versionMatch = /^us-[a-z]{2}-\d{4}\.\d{2}\.\d+$/.exec(pack.version);
    if (!versionMatch || !pack.version.startsWith(`${pack.jurisdiction.toLowerCase()}-`)) return null;
    seen.add(pack.jurisdiction);
    packs.push(pack as unknown as ContentPackManifestEntry);
  }
  if (packs.length !== 6 || seen.size !== 6) return null;
  return { schemaVersion: 1, generatedAt: candidate.generatedAt, packs };
}

function versionParts(version: string): [number, number, number] | null {
  const match = /^us-[a-z]{2}-(\d{4})\.(\d{2})\.(\d+)$/.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareContentPackVersions(left: string, right: string): -1 | 0 | 1 | null {
  if (left === right) return 0;
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts || !rightParts || left.slice(0, 5) !== right.slice(0, 5)) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] < rightParts[index]) return -1;
    if (leftParts[index] > rightParts[index]) return 1;
  }
  return 0;
}

export function loadCachedContentManifest(storage: Pick<Storage, 'getItem'>): ContentManifest | null {
  try {
    const raw = storage.getItem(contentManifestStorageKey);
    return raw ? parseContentManifest(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function getPackFromManifest(manifest: ContentManifest, jurisdiction: JurisdictionCode) {
  return manifest.packs.find((pack) => pack.jurisdiction === jurisdiction);
}
function isManifestCurrentOrNewer(manifest: ContentManifest) {
  return manifest.packs.every((pack) => {
    const comparison = compareContentPackVersions(pack.version, getCurrentContentPackVersion(pack.jurisdiction));
    return comparison !== null && comparison >= 0;
  });
}

export function getMaterialContentNotice(
  manifest: ContentManifest,
  jurisdiction: JurisdictionCode,
  acknowledgedIds: string[],
) {
  return getPackFromManifest(manifest, jurisdiction)?.notices
    .find((notice) => notice.level === 'material' && !acknowledgedIds.includes(notice.id));
}

export function getContentAcknowledgements(storage: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = storage.getItem(contentAcknowledgementStorageKey);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function acknowledgeContentNotice(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string) {
  const acknowledgements = [...new Set([...getContentAcknowledgements(storage), id])];
  storage.setItem(contentAcknowledgementStorageKey, JSON.stringify(acknowledgements));
  return acknowledgements;
}

export async function checkContentManifest({
  jurisdiction = defaultJurisdiction,
  currentVersion,
  fetcher = fetch,
  storage = window.localStorage,
}: {
  jurisdiction?: JurisdictionCode;
  currentVersion?: string;
  fetcher?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
} = {}): Promise<ContentManifestStatus> {
  const installedVersion = currentVersion ?? ({
    'US-CA': CALIFORNIA_CONTENT_PACK_VERSION,
    'US-TX': TEXAS_CONTENT_PACK_VERSION,
    'US-FL': FLORIDA_CONTENT_PACK_VERSION,
    'US-NY': NEW_YORK_CONTENT_PACK_VERSION,
    'US-OH': OHIO_CONTENT_PACK_VERSION,
    'US-IL': ILLINOIS_CONTENT_PACK_VERSION,
  } satisfies Record<JurisdictionCode, string>)[jurisdiction];
  const cached = loadCachedContentManifest(storage);
  try {
    const response = await fetcher(`${import.meta.env.BASE_URL}content-manifest.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest returned ${response.status}`);
    const manifest = parseContentManifest(await response.json());
    if (!manifest) throw new Error('manifest is invalid');
    if (manifest.packs.some((entry) => compareContentPackVersions(entry.version, getCurrentContentPackVersion(entry.jurisdiction)) === -1)) {
      throw new Error('manifest contains a rollback');
    }
    const pack = getPackFromManifest(manifest, jurisdiction);
    if (!pack) throw new Error('manifest does not contain the selected jurisdiction');
    const comparison = compareContentPackVersions(pack.version, installedVersion);
    if (comparison === null || comparison < 0) throw new Error('manifest pack version is invalid or older than the installed pack');
    storage.setItem(contentManifestStorageKey, JSON.stringify(manifest));
    return comparison > 0
      ? { kind: 'update-available', manifest, pack, source: 'network' }
      : { kind: 'current', manifest, source: 'network' };
  } catch {
    const cachedPack = cached ? getPackFromManifest(cached, jurisdiction) : undefined;
    const cachedComparison = cachedPack
      ? compareContentPackVersions(cachedPack.version, installedVersion)
      : null;
    const canUseCached = cached && cachedPack && cachedComparison !== null && cachedComparison >= 0 && isManifestCurrentOrNewer(cached);
    const fallback = canUseCached ? cached : bundledContentManifest;
    const pack = getPackFromManifest(fallback, jurisdiction);
    if (canUseCached && pack && cachedComparison === 1) {
      return { kind: 'update-available', manifest: fallback, pack, source: 'cache' };
    }
    return {
      kind: 'unavailable',
      manifest: fallback,
      source: canUseCached ? 'cache' : 'bundled',
      message: 'Coastwise could not check for handbook updates. Your last-known-good study pack is still available.',
    };
  }
}