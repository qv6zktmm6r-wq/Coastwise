import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendCoachEvent,
  deleteCoachEvent,
  deleteDriveRecording,
  eventAtPlaybackTime,
  seekReviewVideo,
  type CoachEvent,
} from './drive-review';

function event(id: string, timestamp: number, kind: CoachEvent['kind'] = 'prompt', stepIndex: number | null = null): CoachEvent {
  return {
    id,
    timestamp,
    kind,
    stepIndex,
    title: id,
    detail: id,
    speedMph: null,
    position: null,
    distanceToNext: null,
  };
}

describe('coach event recording', () => {
  it('keeps timestamps ordered when callbacks report an earlier rounded time', () => {
    const events = appendCoachEvent([event('first', 4.2)], event('second', 4.1));

    assert.deepEqual(events.map(({ timestamp }) => timestamp), [4.2, 4.2]);
  });

  it('does not add a duplicate maneuver event for the same GPS step', () => {
    const original = [event('turn-1', 5, 'maneuver', 2)];
    const events = appendCoachEvent(original, event('turn-1-again', 5.1, 'maneuver', 2));

    assert.equal(events, original);
    assert.equal(events.length, 1);
  });
});

describe('review playback synchronization', () => {
  const events = [event('start', 0, 'start'), event('turn', 8, 'maneuver', 0), event('scan', 14, 'safety')];

  it('seeks the review video when an event is selected', () => {
    const video = { currentTime: 0 };

    seekReviewVideo(video, events[1]);

    assert.equal(video.currentTime, 8);
  });

  it('selects the latest event reached during playback', () => {
    assert.equal(eventAtPlaybackTime(events, 8.1)?.id, 'turn');
    assert.equal(eventAtPlaybackTime(events, 13)?.id, 'turn');
    assert.equal(eventAtPlaybackTime(events, 13.8)?.id, 'scan');
  });
});

describe('review deletion', () => {
  it('deletes an annotation without changing the recording', () => {
    const review = deleteCoachEvent({
      recordedVideoUrl: 'blob:drive-recording',
      coachEvents: [event('keep', 1), event('delete', 2)],
      selectedEventId: 'delete',
    }, 'delete');

    assert.equal(review.recordedVideoUrl, 'blob:drive-recording');
    assert.deepEqual(review.coachEvents.map(({ id }) => id), ['keep']);
    assert.equal(review.selectedEventId, 'keep');
  });

  it('clears annotations when the recording is deleted', () => {
    assert.deepEqual(deleteDriveRecording(), {
      recordedVideoUrl: '',
      coachEvents: [],
      selectedEventId: null,
    });
  });
});