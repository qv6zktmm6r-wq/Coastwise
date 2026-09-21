import { AppState, isRecord, normalizeDriveSessions } from './state';
import { SyncState } from '@workspace/api-client-react';

export function sanitizeForSync(state: AppState): SyncState {
  const sanitized = {
    profile: { ...state.profile },
    topics: state.topics.map((topic) => ({ ...topic })),
    answers: { ...state.answers },
    practiceProgress: Object.fromEntries(Object.entries(state.practiceProgress).map(([key, answer]) => [key, { ...answer }])),
    scenarios: state.scenarios.map((scenario) => ({ ...scenario, choices: [...scenario.choices] })),
    scenarioAnswers: { ...state.scenarioAnswers },
    missions: state.missions.map((mission) => ({ ...mission })),
    sessions: state.sessions.map(({ review: _localReview, notes: _localNotes, routeTitle: _localRouteTitle, ...sharedDriveSummary }) => ({
      ...sharedDriveSummary,
      skills: sharedDriveSummary.skills ? [...sharedDriveSummary.skills] : undefined,
    })),
    prompts: state.prompts.map((prompt) => ({ ...prompt })),
    settings: { ...state.settings },
  };
  return sanitized as unknown as SyncState;
}

export function mergeStates(localState: AppState, incomingSyncState: SyncState): AppState {
  if (!isRecord(incomingSyncState)) {
    return localState;
  }
  
  const incoming = incomingSyncState as unknown as Partial<AppState>;

  // Merge profile (keep local name if empty on incoming, otherwise use incoming)
  const profile = {
    ...localState.profile,
    ...(incoming.profile || {}),
  };

  // Union merge for arrays with unique identifiers/deduplication
  const localSessions = localState.sessions || [];
  const incomingSessions = normalizeDriveSessions(incoming.sessions);
  
  const sessionMap = new Map<string, typeof localSessions[0]>();
  
  const getSessionKey = (s: typeof localSessions[0]) => s.id;

  for (const s of localSessions) {
    sessionMap.set(getSessionKey(s), s);
  }
  for (const s of incomingSessions) {
    const key = getSessionKey(s);
    // A local review contains private recording metadata and precise route details.
    const existing = sessionMap.get(key);
    sessionMap.set(key, {
      ...s,
      notes: existing?.notes ?? s.notes,
      routeTitle: existing?.routeTitle ?? s.routeTitle,
      review: existing?.review ?? s.review,
    });
  }

  // Missions: if either is completed, it's completed
  const localMissions = localState.missions || [];
  const incomingMissions = incoming.missions || [];
  const missionMap = new Map<string, typeof localMissions[0]>();
  
  for (const m of localMissions) {
    missionMap.set(m.title, m);
  }
  for (const m of incomingMissions) {
    const existing = missionMap.get(m.title);
    if (existing && existing.completed) {
      continue;
    }
    missionMap.set(m.title, m);
  }

  // Topics: use max mastery and questions
  const topicMap = new Map<string, typeof localState.topics[0]>();
  for (const t of localState.topics || []) {
    topicMap.set(t.topic, t);
  }
  for (const t of incoming.topics || []) {
    const existing = topicMap.get(t.topic);
    if (!existing || t.mastery > existing.mastery || (t.mastery === existing.mastery && t.questions > existing.questions)) {
      topicMap.set(t.topic, t);
    }
  }

  return {
    ...localState,
    profile,
    topics: Array.from(topicMap.values()),
    answers: { ...localState.answers, ...incoming.answers },
    practiceProgress: { ...localState.practiceProgress, ...incoming.practiceProgress },
    scenarioAnswers: { ...localState.scenarioAnswers, ...incoming.scenarioAnswers },
    missions: Array.from(missionMap.values()),
    sessions: Array.from(sessionMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    prompts: incoming.prompts || localState.prompts,
    settings: { ...localState.settings, ...incoming.settings },
  };
}
