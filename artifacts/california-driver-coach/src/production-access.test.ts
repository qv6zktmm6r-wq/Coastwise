import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { headersForProductionRequest } from './production-access';

describe('production external-access headers', () => {
  const productionOrigin = 'https://coastwise.example';
  const token = 'production-secret';

  it('adds the bearer token to production-origin requests', () => {
    assert.deepEqual(
      headersForProductionRequest(
        `${productionOrigin}/api/healthz`,
        productionOrigin,
        token,
        { Accept: 'application/json' },
      ),
      {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    );
  });

  it('never adds the bearer token to cross-origin requests', () => {
    assert.deepEqual(
      headersForProductionRequest(
        'https://accounts.example/session',
        productionOrigin,
        token,
        { Accept: 'application/json' },
      ),
      { Accept: 'application/json' },
    );
  });

  it('does not add an authorization header for public checks', () => {
    assert.deepEqual(
      headersForProductionRequest(
        `${productionOrigin}/`,
        productionOrigin,
        undefined,
      ),
      {},
    );
  });
});