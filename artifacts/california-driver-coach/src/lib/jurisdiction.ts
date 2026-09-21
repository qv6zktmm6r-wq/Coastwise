export type JurisdictionCode = 'US-CA' | 'US-TX' | 'US-FL' | 'US-NY' | 'US-OH' | 'US-IL';

export type Jurisdiction = {
  code: JurisdictionCode;
  name: string;
  shortName: string;
  agencyName: string;
  handbookName: string;
  handbookUrl: string;
  supervisedHours: number;
  nightHours: number;
  permitHoldLabel: string;
  educationLabel: string;
  essentials: string[];
  sourceMatrixReview: {
    status: 'approved' | 'pending';
    reviewedAt: string;
    recordPath: string;
  };
};

export const CALIFORNIA_CONTENT_PACK_VERSION = 'us-ca-2026.09.1';
export const TEXAS_CONTENT_PACK_VERSION = 'us-tx-2026.09.1';
export const FLORIDA_CONTENT_PACK_VERSION = 'us-fl-2026.09.1';
export const NEW_YORK_CONTENT_PACK_VERSION = 'us-ny-2026.09.1';
export const OHIO_CONTENT_PACK_VERSION = 'us-oh-2026.09.1';
export const ILLINOIS_CONTENT_PACK_VERSION = 'us-il-2026.09.1';

export const jurisdictions: Record<JurisdictionCode, Jurisdiction> = {
  'US-CA': {
    code: 'US-CA',
    name: 'California',
    shortName: 'CA',
    agencyName: 'California Department of Motor Vehicles',
    handbookName: 'California Driver’s Handbook',
    handbookUrl: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/',
    supervisedHours: 50,
    nightHours: 10,
    permitHoldLabel: '6 month hold',
    educationLabel: '6 professional instruction hours separate',
    essentials: ['Permit held at least 6 months before the drive test.', '50 supervised practice hours, including 10 at night.', '6 hours of professional driver instruction.'],
    sourceMatrixReview: { status: 'approved', reviewedAt: '2026-09-20', recordPath: 'California Driver’s Handbook source record' },
  },
  'US-TX': {
    code: 'US-TX',
    name: 'Texas',
    shortName: 'TX',
    agencyName: 'Texas Department of Public Safety',
    handbookName: 'Texas Driver Handbook',
    handbookUrl: 'https://www.dps.texas.gov/internetforms/forms/dl-7.pdf',
    supervisedHours: 30,
    nightHours: 10,
    permitHoldLabel: '6 month hold',
    educationLabel: '14 in-car driver education hours separate',
    essentials: ['Learner license generally held at least 6 months.', '30 supervised practice hours, including 10 at night.', 'Texas driver education and ITTD requirements apply before testing.'],
    sourceMatrixReview: { status: 'approved', reviewedAt: '2026-09-21', recordPath: 'docs/content-packs/texas-source-matrix.md' },
  },
  'US-FL': {
    code: 'US-FL',
    name: 'Florida',
    shortName: 'FL',
    agencyName: 'Florida Highway Safety and Motor Vehicles',
    handbookName: 'Florida Class E Driver License Handbook',
    handbookUrl: 'https://www.flhsmv.gov/pdf/handbooks/englishdriverhandbook.pdf',
    supervisedHours: 50,
    nightHours: 10,
    permitHoldLabel: '12 month hold',
    educationLabel: 'TLSAE course required for first-time drivers',
    essentials: ['Learner license generally held for 12 months or until age 18.', '50 supervised practice hours, including 10 at night.', 'TLSAE and Class E testing requirements apply.'],
    sourceMatrixReview: { status: 'approved', reviewedAt: '2026-09-21', recordPath: 'docs/content-packs/florida-source-matrix.md' },
  },
  'US-NY': {
    code: 'US-NY', name: 'New York', shortName: 'NY', agencyName: 'New York State Department of Motor Vehicles',
    handbookName: 'New York State Driver’s Manual', handbookUrl: 'https://dmv.ny.gov/new-york-state-drivers-manual-practice-tests',
    supervisedHours: 50, nightHours: 15, permitHoldLabel: '6 month hold',
    educationLabel: 'pre-licensing education requirements apply',
    essentials: ['50 supervised hours including 15 after sunset.', 'Junior-driver restrictions vary by region.', 'Complete required education before the road test.'],
    sourceMatrixReview: { status: 'pending', reviewedAt: '2026-09-21', recordPath: 'docs/content-packs/new-york-source-matrix.md' },
  },
  'US-OH': {
    code: 'US-OH', name: 'Ohio', shortName: 'OH', agencyName: 'Ohio Bureau of Motor Vehicles',
    handbookName: 'Ohio Driver Manual (BMV forms index)', handbookUrl: 'https://www.bmv.ohio.gov/forms-general.aspx',
    supervisedHours: 50, nightHours: 10, permitHoldLabel: '12 month probationary restrictions',
    educationLabel: 'driver education and testing requirements apply',
    essentials: ['50 supervised hours including 10 at night.', 'Probationary restrictions apply during the first year.', 'Complete knowledge, vision, maneuverability, and road tests.'],
    sourceMatrixReview: { status: 'pending', reviewedAt: '2026-09-21', recordPath: 'docs/content-packs/ohio-source-matrix.md' },
  },
  'US-IL': {
    code: 'US-IL', name: 'Illinois', shortName: 'IL', agencyName: 'Illinois Secretary of State',
    handbookName: 'Illinois Rules of the Road', handbookUrl: 'https://www.ilsos.gov/publications/pdf_publications/dsd_a112.pdf',
    supervisedHours: 50, nightHours: 10, permitHoldLabel: '9 month permit phase',
    educationLabel: 'graduated driver licensing requirements apply',
    essentials: ['50 supervised hours including 10 at night.', 'Under-18 permit phase generally lasts at least 9 months.', 'Nighttime and passenger restrictions apply to initial licensing.'],
    sourceMatrixReview: { status: 'pending', reviewedAt: '2026-09-21', recordPath: 'docs/content-packs/illinois-source-matrix.md' },
  },
};

export const supportedJurisdictions = Object.values(jurisdictions)
  .filter((jurisdiction) => jurisdiction.sourceMatrixReview.status === 'approved');

export function isSupportedJurisdictionCode(value: unknown): value is JurisdictionCode {
  return supportedJurisdictions.some((jurisdiction) => jurisdiction.code === value);
}
export function isApprovedContentPackPair(code: unknown, version: unknown): code is JurisdictionCode {
  return isSupportedJurisdictionCode(code) && version === getCurrentContentPackVersion(code);
}
export const defaultJurisdiction: JurisdictionCode = 'US-CA';

export function isJurisdictionCode(value: unknown): value is JurisdictionCode {
  return value === 'US-CA' || value === 'US-TX' || value === 'US-FL' || value === 'US-NY' || value === 'US-OH' || value === 'US-IL';
}

export function getJurisdiction(code: JurisdictionCode) {
  return jurisdictions[code];
}

export function getCurrentContentPackVersion(code: JurisdictionCode) {
  if (code === 'US-CA') return CALIFORNIA_CONTENT_PACK_VERSION;
  if (code === 'US-TX') return TEXAS_CONTENT_PACK_VERSION;
  if (code === 'US-FL') return FLORIDA_CONTENT_PACK_VERSION;
  if (code === 'US-NY') return NEW_YORK_CONTENT_PACK_VERSION;
  if (code === 'US-OH') return OHIO_CONTENT_PACK_VERSION;
  return ILLINOIS_CONTENT_PACK_VERSION;
}