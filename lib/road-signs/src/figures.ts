/**
 * Original drawings of standard U.S. traffic signs (MUTCD designs) and
 * pavement-marking scenes. Every figure uses a 100×100 viewBox.
 */

const RED = '#C8102E';
const YELLOW = '#FFC72C';
const ORANGE = '#F47B20';
const SCHOOL_GREEN = '#C6DA2E';
const BLACK = '#111111';
const WHITE = '#FFFFFF';
const LANE_YELLOW = '#F2C230';

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

const text = (x: number, y: number, size: number, fill: string, value: string) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-family="Helvetica, Arial, sans-serif" font-weight="700" text-anchor="middle">${value}</text>`;

const diamond = (fill: string) =>
  `<polygon points="50,2 98,50 50,98 2,50" fill="${fill}"/><polygon points="50,7 93,50 50,93 7,50" fill="none" stroke="${BLACK}" stroke-width="2.5"/>`;

const squareSign = `<rect x="3" y="3" width="94" height="94" rx="5" fill="${WHITE}" stroke="${BLACK}" stroke-width="3"/>`;
const tallSign = `<rect x="14" y="3" width="72" height="94" rx="5" fill="${WHITE}" stroke="${BLACK}" stroke-width="3"/>`;

const prohibition = `<circle cx="50" cy="50" r="38" fill="none" stroke="${RED}" stroke-width="7"/><line x1="23" y1="23" x2="77" y2="77" stroke="${RED}" stroke-width="7"/>`;

const walker = (x: number, y: number, scale: number) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><circle cx="0" cy="0" r="5" fill="${BLACK}"/><path d="M0 8 L-3 28 M-3 28 L-11 44 M-3 28 L7 44 M0 12 L-9 22 M0 12 L9 20" stroke="${BLACK}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`;

const stroke = (d: string, width = 7) => `<path d="${d}" fill="none" stroke="${BLACK}" stroke-width="${width}"/>`;
const fillPoly = (points: string, fill = BLACK) => `<polygon points="${points}" fill="${fill}"/>`;

const road = `<rect width="100" height="100" fill="#4A4F55"/><rect width="12" height="100" fill="#7A9A5A"/><rect x="88" width="12" height="100" fill="#7A9A5A"/><line x1="15" y1="0" x2="15" y2="100" stroke="${WHITE}" stroke-width="1.5"/><line x1="85" y1="0" x2="85" y2="100" stroke="${WHITE}" stroke-width="1.5"/>`;
const solidYellow = (x: number) => `<line x1="${x}" y1="0" x2="${x}" y2="100" stroke="${LANE_YELLOW}" stroke-width="1.6"/>`;
const brokenYellow = (x: number) => `<line x1="${x}" y1="0" x2="${x}" y2="100" stroke="${LANE_YELLOW}" stroke-width="1.6" stroke-dasharray="8 8"/>`;
const car = (x: number, y: number, color: string, facingDown = false) =>
  `<g transform="translate(${x} ${y})${facingDown ? ' rotate(180)' : ''}"><rect x="-7" y="-12" width="14" height="24" rx="4" fill="${color}"/><rect x="-5" y="-7" width="10" height="6" rx="1.5" fill="#BFD7FF"/></g>`;
const yourCar = (x: number, y: number) => car(x, y, '#2F6FDE');
const otherCar = (x: number, y: number) => car(x, y, '#D9D9D9', true);
const turnArrow = `<path d="M54 80 V68 Q54 62 48 62" stroke="${WHITE}" stroke-width="2.5" fill="none"/><polygon points="49,57.5 42,62 49,66.5" fill="${WHITE}"/>`;

