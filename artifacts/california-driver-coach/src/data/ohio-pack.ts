import type { HandbookContentPack, HandbookQuestion, HandbookSection } from './question-bank';
import type { JurisdictionCode } from '../lib/jurisdiction';

const OHIO = 'US-OH' as JurisdictionCode;
const VERSION = 'us-oh-2026.09.1';
const REVIEWED = '2026-09-21';
const handbookUrl = 'https://www.bmv.ohio.gov/forms-general.aspx';
const bmvPermitUrl = 'https://bmv.ohio.gov/dl-gdl.aspx';
const bmvTestingUrl = 'https://bmv.ohio.gov/dl-driving-tests.aspx';
const orc = (section: string) => `https://codes.ohio.gov/ohio-revised-code/section-${section}`;

type Source = { title: string; url: string; revision: string; effectiveDate: string };
const handbook: Source = {
  title: 'Ohio BMV forms index for the Ohio Driver Manual',
  url: handbookUrl,
  revision: 'Official BMV forms index linking the current Ohio Driver Manual; index checked 2026-09-21',
  effectiveDate: 'Official BMV forms index checked 2026-09-21',
};
const permit: Source = {
  title: 'Ohio BMV — Graduated Driver License (GDL) Program',
  url: bmvPermitUrl,
  revision: 'Official BMV GDL page; current page checked 2026-09-21',
  effectiveDate: 'Current page checked 2026-09-21',
};
const testing: Source = {
  title: 'Ohio BMV — Driving and skills testing',
  url: bmvTestingUrl,
  revision: 'Official BMV testing page; current page checked 2026-09-21',
  effectiveDate: 'Current page checked 2026-09-21',
};
const supervision: Source = {
  title: 'Ohio Revised Code §4507.05 — Temporary instruction permit',
  url: orc('4507.05'),
  revision: 'Ohio Revised Code official site; current text checked 2026-09-21',
  effectiveDate: 'Current code text checked 2026-09-21',
};
const restrictions: Source = {
  title: 'Ohio Revised Code §4507.071 — Probationary license restrictions',
  url: orc('4507.071'),
  revision: 'Ohio Revised Code official site; current text checked 2026-09-21',
  effectiveDate: 'Current code text checked 2026-09-21',
};
const rules: Source = {
  title: 'Ohio Revised Code Chapter 4511 — Traffic laws',
  url: orc('4511.39'),
  revision: 'Ohio Revised Code official site; current text checked 2026-09-21',
  effectiveDate: 'Current code text checked 2026-09-21',
};

const sections: HandbookSection[] = [
  { id: 'licensing', title: 'Licensing & permits', description: 'Ohio temporary instruction permits and graduated licensing.' },
  { id: 'testing', title: 'Testing process', description: 'Ohio knowledge, vision, maneuverability, and road tests.' },
  { id: 'fundamentals', title: 'Driving fundamentals', description: 'Control, observation, communication, and defensive driving.' },
  { id: 'signs', title: 'Signs, signals & markings', description: 'Ohio traffic controls and pavement markings.' },
  { id: 'right-of-way', title: 'Right-of-way', description: 'Intersections, pedestrians, and yielding.' },
  { id: 'lane-control', title: 'Turns, lanes & passing', description: 'Lane position, turns, signaling, and passing.' },
  { id: 'speed-space', title: 'Speed, space & conditions', description: 'Safe speed, space, weather, and visibility.' },
  { id: 'sharing-road', title: 'Sharing the road', description: 'School buses, emergency vehicles, and vulnerable road users.' },
  { id: 'parking', title: 'Parking & backing', description: 'Parking and backing safely.' },
  { id: 'freeway', title: 'Freeways & emergencies', description: 'Freeway entry and roadside emergencies.' },
  { id: 'safe-driving', title: 'Safe driving choices', description: 'Distraction, impairment, fatigue, and restraints.' },
  { id: 'vehicle-responsibility', title: 'Vehicle & driver responsibility', description: 'Documents, insurance, and vehicle readiness.' },
];

const q = (
  id: string, section: string, objective: string, prompt: string,
  options: [string, string, string], answer: number, explanation: string,
  source: Source, difficulty: HandbookQuestion['difficulty'] = 'medium',
): HandbookQuestion => ({
  id, section, objective, prompt, options, answer, explanation,
  source: source.title, sourceUrl: source.url, sourceRevision: source.revision,
  effectiveDate: source.effectiveDate, reviewedAt: REVIEWED, contentPackVersion: VERSION,
  jurisdiction: OHIO, scope: 'jurisdiction-specific', difficulty,
});

