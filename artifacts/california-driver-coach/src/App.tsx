import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Download,
  Gauge,
  HeartHandshake,
  Home,
  Info,
  LampDesk,
  LifeBuoy,
  ListChecks,
  LockKeyhole,
  LocateFixed,
  Menu,
  MapPin,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  Route as RouteIcon,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  SunMedium,
  Target,
  Timer,
  UserRound,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreatePracticeRoute, type PracticeRoute } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PracticeHub, type PracticeAnswer } from '@/components/practice-hub';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { questionBank } from '@/data/question-bank';
import NotFound from '@/pages/not-found';

type Topic = { topic: string; mastery: number; questions: number };
type PracticeQuestion = { prompt: string; options: string[]; answer: number; explanation: string; topic: string };
type Scenario = { situation: string; choices: string[]; bestChoice: number; coaching: string };
type DriveMission = { title: string; detail: string; category: string; minutes: number; completed: boolean };
type DriveSession = { date: string; minutes: number; night: boolean; notes: string; distanceMiles?: number; skills?: string[]; routeTitle?: string };
type ParentPrompt = { title: string; copy: string; done: boolean };
type AppState = {
  profile: { name: string; permitDate: string; targetTestDate: string };
  topics: Topic[];
  answers: Record<number, boolean>;
  practiceProgress: Record<string, PracticeAnswer>;
  scenarios: Scenario[];
  scenarioAnswers: Record<number, number>;
  missions: DriveMission[];
  sessions: DriveSession[];
  prompts: ParentPrompt[];
  settings: { parentMode: boolean; reminders: boolean; sounds: boolean };
};

const initialState: AppState = {
  profile: { name: 'Maya', permitDate: '2026-04-14', targetTestDate: '2026-11-18' },
  topics: [
    { topic: 'Right-of-way', mastery: 72, questions: 18 },
    { topic: 'Signs & signals', mastery: 84, questions: 21 },
    { topic: 'Safe speed', mastery: 58, questions: 14 },
    { topic: 'Sharing the road', mastery: 46, questions: 11 },
  ],
  answers: {},
  practiceProgress: {},
  scenarios: [
    { situation: 'You are turning left at a green light. A pedestrian has stepped into the crosswalk, and the car behind you is close.', choices: ['Turn before the pedestrian reaches your lane', 'Stop behind the limit line and let the pedestrian cross', 'Honk so the pedestrian knows you are waiting'], bestChoice: 1, coaching: 'A patient pause is the safest move. People in a crosswalk have the right-of-way, even when traffic is waiting behind you.' },
    { situation: 'Rain starts on a familiar road. The posted limit is 45 mph and your visibility is getting worse.', choices: ['Keep 45 mph because it is the legal limit', 'Slow down enough to see and stop comfortably', 'Turn on hazard lights and continue at 45 mph'], bestChoice: 1, coaching: 'The speed limit is not a target in every condition. Choose a speed that lets you see, react, and keep a generous following distance.' },
    { situation: 'You are approaching a four-way stop at the same time as another driver on your right.', choices: ['Go first because you are already rolling', 'Wave them through, then go when clear', 'Yield to the driver on your right'], bestChoice: 2, coaching: 'At an all-way stop, the driver who arrived first goes first. If arrival is at the same time, yield to the driver on your right.' },
  ],
  scenarioAnswers: {},
  missions: [
    { title: 'Smooth starts & stops', detail: 'Practice gentle acceleration and braking on a quiet street.', category: 'Control', minutes: 25, completed: true },
    { title: 'Lane-change rhythm', detail: 'Mirror, signal, shoulder check, then move with space.', category: 'Awareness', minutes: 30, completed: false },
    { title: 'Neighborhood navigation', detail: 'Plan a three-turn loop and narrate what you see ahead.', category: 'Navigation', minutes: 35, completed: false },
    { title: 'Busy intersection scan', detail: 'Approach, identify hazards, and make two calm left turns.', category: 'Judgment', minutes: 30, completed: false },
    { title: 'Night-drive basics', detail: 'With an adult, practice headlights, glare, and slower speeds.', category: 'Night', minutes: 25, completed: false },
  ],
  sessions: [
    { date: '2025-06-01', minutes: 55, night: false, notes: 'Quiet streets and three-point turns.' },
    { date: '2025-06-08', minutes: 65, night: false, notes: 'Lane changes on the boulevard.' },
    { date: '2025-06-15', minutes: 45, night: true, notes: 'Sunset route; practiced headlights.' },
    { date: '2025-06-22', minutes: 70, night: false, notes: 'Parking lot control and neighborhood loop.' },
  ],
  prompts: [
    { title: 'Ask for a calm replay', copy: 'After a tricky moment, ask: “What did you notice first?” before offering your answer.', done: false },
    { title: 'Name the win', copy: 'Call out one specific choice that felt safe or smooth today.', done: true },
    { title: 'Set the next tiny goal', copy: 'Pick one skill for the next drive, not a whole list.', done: false },
    { title: 'Keep the cabin quiet', copy: 'Save corrections for a safe stop. A calm driver learns faster.', done: false },
  ],
  settings: { parentMode: false, reminders: true, sounds: false },
};

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/practice', label: 'Permit practice', icon: BookOpen },
  { href: '/scenarios', label: 'Real-world scenarios', icon: Compass },
  { href: '/drive', label: 'Drive practice', icon: RouteIcon },
  { href: '/parent', label: 'Parent view', icon: HeartHandshake },
];

const queryClient = new QueryClient();

function getStoredState(): AppState {
  if (typeof window === 'undefined') return initialState;
  try {
    const saved = window.localStorage.getItem('california-driver-coach');
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
  } catch {
    return initialState;
  }
}

function ProgressBar({ value, color = 'bg-[hsl(var(--accent))]' }: { value: number; color?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]" aria-label={`${value}% complete`}><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function ActionButton({ children, onClick, href, variant = 'primary', className = '', disabled = false, type = 'button', testId }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'secondary' | 'quiet' | 'outline'; className?: string; disabled?: boolean; type?: 'button' | 'submit'; testId: string }) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 ${variant === 'primary' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:shadow-md' : variant === 'secondary' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]' : variant === 'outline' ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'} ${className}`;
  if (href) return <Link href={href} className={classes} data-testid={testId}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={classes} data-testid={testId}>{children}</button>;
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div className="max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]"><span className="h-px w-7 bg-[hsl(var(--accent))]" />{eyebrow}</div>
      <h1 className="font-display text-4xl leading-[1.05] tracking-[-.03em] text-[hsl(var(--foreground))] md:text-5xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p>
    </div>
    {action}
  </header>;
}

