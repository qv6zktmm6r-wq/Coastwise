import type { NextDrivePlanInput } from '@workspace/api-client-react';
import type { MobileDrive, MobileJurisdiction } from './coastwise-context';
import { getMobileWeakTopics } from './practice-content';

export function buildNextDrivePlanInput(
  drives: MobileDrive[],
  jurisdiction: MobileJurisdiction,
  contentPackVersion: string,
  practiceProgress: Record<string, { correct: boolean; topic: string }>,
): NextDrivePlanInput {
  const topics = getMobileWeakTopics(jurisdiction, contentPackVersion, practiceProgress);
  return {
    jurisdiction,
    contentPackVersion,
    weakTopics: topics,
    unfinishedMissions: [
      { title: 'Calm intersections', category: 'Judgment', minutes: 20 },
      { title: 'Smooth starts and stops', category: 'Control', minutes: 25 },
    ],
    recentDrives: drives.slice(0, 3).map((drive) => ({
      durationMinutes: drive.durationMinutes,
      night: drive.night,
      skills: drive.skills,
      debriefImprovement: drive.debrief?.improvement ?? null,
      debriefNextStep: drive.debrief?.nextStep ?? null,
    })),
  };
}