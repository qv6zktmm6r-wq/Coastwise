import { memo, useEffect, useMemo, useRef } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { NitroModules } from 'react-native-nitro-modules';
import {
  CommonResolutions,
  NativePreviewView,
  useFrameOutput,
  useObjectOutput,
  useOrientation,
  usePreviewOutput,
  VisionCamera,
  type CameraDevice,
  type CameraSession,
  type CameraSessionConnection,
  type ScannedFace,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import type { Detection } from '@/lib/road-vision';
import { decodeSsd, sampleToRgb, SSD_INPUT_SIZE, type PixelLayout } from '@/lib/ssd-decoding';

export type CoachCameraStatus =
  | 'starting'
  | 'running'
  | 'road-only'
  | 'model-unavailable'
  | 'camera-unavailable';

export type CoachCamerasProps = {
  road: boolean;
  driver: boolean;
  onDetections: (detections: Detection[]) => void;
  /** Yaw in degrees for the largest face, or null when the face has no yaw. */
  onFace: (yawDegrees: number | null) => void;
  onStatus: (status: CoachCameraStatus) => void;
  previewStyle?: StyleProp<ViewStyle>;
};

const FACE_TYPES: ScannedObjectType[] = ['face'];
const DETECTION_INTERVAL_MS = 330;
const MIN_DETECTION_SCORE = 0.5;
const MODEL = require('../assets/models/coco-ssd-mobilenet-v1-quant.tflite');

function isFace(object: ScannedObject): object is ScannedFace {
  return object.type === 'face';
}

/**
 * On-device road (back) and driver (front) cameras. Frames are analyzed in
 * memory and dropped; nothing from these cameras is saved or sent.
 */
/** Memoized: the drive screen re-renders on every GPS fix, and the camera must not. */
export const CoachCameras = memo(function CoachCameras({ road, driver, onDetections, onFace, onStatus, previewStyle }: CoachCamerasProps) {
  const callbacks = useRef({ onDetections, onFace, onStatus });
  callbacks.current = { onDetections, onFace, onStatus };

  const detector = useTensorflowModel(MODEL, []);
  const boxedModel = useMemo(
    () => (detector.state === 'loaded' ? NitroModules.box(detector.model) : undefined),
    [detector],
  );
  useEffect(() => {
    if (road && detector.state === 'error') callbacks.current.onStatus('model-unavailable');
  }, [road, detector.state]);

  const deliverDetections = useMemo(() => (detections: Detection[]) => callbacks.current.onDetections(detections), []);

  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_16_9,
    pixelFormat: 'rgb',
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      const memory = globalThis as unknown as { __coastwiseLastDetection?: number; __coastwiseInput?: Uint8Array };
      const now = Date.now();
      if (!boxedModel || now - (memory.__coastwiseLastDetection ?? 0) < DETECTION_INTERVAL_MS) {
        frame.dispose();
        return;
      }
      memory.__coastwiseLastDetection = now;
      try {
        const format = frame.pixelFormat;
        const layout: PixelLayout | null = format === 'rgb-bgra-8-bit' ? 'bgra' : format === 'rgb-rgba-8-bit' ? 'rgba' : format === 'rgb-rgb-8-bit' ? 'rgb' : null;
        if (layout && frame.hasPixelBuffer) {
          const input = memory.__coastwiseInput ?? new Uint8Array(SSD_INPUT_SIZE * SSD_INPUT_SIZE * 3);
          memory.__coastwiseInput = input;
          sampleToRgb(new Uint8Array(frame.getPixelBuffer()), frame.width, frame.height, frame.bytesPerRow, layout, input, SSD_INPUT_SIZE);
          const outputs = boxedModel.unbox().runSync([input.buffer as ArrayBuffer]);
          const detections = decodeSsd(
            new Float32Array(outputs[0]),
            new Float32Array(outputs[1]),
            new Float32Array(outputs[2]),
            new Float32Array(outputs[3])[0] ?? 0,
            MIN_DETECTION_SCORE,
          );
          scheduleOnRN(deliverDetections, detections);
        }
      } finally {
        frame.dispose();
      }
    },
    onFrameDropped() {},
  });

  const faceOutput = useObjectOutput({
    types: FACE_TYPES,
    onObjectsScanned(objects) {
      const faces = objects.filter(isFace);
      if (faces.length === 0) return;
      const largest = faces.reduce((best, face) =>
        face.boundingBox.width * face.boundingBox.height > best.boundingBox.width * best.boundingBox.height ? face : best);
      callbacks.current.onFace(largest.hasYawAngle ? largest.yawAngle : null);
    },
  });

  const previewOutput = usePreviewOutput();
  const orientation = useOrientation('device');
  useEffect(() => {
    if (!orientation) return;
    frameOutput.outputOrientation = orientation;
    previewOutput.outputOrientation = orientation;
  }, [orientation, frameOutput, previewOutput]);

  useEffect(() => {
    if (!road && !driver) return;
    let cancelled = false;
    let session: CameraSession | null = null;
    callbacks.current.onStatus('starting');
    void (async () => {
      try {
        const factory = await VisionCamera.createDeviceFactory();
        let back: CameraDevice | undefined = road ? factory.getDefaultCamera('back') : undefined;
        let front: CameraDevice | undefined = driver ? factory.getDefaultCamera('front') : undefined;
        let droppedDriver = false;
        if (back && front) {
          const pair = VisionCamera.supportsMultiCamSessions
            ? factory.supportedMultiCamDeviceCombinations.find((devices) =>
              devices.some((device) => device.position === 'back') && devices.some((device) => device.position === 'front'))
            : undefined;
          if (pair) {
            back = pair.find((device) => device.position === 'back');
            front = pair.find((device) => device.position === 'front');
          } else {
            front = undefined;
            droppedDriver = true;
          }
        }
        if (!back && !front) throw new Error('No camera available');
        const connections: CameraSessionConnection[] = [];
        if (back) {
          connections.push({
            input: back,
            outputs: [
              { output: previewOutput, mirrorMode: 'off' },
              { output: frameOutput, mirrorMode: 'off' },
            ],
            constraints: [{ fps: 15 }],
          });
        }
        if (front) {
          connections.push({ input: front, outputs: [{ output: faceOutput, mirrorMode: 'auto' }], constraints: [] });
        }
        const created = await VisionCamera.createCameraSession(Boolean(back && front));
        if (cancelled) return;
        session = created;
        await created.configure(connections, { allowBackgroundAudioPlayback: true });
        if (cancelled) return;
        await created.start();
        if (!cancelled) callbacks.current.onStatus(droppedDriver ? 'road-only' : 'running');
      } catch {
        if (!cancelled) callbacks.current.onStatus('camera-unavailable');
      }
    })();
    return () => {
      cancelled = true;
      void session?.stop().catch(() => undefined);
    };
  }, [road, driver, frameOutput, faceOutput, previewOutput]);

  if (!road) return null;
  return (
    <NativePreviewView
      previewOutput={previewOutput}
      resizeMode="cover"
      style={previewStyle}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
});
