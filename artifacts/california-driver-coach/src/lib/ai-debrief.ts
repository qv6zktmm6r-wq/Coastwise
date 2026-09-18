import type { DriveDebriefInput } from '@workspace/api-client-react';
import type { CoachEvent } from './drive-review';
import type { DriveSession, Topic } from './state';

export function buildDriveDebriefInput({
  session,
  elapsedSeconds,
  distanceMiles,
  plannedSkills,
  events,
  topics,
}: {
  session?: DriveSession;
  elapsedSeconds: number;
  distanceMiles: number;
  plannedSkills: string[];
  events: CoachEvent[];
  topics: Topic[];
}): DriveDebriefInput {
  return {
    durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
    distanceMiles: session?.distanceMiles ?? distanceMiles,
    night: session?.night ?? false,
    skills: session?.skills ?? plannedSkills,
    events: events.map(({ kind, title, detail }) => ({ kind, title, detail })),
    weakTopics: [...topics]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
      .map(({ topic, mastery }) => ({ topic, mastery })),
  };
}