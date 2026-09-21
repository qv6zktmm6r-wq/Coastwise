import type { HandbookContentPack, HandbookQuestion, HandbookSection } from './question-bank';

const NY = 'US-NY' as HandbookQuestion['jurisdiction'];
const VERSION = 'us-ny-2026.09.1';
const REVIEWED = '2026-09-21';
const handbookUrl = 'https://dmv.ny.gov/new-york-state-drivers-manual-practice-tests';
const handbook: Source = {
  title: 'New York State Driver’s Manual (MV-21)',
  url: handbookUrl,
  revision: 'Official DMV manual landing page; revision/current PDF should be confirmed before publication',
  effectiveDate: 'Official page checked 2026-09-21',
};
type Source = { title: string; url: string; revision: string; effectiveDate: string };
const teen: Source = {
  title: 'New York DMV: Graduated license law and restrictions',
  url: 'https://dmv.ny.gov/younger-driver/graduated-license-law-and-restrictions-drivers-under-18',
  revision: 'Official DMV page; no revision date displayed',
  effectiveDate: 'Official page checked 2026-09-21',
};
const permit: Source = {
  title: 'New York DMV: Get a learner permit',
  url: 'https://dmv.ny.gov/driver-license/get-learner-permit',
  revision: 'Official DMV page; no revision date displayed',
  effectiveDate: 'Official page checked 2026-09-21',
};
const roadTest: Source = {
  title: 'New York DMV: Schedule and take a road test',
  url: 'https://dmv.ny.gov/driver-license/complete-pre-licensing-requirements',
  revision: 'Official DMV page; no revision date displayed',
  effectiveDate: 'Official page checked 2026-09-21',
};
const documents: Source = {
  title: 'New York DMV: Proofs of identity and date of birth',
  url: 'https://dmv.ny.gov/driver-license/prepare-for-and-take-your-permit-test',
  revision: 'Official DMV page; no revision date displayed',
  effectiveDate: 'Official page checked 2026-09-21',
};
const gdl: Source = {
  title: 'New York Vehicle and Traffic Law §501',
  url: 'https://www.nysenate.gov/legislation/laws/VAT/501',
  revision: 'Current New York Senate statute page; amendments must be rechecked',
  effectiveDate: 'Statute page checked 2026-09-21',
};

const sections: HandbookSection[] = [
  { id: 'licensing', title: 'Licensing & permits', description: 'New York learner permits, junior licenses, supervision, and graduated licensing.' },
  { id: 'testing', title: 'Testing process', description: 'New York knowledge, pre-licensing, and road tests.' },
  { id: 'fundamentals', title: 'Driving fundamentals', description: 'Control, observation, communication, and defensive driving.' },
  { id: 'signs', title: 'Signs, signals & markings', description: 'New York traffic controls and pavement markings.' },
  { id: 'right-of-way', title: 'Right-of-way', description: 'Intersections, pedestrians, and yielding.' },
  { id: 'lane-control', title: 'Turns, lanes & passing', description: 'Turns, lane changes, and passing.' },
  { id: 'speed-space', title: 'Speed, space & conditions', description: 'Safe speed, following distance, weather, and visibility.' },
  { id: 'sharing-road', title: 'Sharing the road', description: 'School buses, emergency vehicles, and vulnerable road users.' },
  { id: 'parking', title: 'Parking & backing', description: 'Stopping, parking, and backing safely.' },
  { id: 'freeway', title: 'Freeways & emergencies', description: 'Expressways, breakdowns, and emergency decisions.' },
  { id: 'safe-driving', title: 'Safe driving choices', description: 'Distraction, impairment, fatigue, and restraints.' },
  { id: 'vehicle-responsibility', title: 'Vehicle & driver responsibility', description: 'Documents, insurance, equipment, and test readiness.' },
];

const q = (
  id: string, section: string, objective: string, prompt: string,
  options: [string, string, string], answer: number, explanation: string,
  source: Source, difficulty: HandbookQuestion['difficulty'] = 'medium',
): HandbookQuestion => ({
  id, section, objective, prompt, options, answer, explanation,
  source: `${source.title} — verify official wording before publication`,
  sourceUrl: source.url, sourceRevision: source.revision, effectiveDate: source.effectiveDate,
  reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: NY,
  scope: 'jurisdiction-specific', difficulty,
});

