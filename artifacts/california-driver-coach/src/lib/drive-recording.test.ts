import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  browserRecordingFormats,
  canPlayRecording,
  chooseRecordingMimeType,
  describeRecordingFormat,
  getRecordingBrowser,
} from './drive-recording';

describe('cross-browser drive recording formats', () => {
  it('documents the MIME type and codec family selected for each supported browser', () => {
    assert.deepEqual(browserRecordingFormats.chromium, ['video/webm;codecs=vp8', 'video/webm']);
    assert.deepEqual(browserRecordingFormats.firefox, ['video/webm;codecs=vp8', 'video/webm']);
    assert.deepEqual(browserRecordingFormats.webkit, ['video/mp4;codecs=avc1.42E01E', 'video/mp4']);

    assert.equal(chooseRecordingMimeType((mimeType) => mimeType === 'video/webm;codecs=vp8', 'chromium'), 'video/webm;codecs=vp8');
    assert.equal(chooseRecordingMimeType((mimeType) => mimeType === 'video/webm;codecs=vp8', 'firefox'), 'video/webm;codecs=vp8');
    assert.equal(chooseRecordingMimeType((mimeType) => mimeType === 'video/mp4;codecs=avc1.42E01E', 'webkit'), 'video/mp4;codecs=avc1.42E01E');
    assert.equal(getRecordingBrowser('Mozilla/5.0 Chrome/130.0 Safari/537.36'), 'chromium');
    assert.equal(getRecordingBrowser('Mozilla/5.0 Firefox/130.0'), 'firefox');
    assert.equal(getRecordingBrowser('Mozilla/5.0 Version/18.0 Safari/605.1.15'), 'webkit');
  });

  it('uses a browser-default fallback only within the same supported container', () => {
    assert.equal(chooseRecordingMimeType((mimeType) => mimeType === 'video/webm'), 'video/webm');
    assert.equal(chooseRecordingMimeType((mimeType) => mimeType === 'video/mp4'), 'video/mp4');
    assert.equal(chooseRecordingMimeType(() => false), null);
  });

  it('describes and checks playback formats without treating unsupported media as playable', () => {
    assert.equal(describeRecordingFormat('video/webm;codecs=vp8'), 'WebM · VP8');
    assert.equal(describeRecordingFormat('video/mp4;codecs=avc1.42E01E'), 'MP4 · H.264');
    assert.equal(canPlayRecording('video/webm;codecs=vp8', () => 'probably'), true);
    assert.equal(canPlayRecording('video/mp4;codecs=avc1.42E01E', () => ''), false);
  });
});