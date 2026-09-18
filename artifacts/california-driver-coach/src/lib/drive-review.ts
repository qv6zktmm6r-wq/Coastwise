import type { RouteCoordinate } from './route-coach';

export type CoachEventKind = 'start' | 'prompt' | 'maneuver' | 'safety';

export type CoachEvent = {
  id: string;
  timestamp: number;
  kind: CoachEventKind;
  title: string;
  detail: string;
  speedMph: number | null;
  position: RouteCoordinate | null;
  distanceToNext: number | null;
  stepIndex: number | null;
};

export type DriveReviewState = {
  recordedVideoUrl: string;
  coachEvents: CoachEvent[];
  selectedEventId: string | null;
};

export function appendCoachEvent(events: CoachEvent[], event: CoachEvent) {
  const isDuplicateManeuver = event.kind === 'maneuver'
    && event.stepIndex !== null
    && events.some((existing) => existing.kind === 'maneuver' && existing.stepIndex === event.stepIndex);

  if (isDuplicateManeuver) return events;

  const previousTimestamp = events.at(-1)?.timestamp ?? 0;
  return [...events, { ...event, timestamp: Math.max(previousTimestamp, event.timestamp) }];
}

export function eventAtPlaybackTime(events: CoachEvent[], currentTime: number, tolerance = 0.25) {
  return events.reduce<CoachEvent | null>(
    (latest, event) => event.timestamp <= currentTime + tolerance ? event : latest,
    null,
  );
}

export function seekReviewVideo(video: Pick<HTMLVideoElement, 'currentTime'>, event: CoachEvent) {
  video.currentTime = event.timestamp;
}

export function deleteCoachEvent(state: DriveReviewState, eventId: string): DriveReviewState {
  const deletedIndex = state.coachEvents.findIndex((event) => event.id === eventId);
  const coachEvents = state.coachEvents.filter((event) => event.id !== eventId);
  const selectedEventId = state.selectedEventId === eventId
    ? coachEvents[Math.min(Math.max(deletedIndex, 0), coachEvents.length - 1)]?.id ?? null
    : state.selectedEventId;

  return { ...state, coachEvents, selectedEventId };
}

export function deleteDriveRecording(): DriveReviewState {
  return { recordedVideoUrl: '', coachEvents: [] as CoachEvent[], selectedEventId: null };
}