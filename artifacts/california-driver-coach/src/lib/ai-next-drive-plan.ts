import type { NextDrivePlanInput } from '@workspace/api-client-react';
import type { AppState } from './state';

export function buildNextDrivePlanInput(state: AppState): NextDrivePlanInput {
  return {
    weakTopics: [...state.topics]
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
      .map(({ topic, mastery }) => ({ topic, mastery })),
    unfinishedMissions: state.missions
      .filter(({ completed }) => !completed)
      .slice(0, 3)
      .map(({ title, category, minutes }) => ({ title, category, minutes })),
    recentDrives: [...state.sessions]
      .slice(-3)
      .reverse()
      .map(({ minutes, night, skills, review }) => ({
        durationMinutes: minutes,
        night,
        skills: skills ?? [],
        debriefImprovement: review?.aiDebrief?.improvement ?? null,
        debriefNextStep: review?.aiDebrief?.nextStep ?? null,
      })),
  };
}