/**
 * Detects when an official source cited by practice content has changed since
 * it was last reviewed. It never edits questions: a person reviews every change
 * and then records the new baseline with `--update`.
 *
 *   pnpm content:sources            # compare against the reviewed baseline
 *   pnpm content:sources --update   # record the current sources as reviewed
 *   pnpm content:sources --report=path.md
 *
 * It also flags content packs and source matrices not reviewed in
 * REVIEW_MAX_AGE_DAYS, since laws can change without the page changing much.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentPacks, contentScenarios } from '../src/data/content-packs';
import { jurisdictions, type JurisdictionCode } from '../src/lib/jurisdiction';
import { getMobilePracticePack } from '../../coastwise-mobile/lib/practice-content';

const BASELINE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/content-packs/source-fingerprints.json');
const FETCH_TIMEOUT_MS = 90_000;
const FETCH_ATTEMPTS = 2;
export const REVIEW_MAX_AGE_DAYS = 180;
const DAY_MS = 86_400_000;

type Fingerprint = { sha256: string; kind: 'html' | 'binary'; reviewedAt: string };
type Baseline = Record<string, Fingerprint>;
type SourceUse = { jurisdiction: JurisdictionCode; ids: Set<string> };

function collectSources() {
  const sources = new Map<string, SourceUse>();
  const use = (url: string, jurisdiction: JurisdictionCode, id: string) => {
    const entry = sources.get(url) ?? { jurisdiction, ids: new Set<string>() };
    entry.ids.add(id);
    sources.set(url, entry);
  };
  for (const pack of Object.values(contentPacks)) {
    use(pack.sourceUrl, pack.jurisdiction, `${pack.version} handbook`);
    for (const question of pack.questions) use(question.sourceUrl, pack.jurisdiction, question.id);
  }
  for (const [jurisdiction, scenarios] of Object.entries(contentScenarios) as [JurisdictionCode, typeof contentScenarios[JurisdictionCode]][]) {
    for (const scenario of scenarios) use(scenario.sourceUrl, jurisdiction, scenario.id);
    for (const question of getMobilePracticePack(jurisdiction)) use(question.sourceUrl, jurisdiction, `mobile:${question.id}`);
    use(jurisdictions[jurisdiction].handbookUrl, jurisdiction, 'handbook link');
  }
  return sources;
}

/**
 * Visible page text as a sorted set of text blocks, so scripts, tokens, markup
 * churn, and lists shown in random order (such as provider tables) are ignored.
 */
export function visibleText(html: string) {
  const blocks = html
    .replace(/<(script|style|noscript|svg|iframe)\b[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(blocks)].sort().join('\n');
}

async function fingerprint(url: string): Promise<Omit<Fingerprint, 'reviewedAt'>> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fingerprintOnce(url);
    } catch (error) {
      if (attempt >= FETCH_ATTEMPTS) throw error;
    }
  }
}

async function fingerprintOnce(url: string): Promise<Omit<Fingerprint, 'reviewedAt'>> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'Coastwise content review (+https://github.com/qv6zktmm6r-wq/Coastwise)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('html')) {
    return { kind: 'html', sha256: createHash('sha256').update(visibleText(await response.text())).digest('hex') };
  }
  return { kind: 'binary', sha256: createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex') };
}

function readBaseline(): Baseline {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

/** Content packs and source matrices whose last review is older than the limit. */
export function staleReviews(today: string) {
  const now = Date.parse(today);
  const stale: string[] = [];
  const check = (label: string, reviewedAt: string) => {
    const age = Math.floor((now - Date.parse(reviewedAt)) / DAY_MS);
    if (!(age <= REVIEW_MAX_AGE_DAYS)) stale.push(`- ${label} — last reviewed ${reviewedAt} (${Number.isNaN(age) ? 'invalid date' : `${age} days ago`})`);
  };
  for (const pack of Object.values(contentPacks)) check(`${jurisdictions[pack.jurisdiction].name} content pack ${pack.version}`, pack.reviewedAt);
  for (const jurisdiction of Object.values(jurisdictions)) check(`${jurisdiction.name} source matrix (${jurisdiction.sourceMatrixReview.recordPath})`, jurisdiction.sourceMatrixReview.reviewedAt);
  return stale;
}

async function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const reportPath = args.find((arg) => arg.startsWith('--report='))?.slice('--report='.length);
  const today = new Date().toISOString().slice(0, 10);
  const sources = collectSources();
  const stale = staleReviews(today);
  const baseline = readBaseline();
  const next: Baseline = {};
  const changed: string[] = [];
  const unreviewed: string[] = [];
  const unreachable: { url: string; reason: string }[] = [];

  const urls = [...sources.keys()].sort();
  await Promise.all(urls.map(async (url) => {
    try {
      const current = await fingerprint(url);
      const previous = baseline[url];
      next[url] = { ...current, reviewedAt: update || !previous ? today : previous.reviewedAt };
      if (!previous) unreviewed.push(url);
      else if (previous.sha256 !== current.sha256) {
        changed.push(url);
        if (!update) next[url] = previous;
      }
    } catch (error) {
      unreachable.push({ url, reason: error instanceof Error ? error.message : String(error) });
      if (baseline[url]) next[url] = baseline[url];
    }
  }));

  const describe = (url: string) => {
    const use = sources.get(url)!;
    const ids = [...use.ids].sort();
    return `- **${jurisdictions[use.jurisdiction].name}** — ${url}\n  - Used by ${ids.length}: ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? ', …' : ''}`;
  };
  const sections = [
    `# Content source check — ${today}`,
    `Checked ${urls.length} official sources.`,
    changed.length ? `## Changed since last review (${changed.length})\nRe-read these sources, update affected questions if the rules changed, bump the state's pack version, then run \`pnpm content:sources --update\`.\n\n${changed.sort().map(describe).join('\n')}` : '## No reviewed source changed',
    stale.length ? `## Review older than ${REVIEW_MAX_AGE_DAYS} days (${stale.length})\nRe-read the handbook for law changes, update questions if needed, then update the review date.\n\n${stale.join('\n')}` : '',
    unreviewed.length ? `## Not yet in the reviewed baseline (${unreviewed.length})\n${unreviewed.sort().map(describe).join('\n')}` : '',
    unreachable.length ? `## Could not be checked (${unreachable.length})\nUsually temporary; a source that stays unreachable may have moved.\n\n${unreachable.sort((a, b) => a.url.localeCompare(b.url)).map(({ url, reason }) => `${describe(url)}\n  - ${reason}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  console.log(sections);
  if (reportPath) writeFileSync(reportPath, `${sections}\n`);

  if (update) {
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`\nRecorded ${Object.keys(sorted).length} sources as reviewed in ${BASELINE_PATH}.`);
    return;
  }
  if (changed.length || unreviewed.length || stale.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