function Shell({ children, state, setState }: { children: ReactNode; state: AppState; setState: (next: AppState) => void }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItems.find((item) => item.href === location)?.label ?? 'Settings';
  const initials = state.profile.name.slice(0, 1).toUpperCase();
  const toggleParent = () => {
    const next = !state.settings.parentMode;
    setState({ ...state, settings: { ...state.settings, parentMode: next } });
    setLocation(next ? '/parent' : '/');
  };
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-10 flex items-center justify-between px-2">
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3" data-testid="link-brand">
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><RouteIcon size={21} strokeWidth={2.5} /></div>
          <div><div className="font-display text-[17px] leading-none">coastwise</div><div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.18em] opacity-60">driver coach</div></div>
        </Link>
        <button className="text-white/60 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={20} /></button>
      </div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-white/40">Your path</div>
      <nav className="space-y-1">
        {navItems.map((item) => { const Icon = item.icon; const active = location === item.href; return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? 'bg-[hsl(var(--sidebar-accent))] text-white' : 'text-white/64 hover:bg-white/8 hover:text-white'}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={18} className={active ? 'text-[hsl(var(--sidebar-primary))]' : 'text-white/55'} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />}</Link>; })}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-[hsl(var(--sidebar-primary))]" />Safe progress</div>
          <p className="text-[11px] leading-5 text-white/55">Small, repeatable practice beats one stressful cram session.</p>
        </div>
        <Link href="/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/65 hover:bg-white/8 hover:text-white" data-testid="link-settings"><Settings size={18} />Settings</Link>
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary))] text-sm font-extrabold text-[hsl(var(--sidebar-primary-foreground))]" data-testid="avatar-student">{initials}</div>
          <div className="min-w-0"><div className="truncate text-sm font-bold" data-testid="text-sidebar-name">{state.profile.name}</div><div className="text-[10px] text-white/45">Student plan</div></div>
        </div>
      </div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.35)] md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" data-testid="button-mobile-overlay" />}
    <main className="md:pl-[248px]">
      <div className="mx-auto max-w-[1380px] px-5 pb-12 md:px-10">
        <div className="flex h-[76px] items-center justify-between border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21} /></button><span className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{current}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={toggleParent} className="hidden items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] sm:flex" data-testid="button-toggle-parent-view"><HeartHandshake size={15} className="text-[hsl(var(--accent))]" />{state.settings.parentMode ? 'Student view' : 'Parent view'}</button>
            <Link href="/settings" className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Open settings" data-testid="button-header-settings"><Settings size={19} /></Link>
          </div>
        </div>
        <div className="animate-rise pt-8">{children}</div>
      </div>
    </main>
  </div>;
}

function SafetyNote() {
  return <div className="flex gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><Info size={17} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><p><strong className="text-[hsl(var(--foreground))]">A note on safety.</strong> Coastwise is educational and is not the DMV. It never replaces a licensed instructor, the California Driver’s Handbook, or an attentive supervising adult.</p></div>;
}

function Dashboard({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const totalMinutes = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const nightMinutes = state.sessions.filter((session) => session.night).reduce((sum, session) => sum + session.minutes, 0);
  const permitAnswers = Object.values(state.practiceProgress);
  const permitCoverage = permitAnswers.length / questionBank.length;
  const permitAccuracy = permitAnswers.length ? permitAnswers.filter((answer) => answer.correct).length / permitAnswers.length : 0;
  const overall = permitAnswers.length ? Math.round((permitCoverage * 0.45 + permitAccuracy * 0.55) * 100) : Math.round(state.topics.reduce((sum, topic) => sum + topic.mastery, 0) / state.topics.length);
  const daysToTest = Math.max(0, Math.ceil((new Date(state.profile.targetTestDate).getTime() - Date.now()) / 86400000));
  const nextMission = state.missions.find((mission) => !mission.completed);
  const toggleMission = () => { if (!nextMission) return; setState({ ...state, missions: state.missions.map((mission) => mission.title === nextMission.title ? { ...mission, completed: true } : mission) }); };
  return <div>
    <section className="relative overflow-hidden rounded-[26px] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))] shadow-xl md:p-9">
      <div className="absolute -right-8 -top-14 h-56 w-56 rounded-full border-[22px] border-[hsl(var(--sidebar-primary)/.23)]" /><div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full border-[14px] border-[hsl(var(--accent)/.18)]" />
      <div className="relative max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--sidebar-primary))]"><Sparkles size={15} />{daysToTest > 0 ? `${daysToTest} days to your test target` : 'Test target is here'}</div>
        <h1 className="font-display text-4xl leading-[1.03] tracking-[-.035em] md:text-6xl">One clear road<br />to feeling ready.</h1>
        <p className="mt-5 max-w-lg text-sm leading-6 text-white/68">Good morning, {state.profile.name}. Your next best step is small, specific, and already waiting.</p>
        <div className="mt-7 flex flex-wrap gap-3"><ActionButton href="/practice" variant="secondary" testId="button-start-practice">Start practice <ArrowRight size={16} /></ActionButton><ActionButton href="/drive" variant="quiet" className="text-white/75 hover:bg-white/10 hover:text-white" testId="button-view-drive">View drive plan</ActionButton></div>
      </div>
    </section>
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 soft-shadow md:p-7">
        <div className="flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--accent))]"><Target size={15} />Today's next action</div><h2 className="font-display text-3xl">Learn the lane-change rhythm</h2></div><div className="rounded-xl bg-[hsl(var(--secondary))] p-3 text-[hsl(var(--primary))]"><RouteIcon size={23} /></div></div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Before your next drive, run through mirror → signal → shoulder check → move. Then practice it twice on a quiet road.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3"><ActionButton onClick={toggleMission} variant={nextMission ? 'primary' : 'outline'} disabled={!nextMission} testId="button-complete-next-action">{nextMission ? <><Check size={16} />Mark mission complete</> : 'All missions complete'}</ActionButton><span className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]"><Clock3 size={14} />30 min · Awareness</span></div>
      </section>
      <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.5)] p-6">
        <div className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Readiness pulse</div><div className="mt-3 flex items-end gap-2"><span className="font-display text-5xl">{overall}%</span><span className="mb-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]">permit topics</span></div><ProgressBar value={overall} color="bg-[hsl(var(--primary))]" /><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">You are building consistency. Focus next on safe speed and sharing the road.</p><Link href="/practice" className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-readiness-practice">See topic breakdown <ChevronRight size={14} /></Link>
      </section>
    </div>
    <section className="mt-6 grid gap-5 md:grid-cols-3">
      {[{ label: 'Supervised hours', value: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`, sub: 'of 50 required', icon: Timer, href: '/drive', color: 'text-[hsl(var(--accent))]' }, { label: 'Night hours', value: `${Math.floor(nightMinutes / 60)}h ${nightMinutes % 60}m`, sub: 'of 10 required', icon: Moon, href: '/drive', color: 'text-[hsl(var(--primary))]' }, { label: 'Practice streak', value: '4 days', sub: 'keep the calm going', icon: Award, href: '/practice', color: 'text-[hsl(var(--chart-3))]' }].map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className="group rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 hover:-translate-y-1 hover:shadow-md" data-testid={`card-dashboard-${item.label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-center justify-between"><Icon size={19} className={item.color} /><ArrowRight size={15} className="text-[hsl(var(--muted-foreground))] transition-transform group-hover:translate-x-1" /></div><div className="mt-5 font-display text-3xl">{item.value}</div><div className="mt-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{item.label} · {item.sub}</div></Link>; })}</section>
    <section className="mt-8 grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div><PageHeader eyebrow="Keep perspective" title="The requirements, made human." copy="California asks for time behind the wheel, not perfection on day one." /><SafetyNote /></div><div className="grid gap-3 sm:grid-cols-3 lg:pt-14">{[{ value: '6 mo', label: 'permit held before drive test' }, { value: '50 hr', label: 'supervised practice' }, { value: '10 hr', label: 'of that practice at night' }].map((item) => <div key={item.value} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="font-mono-ui text-2xl font-medium text-[hsl(var(--accent))]">{item.value}</div><p className="mt-3 text-xs font-semibold leading-5 text-[hsl(var(--muted-foreground))]">{item.label}</p></div>)}</div></section>
  </div>;
}

