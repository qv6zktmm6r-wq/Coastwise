import type { HandbookContentPack, HandbookQuestion, HandbookSection } from './question-bank';
import { FLORIDA_CONTENT_PACK_VERSION } from '../lib/jurisdiction';

const FLORIDA = 'US-FL';
const reviewedAt = '2026-09-21';
const handbookUrl = 'https://www.flhsmv.gov/pdf/handbooks/englishdriverhandbook.pdf';
const handbookRevision = 'Florida Class E Driver License Handbook 2023 (official PDF; current landing page checked 2026-09-21)';
const teenUrl = 'https://www.flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws';
const examUrl = 'https://www.flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws-driving-curfews/class-e-knowledge-exam-driving-skills-test/';
const detsUrl = 'https://www.flhsmv.gov/driver-licenses-id-cards/education-courses/driver-improvement-schools/driver-education-traffic-safety-dets';
const statute = (section: string) =>
  `https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/${section}`;

const sections: HandbookSection[] = [
  { id: 'licensing', title: 'Licensing & permits', description: 'Florida learner licenses, graduated licensing, supervision, and curfews.' },
  { id: 'testing', title: 'Testing process', description: 'Florida Class E knowledge and driving skills tests.' },
  { id: 'fundamentals', title: 'Driving fundamentals', description: 'Control, observation, and safe driving decisions.' },
  { id: 'signs', title: 'Signs, signals & markings', description: 'Florida traffic controls and signs.' },
  { id: 'right-of-way', title: 'Right-of-way', description: 'Yielding and orderly interaction with road users.' },
  { id: 'lane-control', title: 'Turns, lanes & passing', description: 'Lane use, turns, passing, and traffic control.' },
  { id: 'speed-space', title: 'Speed, space & conditions', description: 'Safe speed, following space, visibility, and conditions.' },
  { id: 'sharing-road', title: 'Sharing the road', description: 'Buses, emergency responders, bicycles, and other road users.' },
  { id: 'parking', title: 'Parking & backing', description: 'Safe stopping, parking, and reversing.' },
  { id: 'freeway', title: 'Freeways & emergencies', description: 'Emergencies, disabled vehicles, and Move Over.' },
  { id: 'safe-driving', title: 'Safe driving choices', description: 'Distraction, impairment, and teen safety.' },
  { id: 'vehicle-responsibility', title: 'Vehicle & driver responsibility', description: 'Insurance, registration, equipment, and readiness.' },
];

type Source = { title: string; url: string; revision?: string; effective?: string };
const handbook: Source = { title: handbookRevision, url: handbookUrl, revision: handbookRevision, effective: 'Not stated by source' };
const teen: Source = { title: 'Licensing Requirements for Teens, Graduated Driver License Laws and Driving Curfews', url: teenUrl, revision: 'Not stated by source', effective: 'Not stated by source' };
const exam: Source = { title: 'Class E Knowledge Exam & Driving Skills Test', url: examUrl, revision: 'Not stated by source', effective: 'Not stated by source' };
const moveOver: Source = { title: 'Move Over, Florida!', url: 'https://www.flhsmv.gov/safety-center/driving-safety/move-over', revision: 'Not stated by source', effective: 'Expansion stated effective 2025-01-01' };
const insurance: Source = { title: 'Florida Insurance Requirements', url: 'https://www.flhsmv.gov/insurance/', revision: 'Not stated by source', effective: 'Not stated by source' };

const q = (
  id: string, section: string, objective: string, prompt: string,
  options: [string, string, string], answer: number, explanation: string,
  source: Source, difficulty: HandbookQuestion['difficulty'] = 'medium',
): HandbookQuestion => ({
  id, section, objective, prompt, options, answer, explanation,
  source: source.title, sourceUrl: source.url, sourceRevision: source.revision ?? 'Not stated by source',
  effectiveDate: source.effective ?? 'Not stated by source', reviewedAt,
  contentPackVersion: FLORIDA_CONTENT_PACK_VERSION, jurisdiction: FLORIDA,
  scope: 'jurisdiction-specific', difficulty,
});

