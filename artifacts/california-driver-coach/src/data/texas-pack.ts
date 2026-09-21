import type {
  HandbookContentPack,
  HandbookQuestion,
  HandbookSection,
} from './question-bank';
import { TEXAS_CONTENT_PACK_VERSION } from '../lib/jurisdiction';

const TX = 'US-TX';
const VERSION = TEXAS_CONTENT_PACK_VERSION;
const REVIEWED = '2026-09-21';
const effective = 'Official pages/PDFs/statutes accessed and status-checked 2026-09-21';
const handbookUrl = 'https://www.dps.texas.gov/internetforms/forms/dl-7.pdf';
const statuteUrl = 'https://statutes.capitol.texas.gov/Docs/TN/htm/TN.545.htm';
const statuteRevision = 'Current on Texas Constitution and Statutes site through 89th Legislature, 2nd Called Session (2025)';

const sections: HandbookSection[] = [
  { id: 'licensing', title: 'Licensing & permits', description: 'Texas learner and provisional licensing.' },
  { id: 'testing', title: 'Testing process', description: 'Texas knowledge, skills, and vehicle checks.' },
  { id: 'fundamentals', title: 'Driving fundamentals', description: 'Control, scanning, communication, and defensive driving.' },
  { id: 'signs', title: 'Signs, signals & markings', description: 'Texas signs, signals, and pavement markings.' },
  { id: 'right-of-way', title: 'Right-of-way', description: 'Intersections, pedestrians, and yielding.' },
  { id: 'lane-control', title: 'Turns, lanes & passing', description: 'Lane position, turns, and passing.' },
  { id: 'speed-space', title: 'Speed, space & conditions', description: 'Speed, space, weather, and visibility.' },
  { id: 'sharing-road', title: 'Sharing the road', description: 'School buses, emergency vehicles, and vulnerable users.' },
  { id: 'parking', title: 'Parking & backing', description: 'Parking and backing safely.' },
  { id: 'freeway', title: 'Freeways & emergencies', description: 'Freeway and roadside emergency decisions.' },
  { id: 'safe-driving', title: 'Safe driving choices', description: 'Distraction, impairment, fatigue, and restraint.' },
  { id: 'vehicle-responsibility', title: 'Vehicle & driver responsibility', description: 'Texas insurance, registration, and equipment.' },
];

type Source = { title: string; url: string; revision: string; effectiveDate: string };
const dpsLearner: Source = {
  title: 'Texas Learners License as a Teen',
  url: 'https://www.dps.texas.gov/section/driver-license/texas-learners-license-teen',
  revision: 'Page dated February 27, 2024',
  effectiveDate: 'Page date 2024-02-27; currentness checked 2026-09-21',
};
const dpsProvisional: Source = {
  title: 'Texas Provisional License as a Teen',
  url: 'https://www.dps.texas.gov/section/driver-license/texas-provisional-license-teen',
  revision: 'Page dated November 27, 2024',
  effectiveDate: 'Page date 2024-11-27; currentness checked 2026-09-21',
};
const dl60: Source = {
  title: 'How to Prepare for a Drive Test (DL-60)',
  url: 'https://www.dps.texas.gov/internetforms/forms/dl-60.pdf',
  revision: 'PDF revision 03-2026',
  effectiveDate: 'PDF footer Rev. 03-2026',
};
const dl7: Source = {
  title: 'Driver Handbook (DL-7)',
  url: handbookUrl,
  revision: 'DPS form details: Rev. January 2026',
  effectiveDate: 'Revision January 2026',
};
const txdotSigns: Source = {
  title: 'Traffic signs and signals',
  url: 'https://www.txdot.gov/safety/traffic-signs-signals.html',
  revision: 'No revision date displayed',
  effectiveDate: 'Official page checked 2026-09-21',
};
const schoolBus: Source = {
  title: 'School bus safety',
  url: 'https://www.txdot.gov/safety/driving-laws/school-bus-safety.html',
  revision: 'No revision date displayed; page reports 2025 crash data',
  effectiveDate: 'Official page checked 2026-09-21',
};
const txdmv: Source = {
  title: 'Register Your Vehicle',
  url: 'https://www.txdmv.gov/motorists/register-your-vehicle',
  revision: 'No revision date displayed',
  effectiveDate: 'Includes January 1, 2025 inspection change; checked 2026-09-21',
};
const insurance: Source = {
  title: 'Auto insurance guide',
  url: 'https://www.tdi.texas.gov/pubs/consumer/cb020.html',
  revision: 'Page dated December 11, 2025',
  effectiveDate: 'Page date 2025-12-11',
};
const itd: Source = {
  title: 'Impact Texas Drivers (ITD) Program',
  url: 'https://www.dps.texas.gov/section/driver-license/impact-texas-drivers-itd-program',
  revision: 'Page dated September 22, 2020',
  effectiveDate: 'Page date 2020-09-22; currentness checked 2026-09-21',
};

