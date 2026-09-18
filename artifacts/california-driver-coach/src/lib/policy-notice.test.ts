import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentMaterialPolicyNotice, parsePolicyAcknowledgements, requiresCurrentPolicyAcknowledgement } from './policy-notice';

describe('material policy acknowledgement', () => {
  it('requires acknowledgement when no valid local record exists', () => {
    assert.equal(requiresCurrentPolicyAcknowledgement([]), true);
    assert.deepEqual(parsePolicyAcknowledgements('not-json'), []);
    assert.deepEqual(parsePolicyAcknowledgements('{"version":"old","acknowledgedAt":"invalid"}'), []);
  });

  it('requires acknowledgement again after the notice version changes', () => {
    assert.equal(requiresCurrentPolicyAcknowledgement([{
      version: 'older-version',
      acknowledgedAt: '2026-01-01T00:00:00.000Z',
    }]), true);
  });

  it('accepts a valid acknowledgement for the current notice', () => {
    const acknowledgements = parsePolicyAcknowledgements(JSON.stringify({
      version: currentMaterialPolicyNotice.version,
      acknowledgedAt: '2026-09-18T12:00:00.000Z',
    }));
    assert.equal(requiresCurrentPolicyAcknowledgement(acknowledgements), false);
  });

  it('keeps valid acknowledgement history and ignores malformed entries', () => {
    const acknowledgements = parsePolicyAcknowledgements(JSON.stringify({
      acknowledgements: [
        { version: '2026-03-02', acknowledgedAt: '2026-03-03T12:00:00.000Z' },
        { version: 'invalid', acknowledgedAt: 'not-a-date' },
        { version: currentMaterialPolicyNotice.version, acknowledgedAt: '2026-09-18T12:00:00.000Z' },
      ],
    }));
    assert.deepEqual(acknowledgements.map(({ version }) => version), ['2026-03-02', currentMaterialPolicyNotice.version]);
    assert.equal(requiresCurrentPolicyAcknowledgement(acknowledgements), false);
  });
});