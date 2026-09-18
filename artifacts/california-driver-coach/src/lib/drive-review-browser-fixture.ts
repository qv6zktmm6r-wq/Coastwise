import type { CoachEvent } from './drive-review';
import type { PlannedRoute } from './route-coach';

type DriveReviewBrowserFixture = {
  reviewId: string;
  recordedVideoUrl: string;
  recordedVideoType: string;
  plannedRoute: PlannedRoute;
  coachEvents: CoachEvent[];
};

const plannedRoute: PlannedRoute = {
  origin: [-121.8947, 37.3394],
  coordinates: [
    [-121.8947, 37.3394],
    [-121.8932, 37.3402],
    [-121.8918, 37.3397],
  ],
  distanceMeters: 820,
  durationSeconds: 180,
  steps: [
    {
      instruction: 'Turn right onto Market Street',
      modifier: 'right',
      name: 'Market Street',
      distance: 210,
      location: [-121.8932, 37.3402],
    },
  ],
};

const coachEvents: CoachEvent[] = [
  {
    id: 'fixture-start',
    timestamp: 0,
    kind: 'start',
    title: 'Drive started',
    detail: 'Coached route recording began.',
    speedMph: 0,
    position: plannedRoute.origin,
    distanceToNext: 210,
    stepIndex: 0,
  },
  {
    id: 'fixture-turn',
    timestamp: 12,
    kind: 'maneuver',
    title: 'Turn right onto Market Street',
    detail: 'Slow before the turn and scan the crosswalk.',
    speedMph: 18,
    position: plannedRoute.steps[0].location,
    distanceToNext: 0,
    stepIndex: 0,
  },
  {
    id: 'fixture-safety',
    timestamp: 24,
    kind: 'safety',
    title: 'Following distance reminder',
    detail: 'Leave enough space to stop smoothly.',
    speedMph: 22,
    position: plannedRoute.coordinates[2],
    distanceToNext: null,
    stepIndex: null,
  },
];

export function getDriveReviewBrowserFixture(): DriveReviewBrowserFixture | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('reviewFixture') !== '1') return null;
  const format = params.get('reviewFormat') ?? 'webm';

  if (format === 'unsupported') {
    return {
      reviewId: 'fixture-review',
      recordedVideoUrl: `${import.meta.env.BASE_URL}drive-review-fixture.webm`,
      recordedVideoType: 'video/quicktime',
      plannedRoute,
      coachEvents,
    };
  }

  return {
    reviewId: 'fixture-review',
    recordedVideoUrl: `${import.meta.env.BASE_URL}${format === 'mp4' ? 'drive-review-fixture.mp4' : 'drive-review-fixture.webm'}`,
    recordedVideoType: format === 'mp4' ? 'video/mp4;codecs=avc1.42E01E' : 'video/webm;codecs=vp8',
    plannedRoute,
    coachEvents,
  };
}