const universalSections = new Set(['fundamentals', 'speed-space']);
const q = (
  id: string, section: string, objective: string, prompt: string,
  options: [string, string, string], answer: number, explanation: string,
  source: Source, difficulty: HandbookQuestion['difficulty'] = 'medium',
): HandbookQuestion => ({
  id, section, objective, prompt, options, answer, explanation,
  source: `${source.title} — review official wording before publication`,
  sourceUrl: source.url, sourceRevision: source.revision, effectiveDate: source.effectiveDate,
  reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: TX,
  scope: universalSections.has(section) ? 'universal' : 'jurisdiction-specific', difficulty,
});

export const texasQuestions: HandbookQuestion[] = [
  q('tx-licensing-001', 'licensing', 'Learner supervision', 'During Texas learner practice, who must sit in the front passenger seat?', ['A licensed adult age 21 or older', 'Any passenger age 16 or older', 'No one if the road is quiet'], 0, 'Texas DPS requires a licensed adult age 21 or older in the front passenger seat.', dpsLearner, 'easy'),
  q('tx-licensing-002', 'licensing', 'Practice period', 'How long must a Texas learner license generally be held before a provisional license?', ['At least six months', 'Thirty days', 'Until the first birthday after issuance'], 0, 'The learner license must generally be held for at least six months, subject to the stated exceptions.', dpsProvisional, 'easy'),
  q('tx-licensing-003', 'licensing', 'Supervised practice hours', 'What supervised practice record does Texas DPS list for a provisional license applicant?', ['30 hours, including at least 10 at night', '10 daylight hours only', '50 hours with no night minimum'], 0, 'Texas DPS lists 30 supervised practice hours, with at least 10 completed at night.', dpsProvisional, 'easy'),
  q('tx-licensing-004', 'licensing', 'Graduated licensing terminology', 'What is the under-18 Texas license issued after the learner phase generally called?', ['A provisional license', 'A commercial learner permit', 'A visitor registration'], 0, 'Texas uses provisional license for the next stage of its graduated driver licensing process.', dpsProvisional, 'easy'),
  q('tx-testing-001', 'testing', 'Drive test', 'Who must take a Texas driving test?', ['Anyone under age 18', 'Only drivers over age 25', 'Only people renewing online'], 0, 'DL-60 says anyone under 18 must take a driving test.', dl60, 'easy'),
  q('tx-testing-002', 'testing', 'Test vehicle', 'Which vehicle document must be current for a Texas drive test?', ['Registration and insurance', 'A restaurant receipt', 'A school transcript only'], 0, 'DPS checks unexpired registration and insurance along with required vehicle equipment.', dl60, 'easy'),
  q('tx-testing-003', 'testing', 'Impact Texas Teen Drivers', 'When must a teen complete the Impact Texas Teen Drivers program?', ['After required behind-the-wheel education and before the skills test', 'Only after receiving an unrestricted adult license', 'Instead of supervised practice'], 0, 'DPS says ITTD is completed after the required behind-the-wheel education and before the driving skills test.', itd, 'medium'),
  q('tx-fundamentals-001', 'fundamentals', 'Following distance', 'What is a sound way to increase following space?', ['Use at least a two-second gap and add more in poor conditions', 'Follow one car length at every speed', 'Reduce the gap in rain'], 0, 'The handbook recommends a two-second rule and additional space for weather, road, or traffic conditions.', dl7, 'easy'),
  q('tx-fundamentals-002', 'fundamentals', 'Vehicle control', 'What is the safest response if a maneuver would be dangerous or illegal?', ['Do not perform it; choose a lawful, controlled alternative', 'Continue to demonstrate confidence', 'Accelerate to finish sooner'], 0, 'Safe control and lawful decisions matter more than completing a maneuver quickly.', dl60, 'medium'),
  q('tx-signs-001', 'signs', 'Sign recognition', 'What is the best official Texas study source for traffic signs and signals?', ['The DPS Driver Handbook and TxDOT signs page', 'An unverified social-media quiz', 'A vehicle advertisement'], 0, 'DPS DL-7 and TxDOT publish the official sign and signal learning material.', dl7, 'easy'),
  q('tx-signs-002', 'signs', 'Signal meaning', 'What should a driver do when a traffic control device directs a movement?', ['Obey the device and proceed only when the movement is safe', 'Ignore it if no officer is visible', 'Copy the fastest vehicle'], 0, 'Texas road rules require drivers to understand and obey applicable signs, signals, and markings.', txdotSigns, 'easy'),
  q('tx-right-of-way-001', 'right-of-way', 'Pedestrian priority', 'At a marked crosswalk, what should a driver do when a pedestrian is crossing?', ['Stop or yield as required and avoid entering the pedestrian path', 'Sound the horn and continue', 'Pass another vehicle stopped for the pedestrian'], 0, 'Yielding protects a vulnerable road user and prevents blocking the crosswalk.', dl7, 'easy'),
  q('tx-right-of-way-002', 'right-of-way', 'Emergency response', 'When an emergency vehicle approaches with warning signals, what is the responsible choice?', ['Safely clear a path and stop when required', 'Follow it closely', 'Stop in the middle of an intersection'], 0, 'Clear a path without creating a second hazard and follow the applicable Texas rule.', dl7, 'medium'),
  q('tx-lane-control-001', 'lane-control', 'Turn signals', 'How far before a turn or lane change does DL-60 tell drivers to signal?', ['At least 100 feet', 'Exactly 10 feet', 'Only after starting the turn'], 0, 'The drive-test preparation sheet says to signal 100 feet before turning or changing lanes.', dl60, 'easy'),
  q('tx-lane-control-002', 'lane-control', 'Lane choice', 'If you are in the improper lane for a turn, what should you do?', ['Signal and move to the proper lane when safe', 'Turn from the improper lane without signaling', 'Stop in the travel lane indefinitely'], 0, 'DL-60 emphasizes correct lane position and signaling before the maneuver.', dl60, 'easy'),
  q('tx-speed-space-001', 'speed-space', 'Conditions', 'How should a driver adjust speed in poor weather or road conditions?', ['Slow to a safe speed and increase following distance', 'Keep the posted speed regardless of visibility', 'Drive faster to leave the area'], 0, 'A posted limit is not a command to drive faster than conditions safely allow.', dl7, 'easy'),
  q('tx-speed-space-002', 'speed-space', 'Visibility', 'Why should a driver increase space around the vehicle at night?', ['Limited visibility reduces time to detect and respond to hazards', 'It makes headlights brighter', 'It removes the need to scan'], 0, 'More space provides additional response time when visibility is limited.', dl7, 'medium'),
  q('tx-sharing-road-001', 'sharing-road', 'School buses', 'When a school bus displays flashing red lights or an extended stop sign, what should a driver do?', ['Stop and do not pass, subject to the divided-highway exception', 'Pass if traveling in the opposite direction on any road', 'Pass immediately after honking'], 0, 'TxDOT says not to pass in either direction unless the bus is on the opposite side of a divided highway.', schoolBus, 'medium'),
  q('tx-sharing-road-002', 'sharing-road', 'Move over', 'When a covered roadside vehicle has required emergency lights, what is the Texas move-over choice?', ['Vacate the nearest lane when safe, or slow 20 mph below the limit (5 mph if under 25)', 'Maintain speed in the nearest lane', 'Stop beside the roadside vehicle'], 0, 'Transportation Code §545.157 gives the lane-change or reduced-speed alternatives.', { title: 'Transportation Code §545.157 — Passing Certain Vehicles', url: statuteUrl + '#545.157', revision: statuteRevision, effectiveDate: 'Statute site current through 2025 session' }, 'hard'),
  q('tx-parking-001', 'parking', 'Backing', 'Before backing during a Texas drive test, what should a driver do?', ['Check around the vehicle and back in a controlled straight line', 'Back solely by looking at one mirror', 'Rely on another driver to steer'], 0, 'DL-60 lists backing in a straight line and observing traffic among evaluated skills.', dl60, 'easy'),
  q('tx-parking-002', 'parking', 'Safe stopping', 'Where should a driver avoid stopping or parking?', ['Where the vehicle blocks a travel path or creates an unsafe sight obstruction', 'In every legal parking space', 'Only on a sunny day'], 0, 'Choose a lawful location that leaves road users a clear, safe path.', dl7, 'easy'),
  q('tx-freeway-001', 'freeway', 'Roadside emergency', 'If you cannot safely move over for a covered roadside vehicle, what should you do?', ['Slow to the statutory reduced speed and pass cautiously', 'Speed up to minimize exposure', 'Use the shoulder as a travel lane'], 0, 'Section 545.157 requires the reduced-speed alternative when a safe lane change is unavailable.', { title: 'Transportation Code §545.157 — Passing Certain Vehicles', url: statuteUrl + '#545.157', revision: statuteRevision, effectiveDate: 'Statute site current through 2025 session' }, 'medium'),
  q('tx-freeway-002', 'freeway', 'Drive-test safety', 'What happens after a dangerous or illegal maneuver during the drive test?', ['The test is immediately stopped and results in an automatic failure', 'The maneuver is ignored', 'The driver receives extra credit'], 0, 'DL-60 expressly identifies a dangerous or illegal maneuver as an immediate automatic failure.', dl60, 'easy'),
  q('tx-safe-driving-001', 'safe-driving', 'Teen phone rule', 'For a Texas learner or provisional license holder, what is the phone rule?', ['All cell-phone use, including hands-free, is prohibited except an emergency', 'Hands-free use is always required', 'Texting is allowed at a red light'], 0, 'DPS states the teen learner and provisional restrictions prohibit all cell-phone use except an emergency.', dpsProvisional, 'easy'),
  q('tx-safe-driving-002', 'safe-driving', 'Provisional curfew', 'When is driving restricted for a Texas provisional license holder under 18?', ['Midnight to 5 a.m., except work, school activities, or emergencies', 'Noon to 1 p.m. every day', 'Only during daylight'], 0, 'The provisional restriction includes the midnight–5 a.m. period and listed exceptions.', dpsProvisional, 'medium'),
  q('tx-vehicle-responsibility-001', 'vehicle-responsibility', 'Insurance', 'What minimum Texas liability limits does the TDI auto-insurance guide state?', ['$30,000/$60,000/$25,000', '$3,000/$6,000/$2,500', '$100/$100/$100'], 0, 'The 30/60/25 figures cover bodily injury per person, bodily injury per accident, and property damage.', insurance, 'medium'),
  q('tx-vehicle-responsibility-002', 'vehicle-responsibility', 'Registration', 'What changed for most noncommercial Texas vehicle registrations on January 1, 2025?', ['A safety inspection is generally no longer required before registration, though emissions rules remain in listed counties', 'Insurance is no longer required', 'All inspections were eliminated statewide'], 0, 'TxDMV describes the safety-inspection change and continuing emissions requirements in 17 counties.', txdmv, 'hard'),
];

