import type { NextDrivePlanInput } from '@workspace/api-client-react';
import type { MobileDrive } from './coastwise-context';

export function buildNextDrivePlanInput(drives: MobileDrive[]): NextDrivePlanInput {
  const topics = [
    { topic: 'Right-of-way', mastery: 0 },
    { topic: 'Signs & signals', mastery: 0 },
    { topic: 'Safe speed', mastery: 0 },
  ];
  return {
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