export const floridaQuestions: HandbookQuestion[] = [
  q('fl-licensing-001', 'licensing', 'Learner age', 'What is the minimum age for a Florida learner license?', ['15', '14', '16'], 0, 'Florida permits a learner license at age 15 when the other statutory requirements are met.', teen, 'easy'),
  q('fl-licensing-002', 'licensing', 'Supervision and practice', 'Which practice record is required before a qualifying teen receives a Florida license?', ['50 supervised hours, including 10 at night', '20 hours, all in daylight', '50 hours with no night requirement'], 0, 'The certification requires at least 50 behind-the-wheel hours, including at least 10 nighttime hours.', { title: 'F.S. 322.05, Persons not to be licensed', url: statute('0322/Sections/0322.05.html'), revision: 'Current statute page; verify 2026 amendments', effective: 'Not stated' }, 'easy'),
  q('fl-licensing-003', 'licensing', 'DETS terminology', 'As of August 1, 2025, what course must an under-18 first-time Florida applicant generally complete before applying for a driver license?', ['The six-hour Driver Education Traffic Safety (DETS) course', 'A commercial truck inspection course', 'A motorcycle endorsement course'], 0, 'FLHSMV says an under-18 person who has never held a license from another jurisdiction generally needs the six-hour DETS course. Applicants age 18 or older generally use the four-hour TLSAE path, and an under-18 TLSAE certificate completed before August 1, 2025 may remain usable until it expires; listed FDOE and DELAP alternatives also apply.', { title: 'FLHSMV Driver Education Traffic Safety (DETS)', url: detsUrl, revision: 'Official FLHSMV page published 2025-07-24', effective: 'Under-18 rule effective 2025-08-01' }, 'easy'),
  q('fl-licensing-004', 'licensing', 'Learner restriction', 'During the first three months after a Florida learner license is issued, when may the learner generally drive?', ['During daylight hours only', 'At any hour without supervision', 'Only from midnight to 5 a.m.'], 0, 'FLHSMV’s graduated licensing guidance limits the first three months to daylight driving with required supervision.', teen, 'medium'),
  q('fl-testing-001', 'testing', 'Knowledge exam scoring', 'How many questions must a customer answer correctly to pass Florida’s Class E Knowledge Exam?', ['40 of 50', '25 of 50', '45 of 50'], 0, 'The exam has 50 multiple-choice questions and requires 40 correct answers, an 80 percent score.', exam, 'easy'),
  q('fl-testing-002', 'testing', 'Driving skills eligibility', 'A teen is applying for a Florida Class E license at age 17. Which general requirement applies?', ['Hold the learner license for 12 months, subject to the law’s conditions', 'Skip the driving skills test', 'Hold the learner license for one month'], 0, 'Florida generally requires a teen to hold the learner license for 12 months or be 18 before the skills-test licensing path.', exam),
  q('fl-fundamentals-001', 'fundamentals', 'Vehicle control', 'What is the safest response when a driver notices a developing hazard ahead?', ['Scan, reduce risk early, and keep the vehicle under control', 'Accelerate toward it', 'Look only in the rearview mirror'], 0, 'The official handbook teaches observation, speed control, and early responses rather than abrupt or aggressive reactions.', handbook, 'easy'),
  q('fl-fundamentals-002', 'fundamentals', 'Impairment readiness', 'Before driving in Florida, what should a driver do if alcohol, drugs, or medication may affect normal faculties?', ['Do not drive while affected', 'Drive only in the left lane', 'Open a window and continue'], 0, 'A driver should be unimpaired before driving; a window or lane choice does not make impairment safe.', handbook, 'easy'),
  q('fl-signs-001', 'signs', 'Traffic controls', 'The Florida knowledge exam tests identification of what in addition to traffic laws and safe driving?', ['Traffic controls', 'Vehicle brand names', 'Insurance company logos'], 0, 'FLHSMV describes traffic-control identification as a Class E exam subject.', exam, 'easy'),
  q('fl-signs-002', 'signs', 'Stop control', 'At a stop sign, what is the appropriate first action?', ['Make a complete stop and proceed only when lawful and safe', 'Slow slightly and roll through', 'Stop only if another driver honks'], 0, 'A stop sign requires a full stop; the driver then yields and proceeds when permitted.', handbook, 'easy'),
  q('fl-right-of-way-001', 'right-of-way', 'Yielding', 'When another road user has the right-of-way, what should a Florida driver do?', ['Yield and avoid forcing the other road user to react', 'Claim priority by accelerating', 'Use the horn to take the turn'], 0, 'Right-of-way is yielded, not taken; a safe driver waits rather than creating a conflict.', handbook, 'easy'),
  q('fl-right-of-way-002', 'right-of-way', 'Pedestrian safety', 'What is the safer choice when a pedestrian is crossing at a permitted crossing?', ['Slow or stop and yield as required', 'Pass the pedestrian in the same lane', 'Continue because the vehicle is larger'], 0, 'The handbook emphasizes yielding to pedestrians and avoiding a movement that would endanger them.', handbook, 'medium'),
  q('fl-lane-control-001', 'lane-control', 'Lane changes', 'Before changing lanes, what combination best reflects safe practice?', ['Check traffic, signal, and move only when the gap is safe', 'Signal after moving and rely on the horn', 'Change immediately if the vehicle behind is close'], 0, 'Observation and communication must happen before the movement; a signal does not create a safe gap.', handbook, 'easy'),
  q('fl-lane-control-002', 'lane-control', 'Passing', 'When is passing an unsafe choice?', ['When sight distance, space, or traffic conditions do not support a safe pass', 'Whenever the road has two lanes', 'Whenever the passing vehicle is newer'], 0, 'Passing depends on visibility, space, and lawful conditions, not on vehicle age or the mere existence of two lanes.', handbook),
  q('fl-speed-space-001', 'speed-space', 'Following distance', 'Why should a driver leave additional space in rain or reduced visibility?', ['It provides more time and distance to respond', 'It makes headlights unnecessary', 'It guarantees the road is clear'], 0, 'Reduced traction and visibility make extra space an important defensive-driving choice.', handbook, 'easy'),
  q('fl-speed-space-002', 'speed-space', 'Move Over speed', 'If a driver cannot safely move over for a covered roadside vehicle, what does Florida guidance generally require?', ['Slow 20 mph below the posted limit, or to 5 mph when the limit is 20 mph or less', 'Stop in the travel lane', 'Speed up to pass quickly'], 0, 'FLHSMV’s Move Over guidance gives the 20-mph reduction and 5-mph-low-limit rule when moving over is unsafe.', moveOver),
  q('fl-sharing-road-001', 'sharing-road', 'School buses', 'On an undivided road, what should traffic do when a school bus displays its stop signal?', ['Stop and remain stopped until the signal is withdrawn', 'Pass slowly on the left', 'Stop only if children are visible'], 0, 'Florida law requires approaching traffic to stop for a school bus displaying a stop signal.', { title: 'F.S. 316.172, Traffic to stop for school bus', url: 'https://www.flsenate.gov/Laws/Statutes/2025/0316.172', revision: '2025 statutory page; 2026 edition requires verification', effective: 'Not stated' }),
  q('fl-sharing-road-002', 'sharing-road', 'Divided highway bus exception', 'When may opposite-direction traffic generally proceed past a stopped school bus?', ['When a raised median, physical barrier, or at least 5 feet of unpaved separation divides the roadway', 'Whenever there are two marked lanes', 'Whenever the bus is yellow'], 0, 'The statutory exception is tied to a qualifying physical separation, not merely lane count or bus color.', { title: 'F.S. 316.172, Traffic to stop for school bus', url: 'https://www.flsenate.gov/Laws/Statutes/2025/0316.172', revision: '2025 statutory page; 2026 edition requires verification', effective: 'Not stated' }),
  q('fl-parking-001', 'parking', 'Safe stopping', 'Before opening a door or leaving a parked vehicle, what should a driver check?', ['Traffic, bicyclists, pedestrians, and the vehicle’s secure position', 'Only the dashboard clock', 'Only whether the radio is off'], 0, 'A safe parking routine protects people nearby and prevents an unattended vehicle from moving.', handbook, 'easy'),
  q('fl-parking-002', 'parking', 'Backing', 'What is the safest general approach when backing?', ['Check around the vehicle and back slowly while maintaining control', 'Back quickly before looking', 'Rely only on a camera'], 0, 'Cameras help but do not replace direct observation and controlled backing.', handbook, 'easy'),
  q('fl-freeway-001', 'freeway', 'Move Over coverage', 'As of January 1, 2025, which roadside vehicle is included in Florida’s expanded Move Over guidance?', ['A vehicle with hazard lights, flares, or visible emergency signage, including a disabled vehicle', 'Only a marked police cruiser', 'Only a tow truck with a passenger inside'], 0, 'FLHSMV says the expansion covers any roadside vehicle showing the listed warning indicators, including a flat-tire or disabled vehicle.', moveOver),
  q('fl-freeway-002', 'freeway', 'Emergency response', 'If moving over for a stopped covered vehicle is not safe, what should the driver avoid?', ['Continuing at the posted speed as if the roadside vehicle were not there', 'Reducing speed', 'Watching for people near the roadway'], 0, 'The alternative to moving over is the required speed reduction; ignoring the hazard defeats the law’s safety purpose.', moveOver, 'easy'),
  q('fl-safe-driving-001', 'safe-driving', 'Texting', 'Which behavior is addressed by Florida’s Ban on Texting While Driving Law?', ['Text messaging while operating a motor vehicle', 'Choosing a radio station while parked', 'Checking tire pressure before a trip'], 0, 'F.S. 316.305 is expressly cited as the Florida Ban on Texting While Driving Law; exact exceptions should be checked before legal use.', { title: 'F.S. 316.305, Wireless communications devices; prohibition', url: statute('0316/Sections/0316.305.html'), revision: 'Statute page dated 2026-09-21', effective: 'Not stated' }),
  q('fl-safe-driving-002', 'safe-driving', 'Under-21 alcohol rule', 'What does the FLHSMV teen guidance say about a driver under 21 with a BAL of .02% or more?', ['The license is immediately suspended for six months for a first occurrence', 'There is never an administrative consequence', 'The driver automatically receives a full license'], 0, 'The teen page describes a six-month immediate suspension for a first under-21 .02% or-more BAL occurrence; verify current statutory details.', teen),
  q('fl-vehicle-responsibility-001', 'vehicle-responsibility', 'Insurance', 'Before registering a four-wheel vehicle in Florida, what coverage must generally be shown?', ['Florida PIP and PDL coverage', 'Only roadside-assistance coverage', 'Only collision coverage from any state'], 0, 'FLHSMV requires proof of Personal Injury Protection and Property Damage Liability coverage for registration.', insurance, 'easy'),
  q('fl-vehicle-responsibility-002', 'vehicle-responsibility', 'Registration readiness', 'What should a driver do with a safety-critical tire problem before using the vehicle?', ['Have it checked or repaired before driving', 'Ignore it if the other tires look good', 'Increase speed to test it'], 0, 'FLHSMV’s vehicle-safety guidance supports a road-ready vehicle; an unsafe tire should be addressed before travel.', { title: 'FLHSMV Vehicle Safety', url: 'https://www.flhsmv.gov/safety-center/vehicle-safety/', revision: 'Not stated by source', effective: 'Not stated by source' }, 'easy'),
];

