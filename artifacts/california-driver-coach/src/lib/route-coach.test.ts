import assert from 'node:assert/strict';
import test from 'node:test';
import { requestReturnRoute } from './route-coach';

test('retries a transient routing failure before returning a route', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let attempts = 0;
  Object.assign(globalThis, {
    window: {
      setTimeout,
      clearTimeout,
    },
  });
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary route outage');
    return new Response(JSON.stringify({
      code: 'Ok',
      routes: [{
        distance: 1200,
        duration: 420,
        geometry: { coordinates: [[-121.9, 37.3], [-121.89, 37.31]] },
        legs: [{ steps: [{ distance: 100, name: 'Main St', maneuver: { type: 'turn', modifier: 'right', location: [-121.89, 37.31] } }] }],
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const route = await requestReturnRoute(37.3, -121.9, [-121.89, 37.31]);
    assert.equal(attempts, 2);
    assert.equal(route.steps[0]?.instruction, 'Turn right onto Main St');
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});

test('does not retry a route request rejected as invalid', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let attempts = 0;
  Object.assign(globalThis, { window: { setTimeout, clearTimeout } });
  globalThis.fetch = (async () => {
    attempts += 1;
    return new Response('invalid request', { status: 400 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      requestReturnRoute(37.3, -121.9, [-121.89, 37.31]),
      /Route service returned 400/,
    );
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});