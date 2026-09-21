export type JurisdictionCode = 'US-CA';

export type Jurisdiction = {
  code: JurisdictionCode;
  name: string;
  shortName: string;
  agencyName: string;
  handbookName: string;
  handbookUrl: string;
};

export const CALIFORNIA_CONTENT_PACK_VERSION = 'us-ca-2026.09.1';

export const jurisdictions: Record<JurisdictionCode, Jurisdiction> = {
  'US-CA': {
    code: 'US-CA',
    name: 'California',
    shortName: 'CA',
    agencyName: 'California Department of Motor Vehicles',
    handbookName: 'California Driver’s Handbook',
    handbookUrl: 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/',
  },
};

export const supportedJurisdictions = Object.values(jurisdictions);
export const defaultJurisdiction: JurisdictionCode = 'US-CA';

export function isJurisdictionCode(value: unknown): value is JurisdictionCode {
  return value === 'US-CA';
}

export function getJurisdiction(code: JurisdictionCode) {
  return jurisdictions[code];
}

export function getCurrentContentPackVersion(code: JurisdictionCode) {
  if (code === 'US-CA') return CALIFORNIA_CONTENT_PACK_VERSION;
  return CALIFORNIA_CONTENT_PACK_VERSION;
}