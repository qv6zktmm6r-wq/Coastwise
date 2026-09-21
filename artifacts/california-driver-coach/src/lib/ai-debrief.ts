import type { DriveDebriefInput } from '@workspace/api-client-react';
import type { CoachEvent } from './drive-review';
import type { DriveSession, Topic } from './state';
import type { JurisdictionCode } from './jurisdiction';

export function buildDriveDebriefInput({
  session,
  elapsedSeconds,
  distanceMiles,
  plannedSkills,
  events,
  topics,
  jurisdiction,
  contentPackVersion,
}: {
  session?: DriveSession;
  elapsedSeconds: number;
  distanceMiles: number;
  plannedSkills: string[];
  events: CoachEvent[];
  topics: Topic[];
  jurisdiction: JurisdictionCode;
  contentPackVersion: string;
}): DriveDebriefInput {
  return {
    jurisdiction,
    contentPackVersion,
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