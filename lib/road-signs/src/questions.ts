import type { RoadFigureId } from './figures';

export type PictureQuestion = {
  /** Stable suffix; consumers prefix it with their jurisdiction. */
  key: string;
  figure: RoadFigureId;
  objective: string;
  prompt: string;
  options: [string, string, string];
  answer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

/**
 * Sign and marking meanings follow the national MUTCD, so every supported
 * state's handbook teaches the same answers. Wording must stay state-neutral.
 */
export const PICTURE_QUESTIONS: PictureQuestion[] = [
  {
    key: 'stop', figure: 'stop', objective: 'Stop sign', difficulty: 'easy',
    prompt: 'What must you do at this sign?',
    options: ['Come to a complete stop, then go when it is safe', 'Slow down and go if no one is coming', 'Stop only if another car is there'],
    answer: 0,
    explanation: 'Stop completely at the limit line, before the crosswalk, or before the intersection. Then yield to traffic and pedestrians and go when it is safe.',
  },
  {
    key: 'yield', figure: 'yield', objective: 'Yield sign', difficulty: 'easy',
    prompt: 'What does this sign tell you to do?',
    options: ['Speed up to get ahead of traffic', 'Slow down and be ready to stop so traffic and pedestrians can go first', 'Stop every time, even when the way is clear'],
    answer: 1,
    explanation: 'A yield sign means let traffic and pedestrians that are already there go first. Slow down and stop if you need to.',
  },
  {
    key: 'do-not-enter', figure: 'do-not-enter', objective: 'Do Not Enter sign', difficulty: 'easy',
    prompt: 'What does this sign mean?',
    options: ['Enter only to turn around', 'Trucks may not enter', 'Do not drive into this road from your direction'],
    answer: 2,
    explanation: 'Do not enter the road from your direction. You often see this sign at one-way streets and freeway exit ramps.',
  },
  {
    key: 'wrong-way', figure: 'wrong-way', objective: 'Wrong Way sign', difficulty: 'medium',
    prompt: 'You see this sign after turning onto a road or ramp. What does it mean?',
    options: ['You are driving against traffic; stop and turn around safely when it is clear', 'Keep going and take the next exit', 'Turn on hazard lights and continue slowly'],
    answer: 0,
    explanation: 'A Wrong Way sign means you are facing oncoming traffic. Get out of the way and turn around as soon as you can do it safely.',
  },
  {
    key: 'railroad-crossbuck', figure: 'railroad-crossbuck', objective: 'Railroad crossbuck', difficulty: 'easy',
    prompt: 'What does this sign mark?',
    options: ['A four-way intersection', 'A railroad crossing; look, listen, and be ready to stop for a train', 'A hospital zone'],
    answer: 1,
    explanation: 'The crossbuck marks where railroad tracks cross the road. Treat it like a yield sign: slow down, look both ways, and stop if a train is coming.',
  },
  {
    key: 'railroad-advance', figure: 'railroad-advance', objective: 'Railroad advance warning', difficulty: 'easy',
    prompt: 'What does this round yellow sign warn you about?',
    options: ['A railroad crossing ahead', 'A rest area ahead', 'A road that narrows to one lane'],
    answer: 0,
    explanation: 'This round sign warns that a railroad crossing is ahead. Slow down, look, and listen for trains.',
  },
  {
    key: 'school', figure: 'school', objective: 'School zone sign', difficulty: 'easy',
    prompt: 'What does this five-sided sign warn you about?',
    options: ['A pedestrian-only street', 'A school zone or school crossing', 'A park with no speed limit'],
    answer: 1,
    explanation: 'The five-sided (pentagon) sign marks a school zone or school crossing. Slow down and watch for children.',
  },
  {
    key: 'pedestrian', figure: 'pedestrian', objective: 'Pedestrian crossing sign', difficulty: 'easy',
    prompt: 'What should you expect when you see this sign?',
    options: ['A bus stop ahead', 'Pedestrians are not allowed on this road', 'People may be crossing; slow down and be ready to yield'],
    answer: 2,
    explanation: 'This sign warns of a place where people often cross. Slow down, watch for pedestrians, and be ready to stop.',
  },
  {
    key: 'no-u-turn', figure: 'no-u-turn', objective: 'No U-turn sign', difficulty: 'easy',
    prompt: 'What does this sign mean?',
    options: ['U-turns are not allowed here', 'A U-turn lane is ahead', 'The road curves sharply'],
    answer: 0,
    explanation: 'A red circle with a slash means the action shown is not allowed. Here, you may not make a U-turn.',
  },
  {
    key: 'no-right-turn', figure: 'no-right-turn', objective: 'No right turn sign', difficulty: 'easy',
    prompt: 'What does this sign mean?',
    options: ['Right turns only on red', 'You may not turn right here', 'The right lane ends ahead'],
    answer: 1,
    explanation: 'The red circle and slash mean the movement shown is not allowed. You may not turn right here.',
  },
  {
    key: 'keep-right', figure: 'keep-right', objective: 'Keep Right sign', difficulty: 'medium',
    prompt: 'What does this sign tell you to do?',
    options: ['The right lane must turn right', 'Keep to the right of the island or obstruction ahead', 'Slower traffic keep right'],
    answer: 1,
    explanation: 'Drive on the right side of the traffic island, median, or obstruction ahead.',
  },
  {
    key: 'merge', figure: 'merge', objective: 'Merge sign', difficulty: 'medium',
    prompt: 'What does this sign warn you about?',
    options: ['Traffic will merge into your lane ahead; adjust speed and space so it can merge smoothly', 'The road ends ahead', 'A lane for buses only'],
    answer: 0,
    explanation: 'Another lane of traffic joins yours ahead. Watch for merging cars and leave room so traffic can merge smoothly.',
  },
  {
    key: 'two-way-traffic', figure: 'two-way-traffic', objective: 'Two-way traffic sign', difficulty: 'medium',
    prompt: 'What does this sign mean?',
    options: ['One-way street ahead', 'A divided highway begins', 'Two-way traffic ahead; traffic will come toward you'],
    answer: 2,
    explanation: 'The road ahead carries traffic in both directions. Stay to the right and watch for oncoming cars.',
  },
  {
    key: 'curve-right', figure: 'curve-right', objective: 'Curve warning sign', difficulty: 'easy',
    prompt: 'What does this sign warn you about?',
    options: ['The road curves to the right ahead; slow down before the curve', 'Right turn only', 'A detour to the right'],
    answer: 0,
    explanation: 'The road curves ahead. Slow down before you enter the curve, not in the middle of it.',
  },
  {
    key: 'slippery', figure: 'slippery', objective: 'Slippery when wet sign', difficulty: 'easy',
    prompt: 'What does this sign warn you about?',
    options: ['Gravel road ahead', 'The road is slippery when wet; slow down and avoid sudden moves', 'A car wash ahead'],
    answer: 1,
    explanation: 'The road gets slippery when wet. In rain, slow down, leave extra space, and avoid hard braking or sharp steering.',
  },
  {
    key: 'signal-ahead', figure: 'signal-ahead', objective: 'Signal ahead sign', difficulty: 'easy',
    prompt: 'What does this sign warn you about?',
    options: ['A railroad crossing ahead', 'A traffic signal is ahead; be ready to stop', 'The signal is out of order'],
    answer: 1,
    explanation: 'A traffic light is ahead, often around a curve or over a hill. Be ready to stop.',
  },
  {
    key: 'stop-ahead', figure: 'stop-ahead', objective: 'Stop ahead sign', difficulty: 'easy',
    prompt: 'What does this sign warn you about?',
    options: ['Stop here, right now', 'A stop sign is ahead; be ready to stop', 'Stopping on the shoulder is allowed'],
    answer: 1,
    explanation: 'A stop sign is ahead that may be hard to see. Slow down and get ready to stop.',
  },
  {
    key: 'speed-limit', figure: 'speed-limit', objective: 'Speed limit sign', difficulty: 'medium',
    prompt: 'What does this sign tell you?',
    options: ['The minimum speed you must drive', 'A suggested speed for trucks only', 'The maximum speed in good conditions; drive slower when conditions call for it'],
    answer: 2,
    explanation: 'A speed limit is the most you may drive in good conditions. In rain, fog, traffic, or other hazards, drive slower.',
  },
  {
    key: 'road-work', figure: 'road-work', objective: 'Work zone sign', difficulty: 'easy',
    prompt: 'What does an orange sign like this mean?',
    options: ['Road work or a work zone is ahead; slow down and watch for workers', 'A detour for a parade', 'A school zone ahead'],
    answer: 0,
    explanation: 'Orange signs mark work zones. Slow down, follow the signs and flaggers, and watch for workers and equipment.',
  },
  {
    key: 'slow-moving-vehicle', figure: 'slow-moving-vehicle', objective: 'Slow-moving vehicle emblem', difficulty: 'medium',
    prompt: 'You see this emblem on the back of a vehicle ahead. What does it mean?',
    options: ['The vehicle carries hazardous materials', 'The vehicle moves slowly, usually 25 mph or less; slow down and pass only when it is safe and legal', 'The vehicle is a school bus'],
    answer: 1,
    explanation: 'This orange-and-red triangle marks a slow-moving vehicle, such as farm equipment, that usually travels 25 mph or less. Slow down early.',
  },
  {
    key: 'no-passing-zone', figure: 'no-passing-zone', objective: 'No passing zone sign', difficulty: 'medium',
    prompt: 'What does this pennant-shaped sign mark?',
    options: ['A detour', 'The start of a no-passing zone', 'A parade route'],
    answer: 1,
    explanation: 'This pennant, posted on the left side of the road, marks where a no-passing zone begins.',
  },
  {
    key: 'double-solid-yellow', figure: 'double-solid-yellow', objective: 'Double solid yellow lines', difficulty: 'medium',
    prompt: 'You are in the blue car. What do these double solid yellow center lines mean?',
    options: ['You may pass if the car ahead is slow', 'Do not cross these lines to pass', 'Only trucks may cross them'],
    answer: 1,
    explanation: 'Two solid yellow lines mean no passing in either direction. You may cross them only to turn left where it is allowed, such as into a driveway.',
  },
  {
    key: 'broken-yellow-your-side', figure: 'broken-yellow-your-side', objective: 'Solid and broken yellow lines', difficulty: 'hard',
    prompt: 'You are in the blue car. The center has a broken yellow line on your side and a solid one on the other side. What does that mean for you?',
    options: ['You may pass when it is safe, because the broken line is on your side', 'No one may pass', 'Only oncoming traffic may pass'],
    answer: 0,
    explanation: 'You may pass when the broken line is on your side and it is safe. Drivers with the solid line on their side may not pass.',
  },
  {
    key: 'two-way-left-turn-lane', figure: 'two-way-left-turn-lane', objective: 'Two-way left-turn lane', difficulty: 'hard',
    prompt: 'What is the center lane in this picture for?',
    options: ['Passing slower cars', 'Left turns by traffic from both directions', 'Parking and loading'],
    answer: 1,
    explanation: 'A center lane with solid and broken yellow lines and turn arrows is a shared left-turn lane. Use it only to start or finish a left turn, never to pass or travel.',
  },
];