export const ohioQuestions: HandbookQuestion[] = [
  q('oh-licensing-001', 'licensing', 'Permit age', 'What is the minimum age to apply for an Ohio temporary instruction permit?', ['15½ years', '14 years', '18 years'], 0, 'Ohio allows an applicant who is at least 15 years and six months old to apply for a temporary instruction permit.', permit, 'easy'),
  q('oh-licensing-002', 'licensing', 'Supervision', 'Who must sit beside an Ohio temporary permit holder while driving?', ['A licensed driver age 21 or older who meets Ohio requirements', 'Any passenger age 16 or older', 'No one after the knowledge test'], 0, 'Ohio requires the permit holder to drive with a qualified licensed driver seated beside them.', supervision, 'easy'),
  q('oh-licensing-003', 'licensing', 'Practice hours', 'What practice record is required for an Ohio probationary license applicant under 18?', ['50 hours, including 10 hours at night', '20 hours, all during daylight', '50 hours with no night requirement'], 0, 'Ohio requires 50 hours of supervised driving, including at least 10 hours at night, documented as required by BMV.', permit, 'easy'),
  q('oh-licensing-004', 'licensing', 'Permit period', 'How long must an Ohio applicant under 18 generally hold the temporary instruction permit before a driving test?', ['Six months', 'Thirty days', 'Until age 21'], 0, 'Ohio’s GDL process generally requires a six-month permit period for applicants under 18.', permit, 'easy'),
  q('oh-licensing-005', 'licensing', 'Probationary restrictions', 'During the first 12 months of an Ohio probationary license, when is driving generally restricted?', ['Midnight to 6 a.m., subject to statutory exceptions', 'Noon to 3 p.m. every day', 'Only during daylight'], 0, 'Ohio restricts a probationary license holder’s midnight-to-6 a.m. driving during the first 12 months, with exceptions stated in law.', restrictions, 'medium'),
  q('oh-testing-001', 'testing', 'Knowledge exam', 'How many questions are on Ohio’s written knowledge test?', ['40 questions', '25 questions', '60 questions'], 0, 'Ohio BMV’s knowledge test has 40 multiple-choice questions.', testing, 'easy'),
  q('oh-testing-002', 'testing', 'Knowledge score', 'How many correct answers are needed to pass the Ohio knowledge test?', ['30 of 40', '20 of 40', '36 of 40'], 0, 'Ohio requires at least 75 percent, or 30 correct answers out of 40.', testing, 'easy'),
  q('oh-testing-003', 'testing', 'Skills testing', 'Which two parts make up Ohio’s driver skills test?', ['Maneuverability and road test', 'Parking-meter and freeway-toll tests', 'Only a written test and vehicle inspection'], 0, 'Ohio BMV describes a maneuverability test followed by a road test for the skills examination.', testing, 'easy'),
  q('oh-testing-004', 'testing', 'Test documentation', 'What should an Ohio applicant bring to a skills test?', ['A qualifying vehicle and required license or permit documents', 'A vehicle with no registration or insurance', 'Only a school transcript'], 0, 'The vehicle must meet BMV requirements, and the applicant must present the required permit and documents.', testing, 'medium'),
  q('oh-fundamentals-001', 'fundamentals', 'Following distance', 'What is a safe way to increase following space in Ohio?', ['Use a time gap and add more space for poor conditions', 'Use one car length at every speed', 'Reduce the gap in rain'], 0, 'Time and space should increase when traction, visibility, or traffic conditions reduce available response time.', handbook, 'easy'),
  q('oh-signs-001', 'signs', 'Stop control', 'What must a driver do at a stop sign?', ['Make a complete stop and proceed only when lawful and safe', 'Slow slightly and roll through', 'Stop only if another driver is present'], 0, 'A stop sign requires a complete stop at the required stopping point before proceeding.', handbook, 'easy'),
  q('oh-right-of-way-001', 'right-of-way', 'Pedestrian safety', 'When a pedestrian is crossing in a crosswalk, what should an Ohio driver do?', ['Stop or yield as required and do not enter the pedestrian’s path', 'Honk and continue', 'Pass another vehicle stopped for the pedestrian'], 0, 'Ohio traffic law protects pedestrians in crosswalks; yield and keep the crossing clear.', rules, 'easy'),
  q('oh-right-of-way-002', 'right-of-way', 'Emergency vehicles', 'When an emergency vehicle approaches using required warning signals, what should a driver do?', ['Safely move right and stop when required', 'Follow it closely', 'Stop in the middle of an intersection'], 0, 'Clear a path without creating another hazard and do not block an intersection.', rules, 'medium'),
  q('oh-lane-control-001', 'lane-control', 'Turn signals', 'How far before turning should an Ohio driver generally signal?', ['At least 100 feet', 'Exactly 10 feet', 'Only after beginning the turn'], 0, 'Ohio Revised Code §4511.39 generally requires a signal continuously during the last 100 feet before turning.', rules, 'easy'),
  q('oh-lane-control-002', 'lane-control', 'Lane changes', 'Before changing lanes, what should a driver do?', ['Check mirrors and blind spot, signal, and move only when safe', 'Signal after moving', 'Move immediately because the signal gives priority'], 0, 'A signal communicates intent but does not create a safe gap or right-of-way.', handbook, 'easy'),
  q('oh-speed-space-001', 'speed-space', 'Conditions', 'How should a driver respond when weather or road conditions make the posted speed unsafe?', ['Slow to a safe speed and increase following distance', 'Keep the posted speed regardless of visibility', 'Speed up to leave the area'], 0, 'Ohio’s safe-speed rule requires reasonable control for conditions, not simply driving at the posted maximum.', rules, 'easy'),
  q('oh-sharing-road-001', 'sharing-road', 'School buses', 'What should traffic do when an Ohio school bus displays its red visual signals and stop sign?', ['Stop at least 10 feet from the bus and remain stopped as required', 'Pass if no child is visible', 'Pass on the shoulder'], 0, 'Ohio law requires approaching traffic to stop at least 10 feet from a stopped school bus displaying its stop signal, subject to the divided-highway rule.', rules, 'medium'),
  q('oh-sharing-road-002', 'sharing-road', 'Move over', 'When approaching a stationary public-safety vehicle with warning lights on an Ohio roadway, what is the safe legal response?', ['Move over when possible or slow down and proceed cautiously', 'Maintain speed in the adjacent lane', 'Stop beside the vehicle'], 0, 'Ohio’s Move Over requirements call for changing lanes when safe or reducing speed and proceeding with caution.', rules, 'medium'),
  q('oh-parking-001', 'parking', 'Backing', 'What is the safest approach when backing an Ohio test vehicle?', ['Check around the vehicle and back slowly under control', 'Use only the rear camera', 'Back quickly before checking'], 0, 'Direct observation and controlled speed remain necessary even when a vehicle has camera or sensor aids.', testing, 'easy'),
  q('oh-freeway-001', 'freeway', 'Freeway entry', 'When entering an Ohio freeway, what should a driver do?', ['Use the acceleration lane to reach a compatible speed and merge into a safe gap', 'Stop at the end of the acceleration lane', 'Enter without checking because freeway traffic must yield'], 0, 'A safe merge requires observation, signaling, compatible speed, and a gap that does not force others to brake.', handbook, 'medium'),
  q('oh-safe-driving-001', 'safe-driving', 'Impairment', 'What should an Ohio driver do if alcohol, drugs, or medication may impair them?', ['Do not drive while impaired', 'Open a window and continue', 'Drive faster to arrive sooner'], 0, 'Ohio law prohibits operating a vehicle while under the influence; an impaired driver should not begin or continue driving.', rules, 'easy'),
  q('oh-vehicle-responsibility-001', 'vehicle-responsibility', 'Documentation', 'Which document category does Ohio BMV require an applicant to establish for a driver license?', ['Identity, date of birth, Social Security number, and Ohio residency', 'A restaurant receipt only', 'A vehicle advertisement'], 0, 'Ohio BMV’s acceptable-document rules require identity and lawful-status documentation plus Social Security number and Ohio residency evidence.', permit, 'medium'),
];

