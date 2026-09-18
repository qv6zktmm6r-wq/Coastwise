export type MaterialPolicyNotice = {
  version: string;
  effectiveDate: string;
  title: string;
  summary: string;
  changes: string[];
};

export type PolicyAcknowledgement = {
  version: string;
  acknowledgedAt: string;
};

export const policyAcknowledgementStorageKey = 'coastwise-policy-acknowledgement';

// Increase the version and update this summary only for revisions that require
// families to actively review privacy, recording, permission, or safety terms.
export const currentMaterialPolicyNotice: MaterialPolicyNotice = {
  version: '2026-09-18',
  effectiveDate: 'September 18, 2026',
  title: 'Privacy and safety terms have changed',
  summary: 'We clarified how Coastwise handles device permissions, drive recordings, family sharing, and safe use during supervised practice.',
  changes: [
    'Camera, microphone, and precise location access are used only when you choose features that need them.',
    'Drive recordings and precise route details stay on this device and are not included in family sync.',
    'A supervising adult remains responsible for safe, legal practice and should not interact with Coastwise while driving.',
  ],
};

export function parsePolicyAcknowledgement(value: string | null): PolicyAcknowledgement | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate === 'object'
      && candidate !== null
      && 'version' in candidate
      && typeof candidate.version === 'string'
      && 'acknowledgedAt' in candidate
      && typeof candidate.acknowledgedAt === 'string'
      && !Number.isNaN(Date.parse(candidate.acknowledgedAt))
    ) {
      return { version: candidate.version, acknowledgedAt: candidate.acknowledgedAt };
    }
  } catch {
    // A malformed local value must never bypass a material notice.
  }
  return null;
}

export function getPolicyAcknowledgement() {
  try {
    return parsePolicyAcknowledgement(window.localStorage.getItem(policyAcknowledgementStorageKey));
  } catch {
    return null;
  }
}

export function saveCurrentPolicyAcknowledgement(): PolicyAcknowledgement {
  const acknowledgement = {
    version: currentMaterialPolicyNotice.version,
    acknowledgedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(policyAcknowledgementStorageKey, JSON.stringify(acknowledgement));
  return acknowledgement;
}

export function requiresCurrentPolicyAcknowledgement(acknowledgement: PolicyAcknowledgement | null) {
  return acknowledgement?.version !== currentMaterialPolicyNotice.version;
}