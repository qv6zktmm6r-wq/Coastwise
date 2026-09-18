import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
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
  assert.match(appSource, /testId="button-export-progress"/);
  assert.match(appSource, /data-testid="input-import-progress"/);
  assert.match(appSource, /Route coaching has started without video/);
});

test('web beta metadata describes Coastwise without starter copy', () => {
  assert.match(documentSource, /<title>Coastwise — California Teen Driver Coach<\/title>/);
  assert.doesNotMatch(documentSource, /built on Replit|Update this description/i);
});
