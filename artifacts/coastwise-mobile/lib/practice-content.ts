import type { MobileJurisdiction } from './coastwise-context';

export type MobilePracticeQuestion = {
  id: string;
  topic: string;
  prompt: string;
  options: [string, string, string];
  answer: number;
  explanation: string;
  sourceTitle: string;
  sourceUrl: string;
};

const caSource = 'https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/';
const txSource = 'https://www.dps.texas.gov/section/driver-license/texas-provisional-license-teen';
const flSource = 'https://www.flhsmv.gov/driver-licenses-id-cards/licensing-requirements-teens-graduated-driver-license-laws';

const packs: Record<MobileJurisdiction, MobilePracticeQuestion[]> = {
  'US-CA': [
    { id: 'ca-mobile-right-of-way', topic: 'Right-of-way', prompt: 'At an all-way stop, you arrive at the same time as a driver on your right. Who generally goes first?', options: ['You', 'The driver on your right', 'The fastest driver'], answer: 1, explanation: 'When arrival is simultaneous, yield to the driver on your right.', sourceTitle: 'California Driver’s Handbook', sourceUrl: caSource },
    { id: 'ca-mobile-practice', topic: 'Licensing & permits', prompt: 'What supervised practice record is generally required for a California provisional license?', options: ['50 hours including 10 at night', '10 daylight hours', '30 hours with no night practice'], answer: 0, explanation: 'California requires 50 supervised hours, including 10 at night.', sourceTitle: 'California Driver’s Handbook', sourceUrl: caSource },
  ],
  'US-TX': [
    { id: 'tx-mobile-supervision', topic: 'Licensing & permits', prompt: 'Who must sit in the front passenger seat during Texas learner practice?', options: ['A licensed adult age 21 or older', 'Any passenger age 16', 'No one on quiet roads'], answer: 0, explanation: 'Texas DPS requires a licensed adult age 21 or older in the front passenger seat.', sourceTitle: 'Texas Learners License as a Teen', sourceUrl: 'https://www.dps.texas.gov/section/driver-license/texas-learners-license-teen' },
    { id: 'tx-mobile-hours', topic: 'Licensing & permits', prompt: 'What Texas supervised practice record is listed for a provisional license?', options: ['30 hours including 10 at night', '50 daylight hours', '10 total hours'], answer: 0, explanation: 'Texas DPS lists 30 hours, including at least 10 at night.', sourceTitle: 'Texas Provisional License as a Teen', sourceUrl: txSource },
    { id: 'tx-mobile-curfew', topic: 'Restrictions', prompt: 'When is a Texas provisional license holder under 18 generally restricted from driving?', options: ['Midnight to 5 a.m., with listed exceptions', 'Noon to 1 p.m.', 'All daylight hours'], answer: 0, explanation: 'The provisional restriction covers midnight to 5 a.m. except work, school activities, or emergencies.', sourceTitle: 'Texas Provisional License as a Teen', sourceUrl: txSource },
    { id: 'tx-mobile-phone', topic: 'Safe driving choices', prompt: 'What phone rule applies to a Texas learner or provisional license holder?', options: ['No use, including hands-free, except emergencies', 'Hands-free use is unrestricted', 'Texting is allowed at red lights'], answer: 0, explanation: 'Texas DPS states the teen restriction prohibits all phone use except an emergency.', sourceTitle: 'Texas Provisional License as a Teen', sourceUrl: txSource },
  ],
  'US-FL': [
    { id: 'fl-mobile-age', topic: 'Licensing & permits', prompt: 'What is the minimum age for a Florida learner license?', options: ['15', '14', '16'], answer: 0, explanation: 'Florida permits a learner license at age 15 when the other requirements are met.', sourceTitle: 'FLHSMV Teen Licensing Requirements', sourceUrl: flSource },
    { id: 'fl-mobile-hours', topic: 'Licensing & permits', prompt: 'What Florida supervised practice record must a qualifying teen certify?', options: ['50 hours including 10 at night', '20 daylight hours', '30 hours with no night minimum'], answer: 0, explanation: 'Florida requires 50 supervised hours, including at least 10 at night.', sourceTitle: 'Florida Statutes §322.05', sourceUrl: 'https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0322/Sections/0322.05.html' },
    { id: 'fl-mobile-dets', topic: 'Testing process', prompt: 'As of August 1, 2025, what course must an under-18 first-time Florida applicant generally complete?', options: ['The six-hour DETS course', 'A commercial inspection course', 'A motorcycle endorsement course'], answer: 0, explanation: 'FLHSMV generally requires the six-hour Driver Education Traffic Safety (DETS) course for an under-18 first-time applicant. TLSAE remains the over-18 path, with a limited pre-August 1, 2025 certificate exception.', sourceTitle: 'FLHSMV Driver Education Traffic Safety (DETS)', sourceUrl: 'https://www.flhsmv.gov/driver-licenses-id-cards/education-courses/driver-improvement-schools/driver-education-traffic-safety-dets' },
    { id: 'fl-mobile-restriction', topic: 'Restrictions', prompt: 'During the first three months of a Florida learner license, when may the learner generally drive?', options: ['During daylight hours', 'At any hour alone', 'Only after midnight'], answer: 0, explanation: 'Florida graduated licensing guidance limits the first three months to daylight driving with required supervision.', sourceTitle: 'FLHSMV Teen Licensing Requirements', sourceUrl: flSource },
  ],
  'US-NY': [
    { id: 'ny-mobile-hours', topic: 'Licensing & permits', prompt: 'What New York supervised practice record is generally listed for a teen applicant?', options: ['50 hours including 15 after sunset', '30 daylight hours', '15 total hours'], answer: 0, explanation: 'New York DMV identifies at least 50 supervised hours, including at least 15 after sunset.', sourceTitle: 'New York State DMV: Graduated License Law', sourceUrl: 'https://dmv.ny.gov/younger-driver/graduated-license-law-and-restrictions-drivers-under-18' },
    { id: 'ny-mobile-region', topic: 'Restrictions', prompt: 'What should a New York junior driver check before driving in another region?', options: ['The DMV restriction for that specific region', 'Only the vehicle color', 'No rule because restrictions are statewide'], answer: 0, explanation: 'Junior-driver restrictions differ by New York region.', sourceTitle: 'New York State DMV: Learner Permit Restrictions', sourceUrl: 'https://dmv.ny.gov/driver-license/learner-permit-restrictions' },
  ],
  'US-OH': [
    { id: 'oh-mobile-hours', topic: 'Licensing & permits', prompt: 'What Ohio supervised practice record is generally required for an under-18 applicant?', options: ['50 hours including 10 at night', '30 daylight hours', '10 total hours'], answer: 0, explanation: 'Ohio requires 50 supervised hours, including at least 10 nighttime hours.', sourceTitle: 'Ohio BMV Graduated Driver License Program', sourceUrl: 'https://bmv.ohio.gov/dl-gdl.aspx' },
    { id: 'oh-mobile-curfew', topic: 'Restrictions', prompt: 'What should an Ohio probationary driver do before a late-night trip?', options: ['Check the applicable probationary restriction and exceptions', 'Assume all hours are permitted', 'Drive only on the shoulder'], answer: 0, explanation: 'Ohio probationary licenses have nighttime restrictions with listed exceptions.', sourceTitle: 'Ohio BMV Graduated Driver License Program', sourceUrl: 'https://bmv.ohio.gov/dl-gdl.aspx' },
  ],
  'US-IL': [
    { id: 'il-mobile-hours', topic: 'Licensing & permits', prompt: 'What Illinois supervised practice record is generally required?', options: ['50 hours including 10 at night', '20 daylight hours', '10 total hours'], answer: 0, explanation: 'Illinois GDL requires 50 supervised hours, including 10 nighttime hours.', sourceTitle: 'Illinois Graduated Driver Licensing Program', sourceUrl: 'https://www.ilsos.gov/services/drivers-license/gdl.html' },
    { id: 'il-mobile-permit', topic: 'Licensing & permits', prompt: 'How long does an Illinois under-18 permit phase generally last?', options: ['At least nine months', 'One month', 'Exactly three years'], answer: 0, explanation: 'The Illinois permit phase generally lasts at least nine months before initial licensing.', sourceTitle: 'Illinois Graduated Driver Licensing Program', sourceUrl: 'https://www.ilsos.gov/services/drivers-license/gdl.html' },
  ],
};

export function getMobilePracticePack(jurisdiction: MobileJurisdiction) {
  return packs[jurisdiction];
}

export function getMobileWeakTopics(
  jurisdiction: MobileJurisdiction,
  contentPackVersion: string,
  progress: Record<string, { correct: boolean; topic: string }>,
) {
  const questions = packs[jurisdiction];
  const topics = [...new Set(questions.map((question) => question.topic))];
  return topics.map((topic) => {
    const topicQuestions = questions.filter((question) => question.topic === topic);
    const answers = topicQuestions.map((question) => progress[`${jurisdiction}:${contentPackVersion}:${question.id}`]).filter(Boolean);
    return { topic, mastery: answers.length ? Math.round(answers.filter((answer) => answer.correct).length / answers.length * 100) : 0 };
  }).sort((a, b) => a.mastery - b.mastery).slice(0, 3);
}