export type TexasScenario = {
  id: string;
  prompt: string;
  options: [string, string, string];
  answer: number;
  explanation: string;
  sourceUrl: string;
  reviewedAt: string;
  contentPackVersion: string;
  jurisdiction: 'US-TX';
};

export const texasScenarios: TexasScenario[] = [
  { id: 'tx-scenario-001', prompt: 'Your provisional-license trip is planned for 12:30 a.m. to visit a friend. Is it permitted?', options: ['Not unless it is for work, school activity, or an emergency', 'Yes, because provisional licenses have no curfew', 'Yes, if a passenger is under 21'], answer: 0, explanation: 'Texas provisional driving is restricted from midnight to 5 a.m. except for listed purposes.', sourceUrl: dpsProvisional.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-TX' },
  { id: 'tx-scenario-002', prompt: 'A tow truck with emergency lights is stopped on the shoulder and you cannot safely change lanes. What is the lawful alternative?', options: ['Slow 20 mph below the posted limit, or to 5 mph if the limit is under 25', 'Keep the same speed in the nearest lane', 'Drive on the shoulder to pass'], answer: 0, explanation: 'Section 545.157 provides a reduced-speed alternative when a safe lane change is unavailable.', sourceUrl: statuteUrl + '#545.157', reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-TX' },
  { id: 'tx-scenario-003', prompt: 'A school bus ahead displays flashing red lights on an undivided road. What is your response?', options: ['Stop and wait until the bus moves, signals stop, or the driver signals it is safe', 'Pass after checking only your mirror', 'Pass because you are approaching from the opposite direction'], answer: 0, explanation: 'Texas school-bus guidance requires stopping from either direction, subject to the divided-highway exception.', sourceUrl: schoolBus.url, reviewedAt: REVIEWED, contentPackVersion: VERSION, jurisdiction: 'US-TX' },
];

export const texasContentPack: HandbookContentPack = {
  jurisdiction: TX,
  version: VERSION,
  sourceRevision: 'Texas DPS/TxDOT/TxDMV/TDI official sources checked 2026-09-21',
  effectiveDate: effective,
  reviewedAt: REVIEWED,
  sourceUrl: handbookUrl,
  sections,
  universalSafetyQuestions: texasQuestions.filter((question) => question.scope === 'universal'),
  jurisdictionQuestions: texasQuestions.filter((question) => question.scope === 'jurisdiction-specific'),
  questions: texasQuestions,
};
