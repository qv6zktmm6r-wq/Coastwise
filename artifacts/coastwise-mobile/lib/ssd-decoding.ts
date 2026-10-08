import type { Detection } from './road-vision';

/**
 * COCO SSD MobileNet v1 (quantized, Apache-2.0). Output class indexes for the
 * road objects Coastwise uses; every other COCO class is ignored.
 */
export const SSD_INPUT_SIZE = 300;
export const ROAD_CLASSES: Record<number, string> = {
  0: 'person',
  1: 'bicycle',
  2: 'car',
  3: 'motorcycle',
  5: 'bus',
  7: 'truck',
  9: 'traffic light',
  12: 'stop sign',
};

export type PixelLayout = 'bgra' | 'rgba' | 'rgb';

/**
 * Nearest-neighbor downsample of an upright packed frame into the model's
 * square RGB input. Runs on the camera thread a few times per second.
 */
export function sampleToRgb(
  source: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  layout: PixelLayout,
  target: Uint8Array,
  size: number,
) {
  'worklet';
  const bytesPerPixel = layout === 'rgb' ? 3 : 4;
  const red = layout === 'bgra' ? 2 : 0;
  const blue = layout === 'bgra' ? 0 : 2;
  let out = 0;
  for (let row = 0; row < size; row++) {
    const sourceRow = Math.min(height - 1, Math.floor((row + 0.5) * height / size)) * bytesPerRow;
    for (let column = 0; column < size; column++) {
      const pixel = sourceRow + Math.min(width - 1, Math.floor((column + 0.5) * width / size)) * bytesPerPixel;
      target[out++] = source[pixel + red];
      target[out++] = source[pixel + 1];
      target[out++] = source[pixel + blue];
    }
  }
}

/** Converts SSD outputs (boxes as ymin, xmin, ymax, xmax) into normalized detections. */
export function decodeSsd(
  boxes: Float32Array,
  classes: Float32Array,
  scores: Float32Array,
  count: number,
  minScore: number,
): Detection[] {
  'worklet';
  const detections: Detection[] = [];
  const total = Math.min(Math.floor(count), scores.length);
  for (let index = 0; index < total; index++) {
    const confidence = scores[index];
    if (confidence < minScore) continue;
    const label = ROAD_CLASSES[Math.round(classes[index])];
    if (!label) continue;
    const top = Math.max(0, boxes[index * 4]);
    const left = Math.max(0, boxes[index * 4 + 1]);
    const bottom = Math.min(1, boxes[index * 4 + 2]);
    const right = Math.min(1, boxes[index * 4 + 3]);
    if (right <= left || bottom <= top) continue;
    detections.push({ label, confidence, x: left, y: top, width: right - left, height: bottom - top });
  }
  return detections;
}
