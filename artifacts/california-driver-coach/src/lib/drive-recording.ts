export type SupportedRecordingBrowser = 'chromium' | 'firefox' | 'webkit';

export type RecordingFormat = {
  mimeType: string;
  label: string;
  codec: string;
  browsers: SupportedRecordingBrowser[];
};

/**
 * These are the formats Coastwise is willing to create and review.
 *
 * WebM/VP8 is the shared format for Chromium and Firefox. Safari's
 * MediaRecorder implementation uses MP4/H.264 instead. Both formats are
 * playable by Chromium, Firefox (WebM), and Safari (MP4) within the browser
 * families documented below; the app does not silently fall back to an
 * undocumented container.
 */
export const recordingFormats: RecordingFormat[] = [
  {
    mimeType: 'video/webm;codecs=vp8',
    label: 'WebM',
    codec: 'VP8',
    browsers: ['chromium', 'firefox'],
  },
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E',
    label: 'MP4',
    codec: 'H.264',
    browsers: ['webkit'],
  },
  {
    mimeType: 'video/webm',
    label: 'WebM',
    codec: 'browser default',
    browsers: ['chromium', 'firefox'],
  },
  {
    mimeType: 'video/mp4',
    label: 'MP4',
    codec: 'browser default',
    browsers: ['webkit'],
  },
];

export const browserRecordingFormats: Record<SupportedRecordingBrowser, string[]> = {
  chromium: ['video/webm;codecs=vp8', 'video/webm'],
  firefox: ['video/webm;codecs=vp8', 'video/webm'],
  webkit: ['video/mp4;codecs=avc1.42E01E', 'video/mp4'],
};

export function getRecordingBrowser(userAgent: string): SupportedRecordingBrowser {
  if (/Firefox/i.test(userAgent)) return 'firefox';
  if (/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Android/i.test(userAgent)) return 'webkit';
  return 'chromium';
}

export function chooseRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
  browser?: SupportedRecordingBrowser,
): string | null {
  const candidates = browser
    ? browserRecordingFormats[browser]
    : recordingFormats.map(({ mimeType }) => mimeType);
  return candidates.find((mimeType) => isTypeSupported(mimeType)) ?? null;
}

export function describeRecordingFormat(mimeType: string) {
  const format = recordingFormats.find(({ mimeType: supportedType }) => mimeType === supportedType)
    ?? recordingFormats.find(({ mimeType: supportedType }) => mimeType.startsWith(supportedType.split(';')[0]));

  if (format) return `${format.label} · ${format.codec}`;
  return mimeType || 'Unknown recording format';
}

export function canPlayRecording(
  mimeType: string,
  canPlayType: (mimeType: string) => string,
) {
  return canPlayType(mimeType) !== '';
}