export type FloridaScenario = {
  id: string;
  title: string;
  prompt: string;
  options: [string, string, string];
  answer: number;
  explanation: string;
  sourceUrl: string;
};

export const floridaScenarios: FloridaScenario[] = [
  { id: 'fl-scenario-001', title: 'Night practice log', prompt: 'A parent is certifying a teen’s Florida practice. Which log meets the minimum?', options: ['50 total hours including 10 at night', '10 total hours including 50 at night', '50 total daylight hours only'], answer: 0, explanation: 'The certification requires 50 hours, with at least 10 at night.', sourceUrl: statute('0322/Sections/0322.05.html') },
  { id: 'fl-scenario-002', title: 'Stopped school bus', prompt: 'You approach a stopped school bus on an undivided road with its stop signal displayed. What do you do?', options: ['Stop until the signal is withdrawn', 'Pass if no child is visible', 'Pass on the shoulder'], answer: 0, explanation: 'Florida’s school-bus statute requires a full stop while the signal is displayed.', sourceUrl: 'https://www.flsenate.gov/Laws/Statutes/2025/0316.172' },
  { id: 'fl-scenario-003', title: 'Roadside disabled vehicle', prompt: 'A disabled vehicle displays hazard lights and you cannot safely change lanes. What is the Florida Move Over response?', options: ['Slow 20 mph below the limit, or to 5 mph when the limit is 20 mph or less', 'Maintain the limit and sound the horn', 'Stop in the lane immediately'], answer: 0, explanation: 'When a lane change is unsafe, FLHSMV guidance requires the specified speed reduction.', sourceUrl: moveOver.url },
];

export const floridaContentPack: HandbookContentPack = {
  jurisdiction: FLORIDA,
  version: FLORIDA_CONTENT_PACK_VERSION,
  sourceRevision: handbookRevision,
  effectiveDate: '2026-09-21',
  reviewedAt,
  sourceUrl: handbookUrl,
  sections,
  universalSafetyQuestions: [],
  jurisdictionQuestions: floridaQuestions,
  questions: floridaQuestions,
};

export { sections as floridaHandbookSections };