export type OhioScenario = {
  id: string; prompt: string; options: [string, string, string]; answer: number;
  explanation: string; sourceUrl: string; reviewedAt: string; contentPackVersion: string;
  jurisdiction: 'US-OH';
};

export const ohioScenarios: OhioScenario[] = [
  { id: 'oh-scenario-001', prompt: 'An Ohio permit holder has logged 50 supervised hours, but only 6 were at night. Can the practice record satisfy the under-18 requirement?', options: ['No; at least 10 hours must be at night', 'Yes; the night minimum is optional', 'Yes; only 6 total hours are required'], answer: 0, explanation: 'Ohio requires 50 supervised hours including at least 10 nighttime hours.', sourceUrl: permit.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-OH' },
  { id: 'oh-scenario-002', prompt: 'A probationary license holder under 18 plans a nonessential trip at 1 a.m. during the first year. Is it generally permitted?', options: ['No, unless a statutory exception applies', 'Yes, because the license is valid at all hours', 'Yes, if a friend rides along'], answer: 0, explanation: 'Ohio generally restricts probationary driving from midnight to 6 a.m. during the first 12 months, subject to listed exceptions.', sourceUrl: restrictions.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-OH' },
  { id: 'oh-scenario-003', prompt: 'A school bus ahead displays its stop sign and red signals on an Ohio undivided road. What should you do?', options: ['Stop at least 10 feet away and remain stopped as required', 'Pass slowly if no children are visible', 'Use the shoulder to pass'], answer: 0, explanation: 'Ohio school-bus law requires approaching traffic to stop at least 10 feet from the bus when its stop signal is displayed.', sourceUrl: rules.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-OH' },
];

export const ohioContentPack: HandbookContentPack = {
  jurisdiction: OHIO, version: VERSION,
  sourceRevision: 'Ohio BMV and Ohio Revised Code official sources checked 2026-09-21',
  effectiveDate: 'Official sources checked 2026-09-21', reviewedAt: REVIEWED,
  sourceUrl: handbookUrl, sections, universalSafetyQuestions: [],
  jurisdictionQuestions: ohioQuestions, questions: ohioQuestions,
};