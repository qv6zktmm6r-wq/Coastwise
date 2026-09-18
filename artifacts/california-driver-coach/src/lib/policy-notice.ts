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

export const materialPolicyNotices: MaterialPolicyNotice[] = [
  {
    version: '2026-09-18-ai-debrief',
    effectiveDate: 'September 18, 2026',
    title: 'Optional AI drive debriefs',
    summary: 'Coastwise can now create an optional coaching debrief from a limited drive summary while keeping video, precise routes, identity, and family notes on your device.',
    changes: [
      'AI debriefs are generated only when you choose the Generate debrief action.',
      'Only duration, distance, night-driving status, skills, coach-event text, and low-mastery topic summaries are sent.',
      'Drive video, precise route and location, speed readings, identity, notes, recording details, and raw answers are not sent for AI debriefs.',
    ],
  },
  {
    version: '2026-09-18',
    effectiveDate: 'September 18, 2026',
    title: 'Privacy and safety terms have changed',
    summary: 'We clarified how Coastwise handles device permissions, drive recordings, family sharing, and safe use during supervised practice.',
    changes: [
      'Camera and precise location access are used only when you choose features that need them.',
      'Drive recordings and precise route details stay on this device and are not included in family sync.',
      'A supervising adult remains responsible for safe, legal practice and should not interact with Coastwise while driving.',
    ],
  },
  {
    version: '2026-06-12',
    effectiveDate: 'June 12, 2026',
    title: 'Local recordings and family sharing',
    summary: 'We explained which drive details stay on the recording device and which practice summaries can be shared with a connected family.',
    changes: [
      'Drive videos, precise routes, and coaching-event positions remain on the device that recorded them.',
      'Connected families can share practice results, goals, settings, and drive-log summaries.',
    ],
  },
  {
    version: '2026-03-02',
    effectiveDate: 'March 2, 2026',
    title: 'Permissions and supervised use',
    summary: 'We added clearer notice about optional camera and location permissions and the supervising adult’s safety responsibilities.',
    changes: [
      'Coastwise asks for device permissions only when a feature needs them.',
      'A supervising adult should set up coaching before driving begins and remain responsible for safe, legal practice.',
    ],
  },
];

// Increase the version and update this summary only for revisions that require
// families to actively review privacy, recording, permission, or safety terms.
export const currentMaterialPolicyNotice = materialPolicyNotices[0];

function parseAcknowledgement(candidate: unknown): PolicyAcknowledgement | null {
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
  return null;
}

export function parsePolicyAcknowledgements(value: string | null): PolicyAcknowledgement[] {
  if (!value) return [];
  try {
    const candidate: unknown = JSON.parse(value);
    const records = (
      typeof candidate === 'object'
      && candidate !== null
      && 'acknowledgements' in candidate
      && Array.isArray(candidate.acknowledgements)
    ) ? candidate.acknowledgements : [candidate];
    const byVersion = new Map<string, PolicyAcknowledgement>();
    records.forEach((record) => {
      const acknowledgement = parseAcknowledgement(record);
      if (acknowledgement) byVersion.set(acknowledgement.version, acknowledgement);
    });
    return [...byVersion.values()];
  } catch {
    // A malformed local value must never bypass a material notice.
    return [];
  }
}

export function getPolicyAcknowledgements() {
  try {
    return parsePolicyAcknowledgements(window.localStorage.getItem(policyAcknowledgementStorageKey));
  } catch {
    return [];
  }
}

export function saveCurrentPolicyAcknowledgement(): PolicyAcknowledgement[] {
  const acknowledgement = {
    version: currentMaterialPolicyNotice.version,
    acknowledgedAt: new Date().toISOString(),
  };
  const acknowledgements = [
    ...getPolicyAcknowledgements().filter((record) => record.version !== acknowledgement.version),
    acknowledgement,
  ];
  window.localStorage.setItem(policyAcknowledgementStorageKey, JSON.stringify({ acknowledgements }));
  return acknowledgements;
}

export function requiresCurrentPolicyAcknowledgement(acknowledgements: PolicyAcknowledgement[]) {
  return !acknowledgements.some((record) => record.version === currentMaterialPolicyNotice.version);
}