export const newYorkQuestions: HandbookQuestion[] = [
  q('ny-licensing-001', 'licensing', 'Practice hours', 'What supervised practice record does New York generally require before a teen road test?', ['At least 50 hours, including at least 15 after sunset', '30 hours, all during daylight', '15 total hours with no daylight requirement'], 0, 'New York DMV requires at least 50 hours of supervised driving, including at least 15 hours after sunset, with the required certification.', teen, 'easy'),
  q('ny-licensing-002', 'licensing', 'Supervision', 'Who may supervise a New York learner driver?', ['A supervising driver who meets DMV age and licensing requirements, seated beside the learner', 'Any passenger who has held a permit for one day', 'Only another learner driver'], 0, 'The supervising driver must meet New York DMV requirements; the learner must have qualified supervision in the front seat.', permit, 'easy'),
  q('ny-licensing-003', 'licensing', 'Permit terminology', 'What is the New York teen license stage after a learner permit commonly called?', ['A junior driver license', 'A commercial driver license', 'A vehicle registration'], 0, 'New York uses junior driver license for the restricted teen license, where eligibility and region rules apply.', teen, 'easy'),
  q('ny-licensing-004', 'licensing', 'Permit hold', 'How long must a driver under 18 generally hold a New York learner permit before the road test?', ['At least six months', 'Seven days', 'Until age 21'], 0, 'New York’s teen-driver guidance generally requires a six-month permit period before the road test.', teen, 'medium'),
  q('ny-licensing-005', 'licensing', 'Junior restrictions', 'Which New York regional distinction must a junior driver check before driving?', ['Rules differ in New York City, Nassau/Suffolk, and upstate New York', 'Only the vehicle color changes the rule', 'The rules are identical everywhere'], 0, 'New York DMV publishes different junior-permit and junior-license restrictions by region; the exact local rule must be checked.', teen, 'easy'),
  q('ny-testing-001', 'testing', 'Knowledge test', 'What test must a New York first-time driver generally pass before receiving a learner permit?', ['A written/knowledge test', 'Only a vehicle emissions test', 'A commercial road test'], 0, 'The learner-permit process includes a DMV knowledge test covering traffic rules and safe driving.', permit, 'easy'),
  q('ny-testing-002', 'testing', 'Road test', 'What must a New York applicant generally complete before scheduling a road test?', ['Required pre-licensing education and the learner-permit practice requirements', 'A vehicle purchase', 'A commercial medical certificate'], 0, 'DMV eligibility includes the applicable pre-licensing course and supervised-practice requirements.', roadTest, 'medium'),
  q('ny-testing-003', 'testing', 'Test vehicle', 'What should a New York road-test vehicle have?', ['Valid registration, inspection, insurance, and required equipment', 'Only a full tank of fuel', 'A temporary paper plate with no insurance'], 0, 'DMV requires a roadworthy, properly documented vehicle; the appointment requirements should be checked before arrival.', roadTest, 'easy'),
  q('ny-testing-004', 'testing', 'Test conduct', 'What is the safest response if a road-test maneuver would be unsafe?', ['Do not force it; follow the examiner’s direction and make a lawful controlled choice', 'Accelerate to finish immediately', 'Ignore traffic controls'], 0, 'A road test evaluates safe, lawful control; an unsafe maneuver should not be forced.', roadTest, 'medium'),
  q('ny-fundamentals-001', 'fundamentals', 'Following distance', 'What is a sound New York defensive-driving choice in rain or snow?', ['Reduce speed and increase following distance', 'Keep the same gap because limits never change', 'Follow more closely to prevent merging'], 0, 'Reduced traction and visibility require more time and space.', handbook, 'easy'),
  q('ny-signs-001', 'signs', 'Traffic controls', 'What should a driver do at a New York stop sign?', ['Stop completely at the required point and proceed only when lawful and safe', 'Roll through if no vehicle is visible', 'Stop only when another driver signals'], 0, 'A stop sign requires a complete stop and then yielding as required.', handbook, 'easy'),
  q('ny-right-of-way-001', 'right-of-way', 'Pedestrians', 'When a pedestrian is in a crosswalk, what should a New York driver do?', ['Stop or yield as required and do not pass a vehicle stopped for the pedestrian', 'Honk and continue', 'Pass the stopped vehicle in the same lane'], 0, 'New York’s driver manual emphasizes yielding to pedestrians and never passing a vehicle stopped for one.', handbook, 'easy'),
  q('ny-lane-control-001', 'lane-control', 'Turn signals', 'Before turning or changing lanes, what should a New York driver do?', ['Signal early, check mirrors and blind spots, and move only when safe', 'Signal after moving', 'Rely on the other driver to yield'], 0, 'A signal communicates intent but does not make an unsafe gap safe.', handbook, 'easy'),
  q('ny-speed-space-001', 'speed-space', 'Safe speed', 'How should a driver choose speed in poor conditions?', ['Drive no faster than conditions safely permit, even if below the posted limit', 'Treat the posted limit as a required speed', 'Speed up to leave the weather'], 0, 'New York’s manual distinguishes a maximum limit from a safe speed for current conditions.', handbook, 'medium'),
  q('ny-sharing-road-001', 'sharing-road', 'School buses', 'When a school bus displays its red signal, what should a New York driver do?', ['Stop and remain stopped as required; do not pass the bus', 'Pass slowly if no child is visible', 'Pass on the shoulder'], 0, 'New York requires drivers to stop for a school bus displaying its stop signal, subject to the applicable law.', handbook, 'easy'),
  q('ny-sharing-road-002', 'sharing-road', 'Move over', 'What is the safer New York response to a stopped emergency or maintenance vehicle with warning lights?', ['Move over when safe and reduce speed as required', 'Maintain speed in the adjacent lane', 'Stop next to the vehicle'], 0, 'New York’s Move Over requirements protect roadside workers and responders; check the current statute for covered vehicles.', handbook, 'medium'),
  q('ny-parking-001', 'parking', 'Parking position', 'Before leaving a vehicle parked on a hill, what should a driver do?', ['Secure the vehicle and turn the wheels as appropriate for the hill and curb', 'Leave it in neutral with wheels straight', 'Leave the engine running unattended'], 0, 'The manual teaches securing the vehicle and positioning wheels to reduce roll risk.', handbook, 'easy'),
  q('ny-freeway-001', 'freeway', 'Breakdown', 'If a vehicle becomes disabled on an expressway, what is a safer first choice when possible?', ['Move out of the travel lane, use hazard lights, and seek help without entering traffic', 'Stand in the travel lane to wave traffic around', 'Walk along the center line'], 0, 'Getting out of moving traffic and making the vehicle visible reduces secondary-crash risk.', handbook, 'easy'),
  q('ny-safe-driving-001', 'safe-driving', 'Distraction', 'What should a New York driver do with a handheld phone while driving?', ['Do not use it; stop in a lawful safe location before handling it', 'Hold it below the steering wheel', 'Text only at a red light'], 0, 'Handheld device use and texting are prohibited or restricted; safe stops avoid distraction.', handbook, 'easy'),
  q('ny-safe-driving-002', 'safe-driving', 'Seat belts', 'What is the safest New York practice before moving?', ['Ensure the driver and required passengers are properly restrained', 'Wait until the first intersection', 'Use a seat belt only on expressways'], 0, 'Seat belts and child restraints should be used before the vehicle moves.', handbook, 'easy'),
  q('ny-vehicle-responsibility-001', 'vehicle-responsibility', 'Identity documents', 'What should a New York permit applicant bring to DMV?', ['The required proofs of identity, date of birth, and residence', 'Only a social-media profile', 'Only a vehicle repair receipt'], 0, 'DMV specifies acceptable proof documents; applicants should use its current document guide.', documents, 'easy'),
  q('ny-vehicle-responsibility-002', 'vehicle-responsibility', 'Insurance', 'What must be true of a vehicle used for a New York road test?', ['It must have current required insurance and registration documentation', 'Insurance is unnecessary for a test vehicle', 'Only the applicant’s birth certificate is needed'], 0, 'DMV road-test instructions require current vehicle documents, including insurance and registration.', roadTest, 'easy'),
  q('ny-vehicle-responsibility-003', 'vehicle-responsibility', 'GDL compliance', 'What should a junior driver do when a regional restriction is unclear?', ['Do not drive until the current DMV regional rule and any exception are confirmed', 'Assume the least restrictive rule', 'Rely on a friend’s permit'], 0, 'Regional GDL restrictions are consequential; conservative verification is safer than guessing.', teen, 'medium'),
];

