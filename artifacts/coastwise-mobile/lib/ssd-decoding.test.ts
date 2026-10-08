import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSsd, sampleToRgb } from './ssd-decoding.ts';

test('SSD outputs become normalized road detections; other classes and weak scores are dropped', () => {
  const boxes = new Float32Array([
    0.2, 0.6, 0.4, 0.7, // stop sign
    0.5, 0.4, 0.8, 0.6, // car
    0.1, 0.1, 0.2, 0.2, // class 57 (not a road object)
    0.0, 0.0, 0.5, 0.5, // weak person
  ]);
  const classes = new Float32Array([12, 2, 57, 0]);
  const scores = new Float32Array([0.9, 0.7, 0.95, 0.3]);
  const detections = decodeSsd(boxes, classes, scores, 4, 0.5);
  assert.equal(detections.length, 2);
  assert.equal(detections[0].label, 'stop sign');
  assert.ok(Math.abs(detections[0].x - 0.6) < 1e-6);
  assert.ok(Math.abs(detections[0].width - 0.1) < 1e-6);
  assert.ok(Math.abs(detections[0].height - 0.2) < 1e-6);
  assert.equal(detections[1].label, 'car');
});

test('degenerate boxes and counts beyond the arrays are ignored', () => {
  const detections = decodeSsd(
    new Float32Array([0.5, 0.5, 0.5, 0.6]),
    new Float32Array([2]),
    new Float32Array([0.9]),
    10,
    0.5,
  );
  assert.deepEqual(detections, []);
});

test('BGRA frames are sampled into RGB with row padding respected', () => {
  // 2x2 frame, 12 bytes per row (4 bytes padding): blue, green / red, white.
  const source = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 9, 9, 9, 9,
    0, 0, 255, 255, 255, 255, 255, 255, 9, 9, 9, 9,
  ]);
  const target = new Uint8Array(2 * 2 * 3);
  sampleToRgb(source, 2, 2, 12, 'bgra', target, 2);
  assert.deepEqual([...target], [0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255]);
});

test('downsampling picks evenly spaced pixels', () => {
  const width = 4;
  const source = new Uint8Array(width * 4 * 3);
  for (let pixel = 0; pixel < width * 4; pixel++) source.set([pixel, pixel, pixel], pixel * 3);
  const target = new Uint8Array(2 * 2 * 3);
  sampleToRgb(source, width, 4, width * 3, 'rgb', target, 2);
  assert.deepEqual([target[0], target[3], target[6], target[9]], [5, 7, 13, 15]);
});