export const ROAD_FIGURES = {
  stop: {
    alt: 'Red eight-sided sign with the word STOP.',
    svg: svg(`<polygon points="94.35,31.63 94.35,68.37 68.37,94.35 31.63,94.35 5.65,68.37 5.65,31.63 31.63,5.65 68.37,5.65" fill="${WHITE}" stroke="#999" stroke-width="1"/><polygon points="90.65,33.16 90.65,66.84 66.84,90.65 33.16,90.65 9.35,66.84 9.35,33.16 33.16,9.35 66.84,9.35" fill="${RED}"/>${text(50, 59, 25, WHITE, 'STOP')}`),
  },
  yield: {
    alt: 'Downward-pointing red and white triangle with the word YIELD.',
    svg: svg(`<polygon points="3,8 97,8 50,94" fill="${RED}"/><polygon points="20,18 80,18 50,73" fill="${WHITE}"/>${text(50, 34, 11, RED, 'YIELD')}`),
  },
  'do-not-enter': {
    alt: 'Red circle with a white horizontal bar and the words DO NOT ENTER.',
    svg: svg(`<rect x="2" y="2" width="96" height="96" fill="${WHITE}" stroke="#999" stroke-width="1"/><circle cx="50" cy="50" r="44" fill="${RED}"/><rect x="14" y="43" width="72" height="14" fill="${WHITE}"/>${text(50, 34, 12, WHITE, 'DO NOT')}${text(50, 76, 12, WHITE, 'ENTER')}`),
  },
  'wrong-way': {
    alt: 'Red rectangle with white words WRONG WAY.',
    svg: svg(`<rect x="3" y="20" width="94" height="60" rx="4" fill="${RED}"/><rect x="7" y="24" width="86" height="52" rx="2" fill="none" stroke="${WHITE}" stroke-width="2"/>${text(50, 47, 17, WHITE, 'WRONG')}${text(50, 67, 17, WHITE, 'WAY')}`),
  },
  'railroad-crossbuck': {
    alt: 'Two white boards crossed in an X, reading RAILROAD CROSSING.',
    svg: svg(`<g transform="rotate(45 50 50)"><rect x="1" y="42" width="98" height="16" fill="${WHITE}" stroke="${BLACK}" stroke-width="2"/>${text(22, 54, 10, BLACK, 'RAIL')}${text(78, 54, 10, BLACK, 'ROAD')}</g><g transform="rotate(-45 50 50)"><rect x="1" y="42" width="98" height="16" fill="${WHITE}" stroke="${BLACK}" stroke-width="2"/>${text(22, 54, 10, BLACK, 'CROSS')}${text(78, 54, 10, BLACK, 'ING')}</g>`),
  },
  'railroad-advance': {
    alt: 'Round yellow sign with a black X and the letters R and R.',
    svg: svg(`<circle cx="50" cy="50" r="47" fill="${YELLOW}"/><circle cx="50" cy="50" r="43" fill="none" stroke="${BLACK}" stroke-width="2.5"/><line x1="24" y1="24" x2="76" y2="76" stroke="${BLACK}" stroke-width="6"/><line x1="76" y1="24" x2="24" y2="76" stroke="${BLACK}" stroke-width="6"/>${text(22, 57, 18, BLACK, 'R')}${text(78, 57, 18, BLACK, 'R')}`),
  },
  school: {
    alt: 'Five-sided yellow-green sign showing two walking children.',
    svg: svg(`<polygon points="50,3 96,38 96,97 4,97 4,38" fill="${SCHOOL_GREEN}"/><polygon points="50,8 91,40 91,92 9,92 9,40" fill="none" stroke="${BLACK}" stroke-width="2.5"/>${walker(38, 36, 1)}${walker(62, 44, 0.85)}`),
  },
  pedestrian: {
    alt: 'Yellow diamond sign showing a person walking.',
    svg: svg(`${diamond(YELLOW)}${walker(50, 24, 1.1)}`),
  },
  'no-u-turn': {
    alt: 'White square sign with a black U-shaped arrow crossed out by a red circle and slash.',
    svg: svg(`${squareSign}${stroke('M62 78 V46 A12 12 0 0 0 38 46 V60')}${fillPoly('29,58 47,58 38,72')}${prohibition}`),
  },
  'no-right-turn': {
    alt: 'White square sign with a black arrow turning right, crossed out by a red circle and slash.',
    svg: svg(`${squareSign}${stroke('M42 80 V48 H60')}${fillPoly('58,37 74,48 58,59')}${prohibition}`),
  },
  'keep-right': {
    alt: 'White sign with a black island shape and an arrow curving around its right side.',
    svg: svg(`${tallSign}<ellipse cx="40" cy="58" rx="9" ry="15" fill="${BLACK}"/>${stroke('M40 90 Q62 84 62 42')}${fillPoly('53,44 62,26 71,44')}`),
  },
  merge: {
    alt: 'Yellow diamond sign with a straight arrow and a second line joining it from the right.',
    svg: svg(`${diamond(YELLOW)}${stroke('M42 84 V30')}${fillPoly('32,34 42,16 52,34')}${stroke('M70 80 Q66 58 45 50')}`),
  },
  'two-way-traffic': {
    alt: 'Yellow diamond sign with two arrows side by side, one pointing up and one pointing down.',
    svg: svg(`${diamond(YELLOW)}${stroke('M40 22 V64', 6)}${fillPoly('31,62 40,80 49,62')}${stroke('M60 78 V36', 6)}${fillPoly('51,38 60,20 69,38')}`),
  },
  'curve-right': {
    alt: 'Yellow diamond sign with an arrow that bends to the right.',
    svg: svg(`${diamond(YELLOW)}${stroke('M40 82 V60 Q40 40 58 32')}${fillPoly('62,40 54,24 72,26')}`),
  },
  slippery: {
    alt: 'Yellow diamond sign showing a car with two wavy tire tracks behind it.',
    svg: svg(`${diamond(YELLOW)}<path d="M36 46 L40 34 H60 L64 46 Z" fill="${BLACK}"/><rect x="32" y="44" width="36" height="12" rx="3" fill="${BLACK}"/><rect x="34" y="55" width="7" height="6" fill="${BLACK}"/><rect x="59" y="55" width="7" height="6" fill="${BLACK}"/>${stroke('M40 64 q-7 5 0 10 t0 10', 3.5)}${stroke('M60 64 q-7 5 0 10 t0 10', 3.5)}`),
  },
  'signal-ahead': {
    alt: 'Yellow diamond sign showing a traffic light with red, yellow, and green lamps.',
    svg: svg(`${diamond(YELLOW)}<rect x="40" y="22" width="20" height="56" rx="4" fill="${BLACK}"/><circle cx="50" cy="33" r="6" fill="${RED}"/><circle cx="50" cy="50" r="6" fill="#FFD84D"/><circle cx="50" cy="67" r="6" fill="#2BA84A"/>`),
  },
  'stop-ahead': {
    alt: 'Yellow diamond sign with an upward arrow below a small red octagon.',
    svg: svg(`${diamond(YELLOW)}<polygon points="60.16,27.79 60.16,36.21 54.21,42.16 45.79,42.16 39.84,36.21 39.84,27.79 45.79,21.84 54.21,21.84" fill="${RED}"/>${stroke('M50 84 V56')}${fillPoly('41,58 50,46 59,58')}`),
  },
  'speed-limit': {
    alt: 'White rectangular sign reading SPEED LIMIT 35.',
    svg: svg(`${tallSign}${text(50, 24, 13, BLACK, 'SPEED')}${text(50, 40, 13, BLACK, 'LIMIT')}${text(50, 82, 38, BLACK, '35')}`),
  },
  'road-work': {
    alt: 'Orange diamond sign reading ROAD WORK AHEAD.',
    svg: svg(`${diamond(ORANGE)}${text(50, 40, 13, BLACK, 'ROAD')}${text(50, 56, 13, BLACK, 'WORK')}${text(50, 71, 11, BLACK, 'AHEAD')}`),
  },
  'slow-moving-vehicle': {
    alt: 'Orange triangle with a red border, shown on the back of a vehicle.',
    svg: svg(`<polygon points="50,6 96,88 4,88" fill="${RED}"/><polygon points="50,24 82,80 18,80" fill="${ORANGE}"/>`),
  },
  'no-passing-zone': {
    alt: 'Yellow pennant-shaped sign pointing right, reading NO PASSING ZONE.',
    svg: svg(`<polygon points="3,20 97,50 3,80" fill="${YELLOW}"/><polygon points="9,27 82,50 9,73" fill="none" stroke="${BLACK}" stroke-width="2"/>${text(30, 42, 8.5, BLACK, 'NO')}${text(30, 52, 8.5, BLACK, 'PASSING')}${text(30, 62, 8.5, BLACK, 'ZONE')}`),
  },
  'double-solid-yellow': {
    alt: 'Top view of a two-lane road with two solid yellow center lines. Your blue car is in the right lane; an oncoming car is in the left lane.',
    svg: svg(`${road}${solidYellow(48)}${solidYellow(52)}${otherCar(32, 28)}${yourCar(68, 70)}`),
  },
  'broken-yellow-your-side': {
    alt: 'Top view of a two-lane road. The center has a solid yellow line beside the oncoming lane and a broken yellow line beside your lane. Your blue car is in the right lane.',
    svg: svg(`${road}${solidYellow(48)}${brokenYellow(52)}${otherCar(32, 28)}${yourCar(68, 70)}`),
  },
  'two-way-left-turn-lane': {
    alt: 'Top view of a road with a center lane bordered by solid and broken yellow lines, with white turn arrows pointing in opposite directions. Your blue car is in the right lane.',
    svg: svg(`${road}${solidYellow(38.5)}${brokenYellow(41.5)}${brokenYellow(58.5)}${solidYellow(61.5)}${turnArrow}<g transform="rotate(180 50 50)">${turnArrow}</g>${otherCar(27, 22)}${yourCar(73, 80)}`),
  },
} as const satisfies Record<string, { alt: string; svg: string }>;

export type RoadFigureId = keyof typeof ROAD_FIGURES;

export function roadFigureDataUri(id: RoadFigureId) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(ROAD_FIGURES[id].svg)}`;
}
