import { californiaContentPack } from './question-bank';
import { texasContentPack, texasScenarios } from './texas-pack';
import { floridaContentPack, floridaScenarios } from './florida-pack';
import type { JurisdictionCode } from '../lib/jurisdiction';
import type { Scenario } from '../lib/state';

export type ContentScenario = Scenario & { id: string; sourceUrl: string };

const californiaScenarios: ContentScenario[] = [
  {
    id: 'ca-scenario-001',
    situation: 'You are turning left at a green light. A pedestrian has stepped into the crosswalk, and the car behind you is close.',
    choices: ['Turn before the pedestrian reaches your lane', 'Stop behind the limit line and let the pedestrian cross', 'Honk so the pedestrian knows you are waiting'],
    bestChoice: 1,
    coaching: 'A patient pause is the safest move. People in a crosswalk have the right-of-way, even when traffic is waiting behind you.',
    sourceUrl: californiaContentPack.sourceUrl,
  },
  {
    id: 'ca-scenario-002',
    situation: 'Rain starts on a familiar road. The posted limit is 45 mph and your visibility is getting worse.',
    choices: ['Keep 45 mph because it is the legal limit', 'Slow down enough to see and stop comfortably', 'Turn on hazard lights and continue at 45 mph'],
    bestChoice: 1,
    coaching: 'The speed limit is not a target in every condition. Choose a speed that lets you see, react, and keep a generous following distance.',
    sourceUrl: californiaContentPack.sourceUrl,
  },
  {
    id: 'ca-scenario-003',
    situation: 'You are approaching a four-way stop at the same time as another driver on your right.',
    choices: ['Go first because you are already rolling', 'Wave them through, then go when clear', 'Yield to the driver on your right'],
    bestChoice: 2,
    coaching: 'At an all-way stop, the driver who arrived first goes first. If arrival is at the same time, yield to the driver on your right.',
    sourceUrl: californiaContentPack.sourceUrl,
  },
];

export const contentPacks = {
  'US-CA': californiaContentPack,
  'US-TX': texasContentPack,
  'US-FL': floridaContentPack,
} as const;

export const contentScenarios: Record<JurisdictionCode, ContentScenario[]> = {
  'US-CA': californiaScenarios,
  'US-TX': texasScenarios.map((scenario) => ({
    id: scenario.id,
    situation: scenario.prompt,
    choices: [...scenario.options],
    bestChoice: scenario.answer,
    coaching: scenario.explanation,
    sourceUrl: scenario.sourceUrl,
  })),
  'US-FL': floridaScenarios.map((scenario) => ({
    id: scenario.id,
    situation: scenario.prompt,
    choices: [...scenario.options],
    bestChoice: scenario.answer,
    coaching: scenario.explanation,
    sourceUrl: scenario.sourceUrl,
  })),
};

export function getContentPack(jurisdiction: JurisdictionCode) {
  return contentPacks[jurisdiction];
}

export function getContentScenarios(jurisdiction: JurisdictionCode) {
  return contentScenarios[jurisdiction];
}