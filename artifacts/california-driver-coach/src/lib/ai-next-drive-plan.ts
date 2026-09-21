import type { NextDrivePlanInput } from '@workspace/api-client-react';
import { getContentPack } from '../data/content-packs';
import { getJurisdictionPracticeProgress, type AppState } from './state';

export function buildNextDrivePlanInput(state: AppState): NextDrivePlanInput {
  const pack = getContentPack(state.profile.jurisdiction);
  const progress = getJurisdictionPracticeProgress(
    state.practiceProgress,
    state.profile.jurisdiction,
    state.profile.contentPackVersion,
  );
  const weakTopics = pack.sections.map((section) => {
    const questions = pack.questions.filter((question) => question.section === section.id);
    const answered = questions.map((question) => progress[question.id]).filter(Boolean);
    const correct = answered.filter((answer) => answer.correct).length;
    return {
      topic: section.title,
      mastery: answered.length ? Math.round((correct / answered.length) * 100) : 0,
    };
  });
  return {
    jurisdiction: state.profile.jurisdiction,
    contentPackVersion: state.profile.contentPackVersion,
    weakTopics: weakTopics
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