export type NewYorkScenario = {
  id: string; prompt: string; options: [string, string, string]; answer: number;
  explanation: string; sourceUrl: string; reviewedAt: string; contentPackVersion: string;
  jurisdiction: 'US-NY';
};

export const newYorkScenarios: NewYorkScenario[] = [
  { id: 'ny-scenario-001', prompt: 'You are logging teen practice in New York. Which record meets the stated minimum?', options: ['50 hours total, including at least 15 after sunset', '15 hours total, all after sunset', '50 hours of daylight only'], answer: 0, explanation: 'New York DMV identifies at least 50 supervised hours, including at least 15 after sunset.', sourceUrl: teen.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-NY' },
  { id: 'ny-scenario-002', prompt: 'A junior driver plans a trip across New York regions. What is the responsible first step?', options: ['Check the DMV restriction for the specific region and time before driving', 'Assume the upstate rule applies everywhere', 'Ignore regional restrictions if accompanied by a friend'], answer: 0, explanation: 'New York junior-driver restrictions differ by region; confirm the applicable current DMV rule.', sourceUrl: teen.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-NY' },
  { id: 'ny-scenario-003', prompt: 'Your New York road-test vehicle has expired insurance documentation. What should you do?', options: ['Correct the documentation before the test', 'Attend anyway because the examiner supplies insurance', 'Borrow a plate from another vehicle'], answer: 0, explanation: 'A road-test vehicle must meet DMV documentation and safety requirements.', sourceUrl: roadTest.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-NY' },
];

export const newYorkContentPack: HandbookContentPack = {
  jurisdiction: NY, version: VERSION,
  sourceRevision: 'New York DMV official pages and MV-21 manual sources checked 2026-09-21; statutory currentness requires final human review',
  effectiveDate: 'Official sources checked and approved 2026-09-21',
  reviewedAt: REVIEWED, sourceUrl: handbookUrl, sections,
  universalSafetyQuestions: [], jurisdictionQuestions: newYorkQuestions, questions: newYorkQuestions,
};