function LegacyPractice({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [index, setIndex] = useState(0);
  const question: PracticeQuestion[] = [
    { prompt: 'You are driving in a residential area and see a child near the curb with a ball in the street. What is the safest first move?', options: ['Maintain your speed and sound the horn', 'Slow down and prepare to stop', 'Move into the opposite lane immediately', 'Stop only if the child steps into the lane'], answer: 1, explanation: 'Slow down early and cover the brake. A child near the road is an unpredictable hazard, so create time and space before you know what they will do.', topic: 'Safe speed' },
    { prompt: 'When is it legal to enter a bicycle lane to make a right turn?', options: ['Never; bicycle lanes are always off-limits', 'Only after checking and when within 200 feet of the turn', 'Whenever traffic is backed up', 'Only when a cyclist waves you in'], answer: 1, explanation: 'You may enter a bicycle lane when safe and necessary to make a turn, generally within 200 feet of the turn. Always check for cyclists first.', topic: 'Sharing the road' },
    { prompt: 'At an uncontrolled intersection, you arrive at the same time as a vehicle to your right. Who has the right-of-way?', options: ['You, because you are going straight', 'The vehicle to your right', 'The vehicle traveling faster', 'Whoever flashes headlights first'], answer: 1, explanation: 'When vehicles arrive at the same time, yield to the vehicle on your right. Making eye contact does not replace yielding.', topic: 'Right-of-way' },
    { prompt: 'A solid yellow line is next to a broken yellow line. What does the broken-line side indicate?', options: ['Passing is permitted when safe', 'Passing is never permitted', 'The road is one-way', 'Only motorcycles may pass'], answer: 0, explanation: 'If the broken yellow line is on your side, you may pass when it is safe and legal. Check sight distance, traffic, and signs before committing.', topic: 'Signs & signals' },
  ];
  const chosen = state.answers[index];
  const choose = (option: number) => {
    if (chosen !== undefined) return;
    const correct = option === question[index].answer;
    const topic = question[index].topic;
    const topics = state.topics.map((item) => item.topic === topic ? { ...item, questions: item.questions + 1, mastery: Math.min(100, Math.round(item.mastery + (correct ? 4 : 1))) } : item);
    setState({ ...state, answers: { ...state.answers, [index]: correct }, topics });
  };
  return <div><PageHeader eyebrow="Adaptive permit practice" title="Practice with a reason, not a score." copy="One question at a time. Every explanation points back to the judgment California drivers need on the road." action={<div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><Gauge size={16} />{Object.keys(state.answers).length} answered</div>} />
    <div className="grid gap-6 lg:grid-cols-[1.5fr_.7fr]">
      <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 soft-shadow md:p-8">
        <div className="mb-7 flex items-center justify-between"><div className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">QUESTION {String(index + 1).padStart(2, '0')} / {String(question.length).padStart(2, '0')}</div><div className="w-32"><ProgressBar value={((index + 1) / question.length) * 100} color="bg-[hsl(var(--accent))]" /></div></div>
        <div className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">{question[index].topic}</div><h2 className="max-w-2xl font-display text-3xl leading-tight">{question[index].prompt}</h2>
        <div className="mt-7 space-y-3">{question[index].options.map((option, optionIndex) => { const isSelected = chosen !== undefined && optionIndex === question[index].answer; const isWrong = chosen !== undefined && optionIndex !== question[index].answer && state.answers[index] === false; return <button key={option} onClick={() => choose(optionIndex)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm font-semibold ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : isWrong ? 'border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.08)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.4)]'}`} data-testid={`button-answer-${index}-${optionIndex}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono-ui text-[11px] ${isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'border-[hsl(var(--border))]'}`}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{isSelected && <Check size={16} className="ml-auto shrink-0" />}</button>; })}</div>
        {chosen !== undefined && <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.65)] p-5 animate-fade"><div className="flex items-center gap-2 text-sm font-extrabold text-[hsl(var(--primary))]">{chosen ? <CheckCircle2 size={18} /> : <CircleHelp size={18} />} {chosen ? 'Good call.' : 'Not quite — this is a useful one to remember.'}</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{question[index].explanation}</p></div>}
        <div className="mt-7 flex justify-between gap-3"><ActionButton onClick={() => setIndex(Math.max(0, index - 1))} variant="quiet" disabled={index === 0} testId="button-previous-question">Previous</ActionButton><ActionButton onClick={() => setIndex((index + 1) % question.length)} disabled={chosen === undefined} testId="button-next-question">{index === question.length - 1 ? 'Start again' : 'Next question'} <ArrowRight size={16} /></ActionButton></div>
      </section>
      <aside className="space-y-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><LampDesk size={15} />Coach note</div><p className="mt-4 font-display text-2xl leading-snug">“A safe answer usually buys you more time and space.”</p><p className="mt-4 text-xs leading-5 text-white/60">When two answers feel possible, choose the one that protects the most vulnerable person first.</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="mb-5 flex items-center justify-between"><h3 className="font-display text-xl">Topic pulse</h3><Link href="/settings" className="text-[hsl(var(--muted-foreground))]" aria-label="Settings" data-testid="link-practice-settings"><Settings size={16} /></Link></div>{state.topics.map((topic) => <div key={topic.topic} className="mb-4 last:mb-0"><div className="mb-2 flex justify-between text-xs font-bold"><span>{topic.topic}</span><span className="font-mono-ui text-[hsl(var(--muted-foreground))]">{topic.mastery}%</span></div><ProgressBar value={topic.mastery} color={topic.mastery > 70 ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))]'} /></div>)}</div></aside>
    </div>
  </div>;
}

function Practice({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  return <PracticeHub answers={state.practiceProgress} onAnswer={(question, selected) => {
    const previous = state.practiceProgress[question.id];
    const correct = selected === question.answer;
    const correctStreak = correct ? (previous?.correctStreak ?? 0) + 1 : 0;
    const reviewIntervals = [1, 3, 7, 14, 30];
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + (correct ? reviewIntervals[Math.min(correctStreak - 1, reviewIntervals.length - 1)] : 1));
    setState({
      ...state,
      practiceProgress: {
        ...state.practiceProgress,
        [question.id]: {
          selected,
          correct,
          answeredAt: new Date().toISOString(),
          attempts: (previous?.attempts ?? 0) + 1,
          correctStreak,
          nextReviewAt: nextReviewAt.toISOString(),
        },
      },
    });
  }} />;
}

function Scenarios({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [index, setIndex] = useState(0);
  const scenario = state.scenarios[index];
  const chosen = state.scenarioAnswers[index];
  const choose = (choice: number) => { if (chosen === undefined) setState({ ...state, scenarioAnswers: { ...state.scenarioAnswers, [index]: choice } }); };
  return <div><PageHeader eyebrow="Real-world decisions" title="Build your calm before the traffic does." copy="These are the moments that do not fit neatly into a flashcard. Read the situation, choose your move, then see the coach's reasoning." action={<div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold"><ShieldCheck size={16} className="text-[hsl(var(--accent))]" />Decision practice</div>} />
    <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 soft-shadow md:p-9"><div className="flex items-center justify-between"><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">SCENARIO {String(index + 1).padStart(2, '0')} / 03</span><div className="flex gap-1.5">{state.scenarios.map((_, itemIndex) => <button key={itemIndex} onClick={() => setIndex(itemIndex)} className={`h-2 rounded-full ${itemIndex === index ? 'w-8 bg-[hsl(var(--accent))]' : 'w-2 bg-[hsl(var(--muted))]'}`} aria-label={`Go to scenario ${itemIndex + 1}`} data-testid={`button-scenario-tab-${itemIndex}`} />)}</div></div><div className="mt-10 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-5 md:p-7"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]"><Compass size={15} />Picture this</div><h2 className="font-display text-3xl leading-tight md:text-4xl">{scenario.situation}</h2></div><div className="mt-6 space-y-3">{scenario.choices.map((choice, choiceIndex) => { const correct = chosen !== undefined && choiceIndex === scenario.bestChoice; const wrong = chosen !== undefined && chosen === choiceIndex && !correct; return <button key={choice} onClick={() => choose(choiceIndex)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-semibold ${correct ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]' : wrong ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent)/.08)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-scenario-choice-${index}-${choiceIndex}`}><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{String.fromCharCode(65 + choiceIndex)}</span><span>{choice}</span>{correct && <CheckCircle2 className="ml-auto text-[hsl(var(--primary))]" size={18} />}</button>; })}</div>{chosen !== undefined && <div className="mt-6 border-l-2 border-[hsl(var(--accent))] pl-4 animate-fade"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">{chosen === scenario.bestChoice ? 'Coach agrees' : 'Coach perspective'}</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{scenario.coaching}</p></div>}<div className="mt-7 flex justify-end"><ActionButton onClick={() => setIndex((index + 1) % state.scenarios.length)} disabled={chosen === undefined} testId="button-next-scenario">Next scenario <ArrowRight size={16} /></ActionButton></div></section><aside className="space-y-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><LifeBuoy size={15} />The calm rule</div><p className="font-display text-2xl leading-snug">When in doubt, make the situation simpler.</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Slow down. Look farther ahead. Create space. Good judgment is often less about a clever move and more about removing urgency.</p></div><SafetyNote /></aside></div>
  </div>;
}

function Drive({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), minutes: '30', night: false, notes: '' });
  const [routeOptions, setRouteOptions] = useState<{ durationMinutes: 20 | 35 | 50; difficulty: 'beginner' | 'intermediate' | 'advanced'; skills: Array<'turns' | 'lane-changes' | 'intersections' | 'parking' | 'speed-control'> }>({ durationMinutes: 35, difficulty: 'beginner', skills: ['turns', 'intersections'] });
  const [plannedRoute, setPlannedRoute] = useState<PracticeRoute | null>(null);
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [currentCue, setCurrentCue] = useState('Route ready. Start only when the supervising adult says it is safe.');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState('');
  const [recordedVideoType, setRecordedVideoType] = useState('video/webm');
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const lastPositionAt = useRef<number | null>(null);
  const nextStepIndex = useRef(0);
  const pausedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const cameraPreview = useRef<HTMLVideoElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recordedVideoUrlRef = useRef('');
  const videoChunks = useRef<Blob[]>([]);
  const createRoute = useCreatePracticeRoute();
  const total = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const night = state.sessions.filter((session) => session.night).reduce((sum, session) => sum + session.minutes, 0);
  const completed = state.missions.filter((mission) => mission.completed).length;
  const averageSpeed = elapsedSeconds > 0 ? distanceMiles / (elapsedSeconds / 3600) : 0;
  const skillLabels: Record<string, string> = { turns: 'Turns', 'lane-changes': 'Lane changes', intersections: 'Intersections', parking: 'Parking', 'speed-control': 'Speed control' };
  const coaching: Record<string, string> = {
    turns: 'Coach cue: slow before the turn, scan the crosswalk, and look through the turn.',
    'lane-changes': 'Coach cue: mirror, signal, shoulder check, then move when the space is clear.',
    intersections: 'Coach cue: cover the brake and scan left, right, then left again.',
    parking: 'Coach cue: the adult must first confirm a legal, safe practice space. Then move slowly and check all around the vehicle.',
    'speed-control': 'Coach cue: keep a steady speed with enough space to stop smoothly.',
  };
  const speak = (message: string) => {
    setCurrentCue(message);
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };
  const planRoute = () => {
    if (!navigator.geolocation) {
      setTrackingError('Location is not available in this browser. A route must be created before departure.');
      return;
    }
    setTrackingError('');
    navigator.geolocation.getCurrentPosition((position) => {
      createRoute.mutate({ data: { latitude: position.coords.latitude, longitude: position.coords.longitude, ...routeOptions } }, {
        onSuccess: (route) => {
          setPlannedRoute(route);
          setCurrentCue('Route ready. Review it with the supervising adult before starting.');
        },
        onError: () => setTrackingError('A route could not be created right now. Check your connection and try again.'),
      });
    }, () => setTrackingError('Location permission is needed to create a route around your current area.'), { enableHighAccuracy: true, timeout: 10000 });
  };
  const teardownLiveResources = () => {
    sessionActiveRef.current = false;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    mediaRecorder.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    window.speechSynthesis?.cancel();
  };
  const stopTracking = () => {
    teardownLiveResources();
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    if (startedAt && elapsedSeconds > 0 && plannedRoute) {
      const practiced = plannedRoute.skills.map((skill) => skillLabels[skill] ?? skill);
      setState({ ...state, sessions: [{ date: new Date(startedAt).toISOString().slice(0, 10), minutes, night: false, distanceMiles, skills: practiced, routeTitle: `${routeOptions.difficulty} coached route`, notes: `Voice route · ${distanceMiles.toFixed(1)} miles · ${practiced.join(', ')}` }, ...state.sessions] });
    }
    setTracking(false);
    setPaused(false);
    pausedRef.current = false;
    setPlannedRoute(null);
  };
  const startRoadRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
    try {
      if (recordedVideoUrlRef.current) URL.revokeObjectURL(recordedVideoUrlRef.current);
      recordedVideoUrlRef.current = '';
      setRecordedVideoUrl('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!sessionActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      videoChunks.current = [];
      const preferredType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) videoChunks.current.push(event.data); };
      recorder.onstop = () => {
        const videoType = recorder.mimeType || 'video/webm';
        const blob = new Blob(videoChunks.current, { type: videoType });
        setRecordedVideoType(videoType);
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          recordedVideoUrlRef.current = url;
          setRecordedVideoUrl(url);
        }
        videoChunks.current = [];
      };
      recorder.start(1000);
    } catch {
      setTrackingError('Voice coaching is active, but road recording is unavailable. The route can continue without video.');
    }
  };
  const startTracking = () => {
    if (!navigator.geolocation || !plannedRoute) {
      setTrackingError('Create and review a route before starting the coached drive.');
      return;
    }
    setTrackingError('');
    setDistanceMiles(0);
    setCurrentSpeed(0);
    setElapsedSeconds(0);
    setStartedAt(Date.now());
    lastPosition.current = null;
    lastPositionAt.current = null;
    nextStepIndex.current = 0;
    sessionActiveRef.current = true;
    setTracking(true);
    setPaused(false);
    pausedRef.current = false;
    speak(`Coached route started. ${coaching[plannedRoute.skills[0]]}`);
    void startRoadRecording();
    watchId.current = navigator.geolocation.watchPosition((position) => {
      if (pausedRef.current) return;
      const now = position.timestamp || Date.now();
      const previous = lastPosition.current;
      const previousAt = lastPositionAt.current;
      if (previous && previousAt) {
        const addedMiles = distanceBetween(previous.coords.latitude, previous.coords.longitude, position.coords.latitude, position.coords.longitude) / 1609.344;
        if (addedMiles < 0.1) setDistanceMiles((value) => value + addedMiles);
      }
      const speedMetersPerSecond = position.coords.speed;
      const calculatedSpeed = previous && previousAt
        ? distanceBetween(previous.coords.latitude, previous.coords.longitude, position.coords.latitude, position.coords.longitude) / ((now - previousAt) / 1000)
        : 0;
      const metersPerSecond = speedMetersPerSecond !== null && speedMetersPerSecond >= 0 ? speedMetersPerSecond : calculatedSpeed;
      setCurrentSpeed(Number.isFinite(metersPerSecond) ? metersPerSecond * 2.236936 : 0);
      lastPosition.current = position;
      lastPositionAt.current = now;
      const step = plannedRoute.steps[nextStepIndex.current];
      if (step && distanceBetween(position.coords.latitude, position.coords.longitude, step.coordinate.latitude, step.coordinate.longitude) < 180) {
        const skillCue = step.coachingSkill ? coaching[step.coachingSkill] : '';
        speak(`${step.instruction} ${skillCue}`.trim());
        nextStepIndex.current += 1;
      }
    }, () => {
      setTrackingError('GPS access was not available. Check location permission, then try again.');
      teardownLiveResources();
      setTracking(false);
      setPaused(false);
      pausedRef.current = false;
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
  };
  useEffect(() => {
    if (!tracking || paused) return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [tracking, paused]);
  useEffect(() => {
    if (cameraPreview.current) cameraPreview.current.srcObject = cameraStream;
  }, [cameraStream]);
  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    if (recordedVideoUrlRef.current) URL.revokeObjectURL(recordedVideoUrlRef.current);
  }, []);
  const addSession = (event: React.FormEvent) => { event.preventDefault(); const minutes = Number(form.minutes); if (!minutes || minutes < 1) return; setState({ ...state, sessions: [{ date: form.date, minutes, night: form.night, notes: form.notes || 'Practice drive' }, ...state.sessions] }); setForm({ date: new Date().toISOString().slice(0, 10), minutes: '30', night: false, notes: '' }); setShowForm(false); };
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    window.speechSynthesis?.cancel();
    if (!next) speak('Route coaching resumed.');
  };
  const routePolyline = plannedRoute ? (() => {
    const lats = plannedRoute.geometry.map((point) => point.latitude);
    const lons = plannedRoute.geometry.map((point) => point.longitude);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats); const minLon = Math.min(...lons); const maxLon = Math.max(...lons);
    return plannedRoute.geometry.map((point) => `${12 + ((point.longitude - minLon) / Math.max(0.00001, maxLon - minLon)) * 276},${168 - ((point.latitude - minLat) / Math.max(0.00001, maxLat - minLat)) * 156}`).join(' ');
  })() : '';
  return <div><PageHeader eyebrow="Behind the wheel" title="Practice a route with a calm voice coach." copy="A supervising adult plans the drive before departure. Once moving, short spoken cues keep the teen’s hands off the screen." action={<ActionButton onClick={() => setShowForm(!showForm)} variant="secondary" testId="button-toggle-drive-log"><Plus size={17} />Log drive</ActionButton>} />
    {!tracking && <section className="mb-6 grid gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-6 lg:grid-cols-[1fr_.9fr]">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><MapPin size={15} />Parent route setup</div><h2 className="mt-2 font-display text-3xl">Build a focused practice loop.</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Drive length<select value={routeOptions.durationMinutes} onChange={(event) => setRouteOptions({ ...routeOptions, durationMinutes: Number(event.target.value) as 20 | 35 | 50 })} className="mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-3 text-sm" data-testid="select-route-duration"><option value="20">20 minutes</option><option value="35">35 minutes</option><option value="50">50 minutes</option></select></label><label className="text-xs font-bold">Difficulty<select value={routeOptions.difficulty} onChange={(event) => setRouteOptions({ ...routeOptions, difficulty: event.target.value as typeof routeOptions.difficulty })} className="mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-3 text-sm" data-testid="select-route-difficulty"><option value="beginner">Beginner · simpler loop</option><option value="intermediate">Intermediate · varied maneuvers</option><option value="advanced">Advanced · more decision points</option></select></label></div><fieldset className="mt-5"><legend className="text-xs font-bold">Target skills</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(skillLabels).map(([value, label]) => { const selected = routeOptions.skills.includes(value as typeof routeOptions.skills[number]); return <button key={value} type="button" onClick={() => setRouteOptions({ ...routeOptions, skills: selected ? routeOptions.skills.filter((skill) => skill !== value) : [...routeOptions.skills, value as typeof routeOptions.skills[number]] })} className={`rounded-full border px-3 py-2 text-xs font-bold ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]'}`} data-testid={`button-skill-${value}`}>{selected && <Check size={12} className="mr-1 inline" />}{label}</button>; })}</div></fieldset><div className="mt-5 flex flex-wrap gap-3"><ActionButton onClick={planRoute} disabled={routeOptions.skills.length === 0 || createRoute.isPending} testId="button-create-practice-route"><RouteIcon size={16} />{createRoute.isPending ? 'Building route…' : plannedRoute ? 'Rebuild route' : 'Create route near me'}</ActionButton>{plannedRoute && <ActionButton onClick={startTracking} variant="secondary" testId="button-start-coached-route"><Video size={15} />Start voice route + road camera</ActionButton>}</div></div>
      <div>{plannedRoute ? <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]"><svg viewBox="0 0 300 180" className="h-48 w-full paper-grid" role="img" aria-label="Generated practice route preview"><polyline points={routePolyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={routePolyline.split(' ')[0]?.split(',')[0]} cy={routePolyline.split(' ')[0]?.split(',')[1]} r="7" fill="hsl(var(--accent))" /></svg><div className="grid grid-cols-2 gap-3 border-t border-[hsl(var(--border))] p-4 text-xs"><div><span className="block text-[hsl(var(--muted-foreground))]">Estimated</span><strong data-testid="text-route-duration">{Math.round(plannedRoute.durationSeconds / 60)} min</strong></div><div><span className="block text-[hsl(var(--muted-foreground))]">Distance</span><strong data-testid="text-route-distance">{(plannedRoute.distanceMeters / 1609.344).toFixed(1)} mi</strong></div></div></div> : <div className="flex h-full min-h-52 items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.25)] p-8 text-center"><div><RouteIcon className="mx-auto text-[hsl(var(--muted-foreground))]" /><p className="mt-3 text-sm font-bold">Your route preview will appear here.</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Coastwise asks the directions service for a loop beginning near the phone’s current location.</p></div></div>}</div>
    </section>}
    <section className={`mb-6 overflow-hidden rounded-2xl border ${tracking ? 'border-[hsl(var(--accent)/.45)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'} p-5 md:p-6`}>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tracking ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}><LocateFixed size={21} /></div>
           <div><div className={`text-xs font-bold uppercase tracking-[.15em] ${tracking ? 'text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--accent))]'}`}>{tracking ? paused ? 'Route paused' : 'Voice route active' : 'Hands-free route mode'}</div><h2 className="mt-1 font-display text-2xl">{tracking ? 'Eyes up. The supervising adult stays in charge.' : 'Plan first, then keep the screen quiet.'}</h2><p className={`mt-2 max-w-2xl text-xs leading-5 ${tracking ? 'text-white/65' : 'text-[hsl(var(--muted-foreground))]'}`}>{tracking ? 'The adult passenger may pause or end coaching when safely able. Spoken cues are educational and never override road signs, conditions, or adult judgment.' : 'Coastwise adds brief navigation and practice reminders, but does not replace an attentive supervising adult or licensed driving instructor.'}</p></div>
        </div>
        {tracking && <div className="flex gap-2"><ActionButton onClick={togglePause} variant="outline" className="border-white/20 bg-white/10 text-white" testId="button-pause-route">{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</ActionButton><ActionButton onClick={stopTracking} variant="secondary" testId="button-stop-gps-drive"><Square size={14} />End & save</ActionButton></div>}
      </div>
      {trackingError && <div className="mt-4 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{trackingError}</div>}
      {tracking && <><div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">{cameraStream && <div className="relative overflow-hidden rounded-xl bg-black/40"><video ref={cameraPreview} autoPlay muted playsInline className="aspect-video w-full object-cover" /><div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[.12em] text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Road camera</div></div>}<div className="flex items-start gap-3 rounded-xl bg-white/8 p-4"><Volume2 size={18} className="mt-0.5 shrink-0 text-[hsl(var(--sidebar-primary))]" /><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Latest spoken cue</div><p className="mt-1 text-sm font-semibold text-white/85" data-testid="text-current-voice-cue">{currentCue}</p></div></div></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Current speed</div><div className="mt-2 font-display text-3xl">{currentSpeed.toFixed(0)} <span className="font-sans text-sm font-bold text-white/55">mph</span></div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Miles tracked</div><div className="mt-2 font-display text-3xl">{distanceMiles.toFixed(1)} <span className="font-sans text-sm font-bold text-white/55">mi</span></div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Drive time</div><div className="mt-2 font-display text-3xl">{formatElapsed(elapsedSeconds)}</div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Average speed</div><div className="mt-2 font-display text-3xl">{averageSpeed.toFixed(0)} <span className="font-sans text-sm font-bold text-white/55">mph</span></div></div></div></>}
    </section>
    {recordedVideoUrl && <section className="mb-6 grid gap-5 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--card))] p-5 md:p-6 lg:grid-cols-[1.1fr_.9fr] animate-fade"><video src={recordedVideoUrl} controls playsInline className="aspect-video w-full rounded-xl bg-black object-cover" data-testid="video-drive-review" /><div className="flex flex-col justify-center"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><Camera size={15} />Road review</div><h2 className="mt-2 font-display text-3xl">Review while the drive is fresh.</h2><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The recording stays in this browser session unless the adult downloads it. It is not uploaded automatically.</p><div className="mt-5 flex flex-wrap gap-3"><a href={recordedVideoUrl} download={`coastwise-drive-${new Date().toISOString().slice(0, 10)}.${recordedVideoType.includes('mp4') ? 'mp4' : 'webm'}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-download-drive"><Download size={16} />Download drive</a><ActionButton onClick={() => { URL.revokeObjectURL(recordedVideoUrl); recordedVideoUrlRef.current = ''; setRecordedVideoUrl(''); }} variant="outline" testId="button-delete-drive-video">Delete recording</ActionButton></div></div></section>}
    {showForm && <form onSubmit={addSession} className="mb-6 grid gap-4 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--secondary)/.4)] p-5 md:grid-cols-4 md:items-end animate-fade"><label className="text-xs font-bold">Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" data-testid="input-drive-date" /></label><label className="text-xs font-bold">Minutes<input type="number" min="1" value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} className="mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" data-testid="input-drive-minutes" /></label><label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={form.night} onChange={(event) => setForm({ ...form, night: event.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="input-drive-night" />Night practice</label><ActionButton type="submit" testId="button-save-drive-log"><Check size={16} />Save session</ActionButton><label className="md:col-span-4 text-xs font-bold">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} placeholder="What felt different today?" className="mt-2 w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-normal" data-testid="input-drive-notes" /></label></form>}
    <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="text-xs font-bold uppercase tracking-[.14em] text-white/55">Total logged</div><div className="mt-3 font-display text-4xl">{Math.floor(total / 60)}h {total % 60}m</div><ProgressBar value={(total / 3000) * 100} color="bg-[hsl(var(--sidebar-primary))]" /><div className="mt-2 text-xs text-white/60">of 50 supervised hours</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Night practice</div><div className="mt-3 font-display text-4xl">{Math.floor(night / 60)}h {night % 60}m</div><ProgressBar value={(night / 600) * 100} color="bg-[hsl(var(--accent))]" /><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">of 10 required hours</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Missions</div><div className="mt-3 font-display text-4xl">{completed}<span className="text-2xl text-[hsl(var(--muted-foreground))]">/5</span></div><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">small skills, repeated</div></div></section>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section><div className="mb-4 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">The mission board</div><h2 className="mt-1 font-display text-3xl">Pick one for the next drive.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{completed} complete</span></div><div className="space-y-3">{state.missions.map((mission, index) => <button key={mission.title} onClick={() => setState({ ...state, missions: state.missions.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed } : item) })} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${mission.completed ? 'border-[hsl(var(--primary)/.2)] bg-[hsl(var(--secondary)/.4)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-mission-${index}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mission.completed ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{mission.completed ? <Check size={19} /> : <RouteIcon size={19} />}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-extrabold ${mission.completed ? 'line-through opacity-60' : ''}`}>{mission.title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{mission.detail}</span></span><span className="hidden text-right sm:block"><span className="block font-mono-ui text-xs">{mission.minutes}m</span><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{mission.category}</span></span></button>)}</div></section><section><div className="mb-4"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Recent log</div><h2 className="mt-1 font-display text-3xl">Your road so far.</h2></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{state.sessions.slice(0, 5).map((session, index) => <div key={`${session.date}-${index}`} className="flex items-start gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-xs font-bold"><span>{new Date(`${session.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span className="font-mono-ui text-[hsl(var(--primary))]">{session.minutes}m {session.night && '· night'}</span></div><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{session.notes}</p></div></div>)}<Link href="/drive" className="flex items-center justify-center gap-1 p-4 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.5)]" data-testid="link-drive-log">See full log <ChevronRight size={14} /></Link></div><div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">Also required:</strong> California requires 6 hours of professional driver training in addition to the 50 supervised practice hours.</div></section></div>
  </div>;
}

function Parent({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const total = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const night = state.sessions.filter((session) => session.night).reduce((sum, session) => sum + session.minutes, 0);
  const permitAnswered = Object.values(state.practiceProgress);
  const permitCorrect = permitAnswered.filter((answer) => answer.correct).length;
  const permitReadiness = permitAnswered.length ? Math.round(((permitAnswered.length / questionBank.length) * 0.45 + (permitCorrect / permitAnswered.length) * 0.55) * 100) : 0;
  const donePrompts = state.prompts.filter((prompt) => prompt.done).length;
  const togglePrompt = (index: number) => setState({ ...state, prompts: state.prompts.map((prompt, promptIndex) => promptIndex === index ? { ...prompt, done: !prompt.done } : prompt) });
  return <div><PageHeader eyebrow="Parent view" title="Coach the process, not just the result." copy="A quick read on what is going well, what is next, and how to make practice feel calm in the passenger seat." action={<div className="flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><HeartHandshake size={16} />Shared plan</div>} />
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]"><div className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><UserRound size={15} />{state.profile.name}'s permit readiness</div><div className="mt-5 font-display text-4xl">{permitReadiness}%</div><p className="mt-3 text-xs leading-5 text-white/60">{permitAnswered.length} of {questionBank.length} handbook questions covered · {permitCorrect} currently correct.</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Practice hours</div><div className="mt-4 font-display text-4xl">{Math.floor(total / 60)}h <span className="text-xl text-[hsl(var(--muted-foreground))]">of 50</span></div><ProgressBar value={(total / 3000) * 100} color="bg-[hsl(var(--primary))]" /><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{Math.floor(night / 60)}h {night % 60}m at night · 6 professional hours separate</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Permit timeline</div><div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]"><LockKeyhole size={18} className="text-[hsl(var(--primary))]" /></div><div><div className="text-sm font-extrabold">6 month hold</div><div className="text-xs text-[hsl(var(--muted-foreground))]">before the drive test</div></div></div><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Target test: <strong className="text-[hsl(var(--foreground))]">{new Date(`${state.profile.targetTestDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p></div></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section><div className="mb-4 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Coaching prompts</div><h2 className="mt-1 font-display text-3xl">Helpful words for the next drive.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{donePrompts}/{state.prompts.length} tried</span></div><div className="space-y-3">{state.prompts.map((prompt, index) => <button key={prompt.title} onClick={() => togglePrompt(index)} className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left ${prompt.done ? 'border-[hsl(var(--primary)/.2)] bg-[hsl(var(--secondary)/.4)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-parent-prompt-${index}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${prompt.done ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]'}`}>{prompt.done && <Check size={14} />}</span><span><span className={`block text-sm font-extrabold ${prompt.done ? 'line-through opacity-60' : ''}`}>{prompt.title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{prompt.copy}</span></span></button>)}</div></section><aside><div className="mb-4 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">The adult seat</div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.5)] p-6"><SunMedium size={22} className="text-[hsl(var(--accent))]" /><h3 className="mt-4 font-display text-2xl">Your calm is part of the lesson.</h3><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Give directions early, keep your voice level, and save the debrief for a safe stop. The goal is a driver who can think clearly when something changes.</p><div className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-xs font-semibold text-[hsl(var(--primary))]">Try asking: “What did you notice?”</div></div><div className="mt-4"><SafetyNote /></div></aside></div>
  </div>;
}

function SettingsPage({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [name, setName] = useState(state.profile.name);
  const saveProfile = (event: React.FormEvent) => { event.preventDefault(); if (name.trim()) setState({ ...state, profile: { ...state.profile, name: name.trim() } }); };
  const toggle = (key: 'parentMode' | 'reminders' | 'sounds') => setState({ ...state, settings: { ...state.settings, [key]: !state.settings[key] } });
  return <div><PageHeader eyebrow="Settings" title="Make the plan yours." copy="Your details stay on this device. Adjust the profile and the way Coastwise supports practice." />
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><section className="space-y-5"><form onSubmit={saveProfile} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7"><div className="mb-6 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]"><UserRound size={19} className="text-[hsl(var(--primary))]" /></div><div><h2 className="font-display text-2xl">Student profile</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">A little context keeps the dashboard relevant.</p></div></div><label className="block text-xs font-bold">Teen name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-student-name" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Permit date<input type="date" value={state.profile.permitDate} onChange={(event) => setState({ ...state, profile: { ...state.profile, permitDate: event.target.value } })} className="mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-sm" data-testid="input-permit-date" /></label><label className="text-xs font-bold">Target test date<input type="date" value={state.profile.targetTestDate} onChange={(event) => setState({ ...state, profile: { ...state.profile, targetTestDate: event.target.value } })} className="mt-2 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-sm" data-testid="input-test-date" /></label></div><ActionButton type="submit" className="mt-5" testId="button-save-profile"><Check size={16} />Save profile</ActionButton></form><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]"><Bell size={19} className="text-[hsl(var(--primary))]" /></div><div><h2 className="font-display text-2xl">Support preferences</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Gentle nudges, no pressure.</p></div></div>{[{ key: 'parentMode' as const, title: 'Parent view by default', copy: 'Open the shared coaching view first.' }, { key: 'reminders' as const, title: 'Practice reminders', copy: 'Show a reminder when a small next step is ready.' }, { key: 'sounds' as const, title: 'Completion sounds', copy: 'Keep confirmations quiet or turn them on.' }].map((item) => <button key={item.key} onClick={() => toggle(item.key)} className="flex w-full items-center justify-between border-b border-[hsl(var(--border))] py-4 text-left last:border-0" data-testid={`button-toggle-${item.key}`}><span><span className="block text-sm font-extrabold">{item.title}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{item.copy}</span></span><span className={`relative h-6 w-11 rounded-full ${state.settings[item.key] ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[hsl(var(--card))] transition-transform ${state.settings[item.key] ? 'translate-x-6' : 'translate-x-1'}`} /></span></button>)}</div></section><aside className="space-y-5"><div className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><ShieldCheck size={15} />Built for safe progress</div><h3 className="mt-4 font-display text-3xl">No account. No noise.</h3><p className="mt-3 text-sm leading-6 text-white/65">Your progress is stored locally in this browser, so the plan stays simple and private.</p><div className="mt-6 flex items-center gap-2 text-xs font-bold text-white/75"><LockKeyhole size={14} />Local-only progress</div></div><SafetyNote /><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-2 text-sm font-extrabold"><Pencil size={16} className="text-[hsl(var(--accent))]" />California essentials</div><ul className="mt-4 space-y-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />Permit held at least 6 months before the drive test.</li><li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />50 supervised practice hours, including 10 at night.</li><li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />6 hours of professional driver instruction.</li></ul></div></aside></div>
  </div>;
}

function Router() {
  const [state, setState] = useState<AppState>(getStoredState);
  useEffect(() => { window.localStorage.setItem('california-driver-coach', JSON.stringify(state)); }, [state]);
  return <Shell state={state} setState={setState}><Switch><Route path="/"><Dashboard state={state} setState={setState} /></Route><Route path="/practice"><Practice state={state} setState={setState} /></Route><Route path="/scenarios"><Scenarios state={state} setState={setState} /></Route><Route path="/drive"><Drive state={state} setState={setState} /></Route><Route path="/parent"><Parent state={state} setState={setState} /></Route><Route path="/settings"><SettingsPage state={state} setState={setState} /></Route><Route component={NotFound} /></Switch></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
