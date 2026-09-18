import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

const settingsSource = readFileSync(new URL('./pages/settings.tsx', import.meta.url), 'utf8');
const syncManagerSource = readFileSync(new URL('./lib/use-sync-manager.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('./components/route-map.tsx', import.meta.url), 'utf8');
const documentSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
test('mobile navigation exposes every core destination with names and active state', () => {
  for (const destination of ['Today', 'Permit & knowledge', 'Driving exam', 'Parent view']) {
    assert.match(appSource, new RegExp(`label: '${destination}'`));
  }
  assert.match(appSource, /data-testid="button-header-settings"/);
  assert.match(appSource, /aria-label=\{item\.label\}/);
  assert.match(appSource, /aria-current=\{active \? 'page' : undefined\}/);
  assert.equal((appSource.match(/aria-label="Primary navigation"/g) ?? []).length, 1);
});

test('mobile menu is keyboard operable and hidden controls leave the tab order', () => {
  assert.match(appSource, /aria-expanded=\{mobileOpen\}/);
  assert.match(appSource, /aria-controls="mobile-navigation"/);
  assert.match(appSource, /inert=\{isMobile && !mobileOpen\}/);
  assert.match(appSource, /event\.key === 'Escape'/);
  assert.match(appSource, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(appSource, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(appSource, /event\.key !== 'Tab'/);
  assert.match(appSource, /event\.preventDefault\(\)/);
  assert.match(appSource, /aria-hidden=\{mobileOpen\} inert=\{mobileOpen\}/);
  assert.match(appSource, /aria-hidden=\{isMobile && mobileOpen\} inert=\{isMobile && mobileOpen\}/);
});

test('focus indicators and mobile navigation targets meet the visual contracts', () => {
  assert.match(styles, /:focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  assert.match(appSource, /min-h-11/);
  assert.match(appSource, /size-11/);
  assert.match(styles, /button\s*\{\s*min-height:\s*44px/);
});

test('page and route-map movement honor reduced motion', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.page-transition\s*\{\s*animation:\s*none !important/);
  assert.match(mapSource, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(mapSource, /animate: !reduceMotion\(\)/);
});

test('web beta surfaces local-data safeguards', () => {
  assert.match(appSource, /data-testid="local-progress-warning"/);
  assert.match(appSource, /data-testid="drive-storage-warning"/);
  assert.match(settingsSource, /testId="button-export-progress"/);
  assert.match(settingsSource, /data-testid="input-import-progress"/);
  assert.match(appSource, /Route coaching has started without video/);
});

test('web beta metadata describes Coastwise without starter copy', () => {
  assert.match(documentSource, /<title>Coastwise — California Teen Driver Coach<\/title>/);
  assert.doesNotMatch(documentSource, /built on Replit|Update this description/i);
});

test('Coastwise uses the locked brand name and dedicated logo asset', () => {
  assert.match(appSource, /coastwiseLogo/);
  assert.match(appSource, /data-testid="link-mobile-brand"/);
  assert.match(appSource, />Coastwise<\/div>/);
  assert.doesNotMatch(appSource, />coastwise<\/div>/);
  assert.match(documentSource, /href="\/favicon\.svg"/);
  assert.match(documentSource, /rel="apple-touch-icon"/);
  assert.match(documentSource, /rel="manifest"/);
  assert.match(documentSource, /name="theme-color" content="#0084FF"/);
});

test('dashboard greeting is generic and time-aware', () => {
  assert.match(appSource, /function getTimeOfDayGreeting\(hour: number\)/);
  assert.match(appSource, /if \(hour < 12\) return 'Good morning'/);
  assert.match(appSource, /if \(hour < 18\) return 'Good afternoon'/);
  assert.match(appSource, /return 'Good evening'/);
  assert.match(appSource, /<div className="mb-3[^>]*>\{greeting\}<\/div>/);
  assert.doesNotMatch(appSource, /Good morning, \{state\.profile\.name\}/);
});

test('premium coaching loop connects planning, safety, review, and family progress', () => {
  for (const testId of ['daily-coach-plan', 'preflight-checklist', 'drive-debrief', 'progress-journey', 'offline-status']) {
    assert.match(appSource, new RegExp(`data-testid="${testId}"`));
  }
  assert.match(appSource, /onClick=\{requestDriveStart\}/);
  assert.match(appSource, /disabled=\{!preflightReady\}/);
  assert.match(appSource, /testId="button-share-drive-summary"/);
  assert.match(appSource, /testId="button-share-family-progress"/);
});

test('installed app ownership is local, portable, and resettable without an account', () => {
  assert.match(settingsSource, /data-testid="install-settings-card"/);
  assert.match(settingsSource, /data-testid="reset-progress-card"/);
  assert.match(settingsSource, /testId="button-confirm-reset"/);
  assert.match(settingsSource, /clearDriveRecordings\(\)/);
  assert.match(settingsSource, /Use local coaching without an account/);
  assert.match(settingsSource, /syncManager\.unlinkDevice\(\);\s*setState\(freshState\)/);
  assert.match(syncManagerSource, /const unlinkDevice[\s\S]*lastLocalSyncState\.current = ''/);
  assert.match(syncManagerSource, /syncGeneration\.current \+= 1/);
  assert.match(syncManagerSource, /generation !== syncGeneration\.current/);
});
