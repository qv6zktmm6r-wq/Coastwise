import { AppState, isRecord } from './state';
import { SyncState } from '@workspace/api-client-react';

export function sanitizeForSync(state: AppState): SyncState {
  const sanitized: AppState = {
    ...state,
    sessions: state.sessions.map((session) => {
      if (session.review) {
        // Strip videoType to prevent the player from expecting a local blob.
        // It still has events and route which can be reviewed on a map/timeline without video.
        return {
          ...session,
          review: {
            id: session.review.id,
            durationSeconds: session.review.durationSeconds,
            eventCount: session.review.eventCount,
            events: session.review.events,
            route: session.review.route,
            videoType: '',
          },
        };
      }
      return session;
    }),
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
  const incomingSessions = incoming.sessions || [];
  
  const sessionMap = new Map<string, typeof localSessions[0]>();
  
  const getSessionKey = (s: typeof localSessions[0]) => {
    if (s.review) return s.review.id;
    return `${s.date}-${s.minutes}-${s.notes}`;
  };

  for (const s of localSessions) {
    sessionMap.set(getSessionKey(s), s);
  }
  for (const s of incomingSessions) {
    const key = getSessionKey(s);
    // Prefer local if it has a real videoType
    const existing = sessionMap.get(key);
    if (existing?.review?.videoType && s.review && !s.review.videoType) {
      // Keep local which has video
      continue;
    }
    sessionMap.set(key, s);
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
  };
}
