import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentMaterialPolicyNotice, parsePolicyAcknowledgement, requiresCurrentPolicyAcknowledgement } from './policy-notice';

describe('material policy acknowledgement', () => {
  it('requires acknowledgement when no valid local record exists', () => {
    assert.equal(requiresCurrentPolicyAcknowledgement(null), true);
    assert.equal(parsePolicyAcknowledgement('not-json'), null);
    assert.equal(parsePolicyAcknowledgement('{"version":"old","acknowledgedAt":"invalid"}'), null);
  });

  it('requires acknowledgement again after the notice version changes', () => {
    assert.equal(requiresCurrentPolicyAcknowledgement({
      version: 'older-version',
      acknowledgedAt: '2026-01-01T00:00:00.000Z',
    }), true);
  });

  it('accepts a valid acknowledgement for the current notice', () => {
    const acknowledgement = parsePolicyAcknowledgement(JSON.stringify({
      version: currentMaterialPolicyNotice.version,
      acknowledgedAt: '2026-09-18T12:00:00.000Z',
    }));
    assert.equal(requiresCurrentPolicyAcknowledgement(acknowledgement), false);
  });
});