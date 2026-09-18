import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  AlertTriangle,
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
  HardDrive,
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
  Trash2,
  Upload,
  UserRound,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreatePracticeRoute,
  useCreateDriveDebrief,
  useCreateNextDrivePlan,
  type PracticeRoute,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PracticeHub, type PracticeAnswer } from '@/components/practice-hub';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { questionBank } from '@/data/question-bank';
import { RouteMap } from '@/components/route-map';
import { useIsMobile } from '@/hooks/use-mobile';
import { deleteDriveRecording as deleteSavedDriveRecording, loadDriveRecording, requestPracticeLoop, requestReturnRoute, saveDriveRecording, type PlannedRoute, type RouteCoordinate } from '@/lib/route-coach';
import {
  appendCoachEvent,
  deleteCoachEvent,
  deleteDriveRecording,
  eventAtPlaybackTime,
  seekReviewVideo,
  type CoachEvent,
  type CoachEventKind,
} from '@/lib/drive-review';
import { getDriveReviewBrowserFixture } from '@/lib/drive-review-browser-fixture';
import { canPlayRecording, chooseRecordingMimeType, describeRecordingFormat, getRecordingBrowser } from '@/lib/drive-recording';
import { buildDriveDebriefInput } from '@/lib/ai-debrief';
import { buildNextDrivePlanInput } from '@/lib/ai-next-drive-plan';
import coastwiseLogo from '@/assets/coastwise-logo.svg';
import NotFound from '@/pages/not-found';
import { AppState, createDriveSessionId, getStoredState, initialState, isRecord, parseStoredState, storageKey, type Appearance, type DriveSession, type PracticeQuestion, type Scenario, type Topic } from '@/lib/state';
import { ActionButton, PageHeader, SafetyNote } from '@/components/shared';
import SettingsPage from '@/pages/settings';
import {
  currentMaterialPolicyNotice,
  getPolicyAcknowledgements,
  policyAcknowledgementStorageKey,
  requiresCurrentPolicyAcknowledgement,
  saveCurrentPolicyAcknowledgement,
} from '@/lib/policy-notice';

const navItems: { href: string; label: string; testId: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Today', testId: 'today', icon: Home },
  { href: '/practice', label: 'Permit & knowledge', testId: 'permit-practice', icon: BookOpen },
  { href: '/drive', label: 'Driving exam', testId: 'drive-practice', icon: RouteIcon },
  { href: '/parent', label: 'Parent view', testId: 'parent-view', icon: HeartHandshake },
];

const mobileNavItems = [
  navItems[0],
  navItems[1],
  navItems[2],
  navItems[3],
];
const queryClient = new QueryClient();

const criticalRecordingStorageBytes = 100 * 1024 * 1024;
const lowRecordingStorageBytes = 250 * 1024 * 1024;

type StorageEstimate = {
  usage: number;
  quota: number;
  available: number;
};

function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(0, Math.round(bytes / 1024 ** 2))} MB`;
}

function getTimeOfDayGreeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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

function routeProgressPercent(route: PlannedRoute, position: RouteCoordinate | null) {
  if (!position || route.coordinates.length < 2) return null;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.coordinates.forEach(([longitude, latitude], index) => {
    const distance = distanceBetween(position[1], position[0], latitude, longitude);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return Math.round((nearestIndex / (route.coordinates.length - 1)) * 100);
}


function Shell({ children, state, setState, persistenceWarning }: { children: ReactNode; state: AppState; setState: (next: AppState) => void; persistenceWarning: string }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const isMobile = useIsMobile();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavigationRef = useRef<HTMLElement | null>(null);
  const restoreMenuButtonFocus = useRef(false);
  const current = location === '/scenarios'
    ? 'Driving exam'
    : location === '/privacy'
      ? 'Privacy Policy'
      : location === '/terms'
        ? 'Terms & Safety'
        : navItems.find((item) => item.href === location)?.label ?? 'Settings';
  const initials = state.profile.name.slice(0, 1).toUpperCase();
  const toggleParent = () => {
    const next = !state.settings.parentMode;
    setState({ ...state, settings: { ...state.settings, parentMode: next } });
    setLocation(next ? '/parent' : '/');
  };
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        restoreMenuButtonFocus.current = true;
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !mobileNavigationRef.current) return;
      const focusable = Array.from(mobileNavigationRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMobile, mobileOpen]);
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const closeMobileNavigation = () => {
    restoreMenuButtonFocus.current = true;
    setMobileOpen(false);
  };
  const navigateFromMobileDrawer = () => {
    setMobileOpen(false);
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('main h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus();
    });
  };
  useEffect(() => {
    if (mobileOpen || !restoreMenuButtonFocus.current) return;
    restoreMenuButtonFocus.current = false;
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, [mobileOpen]);
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
    <aside ref={mobileNavigationRef} id="mobile-navigation" aria-label="Main navigation" aria-hidden={isMobile && !mobileOpen} inert={isMobile && !mobileOpen} className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))] shadow-[8px_0_24px_hsl(215_30%_20%/.03)] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-10 flex items-center justify-between px-2">
        <Link href="/" onClick={navigateFromMobileDrawer} className="flex items-center gap-3" data-testid="link-brand">
          <img src={coastwiseLogo} alt="" aria-hidden="true" className="h-10 w-10" />
          <div><div className="font-display text-[17px] leading-none">Coastwise</div><div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">driver coach</div></div>
        </Link>
        <button ref={closeButtonRef} className="inline-flex size-11 items-center justify-center text-[hsl(var(--muted-foreground))] md:hidden" onClick={closeMobileNavigation} aria-label="Close navigation" data-testid="button-close-navigation"><X size={20} /></button>
      </div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Your path</div>
      <nav className="space-y-1">
          {navItems.map((item) => { const Icon = item.icon; const active = location === item.href; return <Link key={item.href} href={item.href} onClick={navigateFromMobileDrawer} aria-current={active ? 'page' : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.64)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid={`link-nav-${item.testId}`}><Icon aria-hidden="true" size={18} className={active ? 'text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--sidebar-foreground)/.45)]'} /><span>{item.label}</span>{active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />}</Link>; })}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--secondary)/.5)] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} className="text-[hsl(var(--sidebar-primary))]" />Safe progress</div>
          <p className="text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">Small, repeatable practice beats one stressful cram session.</p>
        </div>
        <Link href="/settings" onClick={navigateFromMobileDrawer} aria-current={location === '/settings' ? 'page' : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.64)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--sidebar-foreground))]" data-testid="link-settings"><Settings aria-hidden="true" size={18} />Settings</Link>
        <div className="mt-4 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary))] text-sm font-extrabold text-[hsl(var(--sidebar-primary-foreground))]" data-testid="avatar-student">{initials}</div>
          <div className="min-w-0"><div className="truncate text-sm font-bold" data-testid="text-sidebar-name">{state.profile.name}</div><div className="text-[10px] text-[hsl(var(--muted-foreground))]">Student plan</div></div>
        </div>
      </div>
    </aside>
    {mobileOpen && <div aria-hidden="true" className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.35)] md:hidden" onClick={closeMobileNavigation} data-testid="button-mobile-overlay" />}
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-[hsl(var(--border)/.8)] bg-[hsl(var(--card)/.9)] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_hsl(var(--foreground)/.06)] backdrop-blur-xl md:hidden" aria-label="Primary navigation" aria-hidden={mobileOpen} inert={mobileOpen}>
      {mobileNavItems.map((item) => { const Icon = item.icon; const active = location === item.href; return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-label={item.label} aria-current={active ? 'page' : undefined} className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold ${active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`link-mobile-nav-${item.testId}`}><Icon aria-hidden="true" size={18} strokeWidth={active ? 2.5 : 2} /><span className="max-w-full truncate">{item.label.replace('Parent view', 'Parent')}</span></Link>; })}
    </nav>
    <main className="pb-20 md:pl-[248px] md:pb-0" aria-hidden={isMobile && mobileOpen} inert={isMobile && mobileOpen}>
      <div className="mx-auto max-w-[1380px] px-5 pb-12 md:px-10">
        <div className="flex h-[76px] items-center justify-between border-b border-[hsl(var(--border))]">
          <div className="flex min-w-0 items-center gap-3"><button ref={menuButtonRef} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="mobile-navigation" data-testid="button-open-navigation"><Menu aria-hidden="true" size={21} /></button><Link href="/" aria-label="Coastwise home" className="shrink-0 md:hidden" data-testid="link-mobile-brand"><img src={coastwiseLogo} alt="" aria-hidden="true" className="h-8 w-8" /></Link><span className="truncate text-sm font-semibold text-[hsl(var(--muted-foreground))]">{current}</span></div>
          <div className="flex items-center gap-2">
            <button onClick={toggleParent} className="hidden items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] sm:flex" data-testid="button-toggle-parent-view"><HeartHandshake size={15} className="text-[hsl(var(--accent))]" />{state.settings.parentMode ? 'Student view' : 'Parent view'}</button>
            <Link href="/settings" className="inline-flex size-11 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Open settings" data-testid="button-header-settings"><Settings size={19} /></Link>
          </div>
        </div>
        {persistenceWarning && <div className="mt-5 flex gap-3 rounded-2xl border border-[hsl(var(--warning)/.45)] bg-[hsl(var(--warning)/.1)] p-4 text-sm leading-6" role="alert" data-testid="local-progress-warning"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[hsl(var(--warning-foreground))]" /><div><strong>Progress is not being saved.</strong> {persistenceWarning}</div></div>}
        {!online && <div className="mt-5 flex gap-3 rounded-2xl border border-[hsl(var(--warning)/.45)] bg-[hsl(var(--warning)/.1)] p-4 text-sm leading-6" role="status" data-testid="offline-status"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-[hsl(var(--warning-foreground))]" /><div><strong>Coastwise is offline.</strong> Saved practice and loaded drive reviews still work. Connect before building a new GPS route.</div></div>}
        <div className="page-transition pt-8">{children}</div>
        <footer className="mt-12 flex flex-col gap-3 border-t border-[hsl(var(--border))] py-6 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Coastwise. Educational guidance for supervised practice.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="font-semibold hover:text-[hsl(var(--foreground))]" data-testid="link-footer-privacy">Privacy Policy</Link>
            <Link href="/terms" className="font-semibold hover:text-[hsl(var(--foreground))]" data-testid="link-footer-terms">Terms &amp; Safety</Link>
          </nav>
        </footer>
      </div>
    </main>
  </div>;
}

function MaterialPolicyNoticeDialog({ onAcknowledge }: { onAcknowledge: () => void }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keepFocusInside);
    };
  }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[hsl(var(--foreground)/.5)] p-4 backdrop-blur-sm" role="presentation">
    <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="material-policy-title" aria-describedby="material-policy-summary" className="my-auto w-full max-w-2xl rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-2xl md:p-8" data-testid="material-policy-notice">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ShieldCheck aria-hidden="true" size={22} /></div>
      <div className="mt-5 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Important update · Effective {currentMaterialPolicyNotice.effectiveDate}</div>
      <h2 ref={headingRef} tabIndex={-1} id="material-policy-title" className="mt-2 font-display text-3xl leading-tight outline-none md:text-4xl">{currentMaterialPolicyNotice.title}</h2>
      <p id="material-policy-summary" className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{currentMaterialPolicyNotice.summary}</p>
      <ul className="mt-5 space-y-3">
        {currentMaterialPolicyNotice.changes.map((change) => <li key={change} className="flex gap-3 text-sm leading-6"><CheckCircle2 aria-hidden="true" size={18} className="mt-1 shrink-0 text-[hsl(var(--primary))]" /><span>{change}</span></li>)}
      </ul>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[hsl(var(--border))] pt-5 text-sm">
        <Link href="/privacy" target="_blank" rel="noreferrer" className="font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-notice-privacy">Read Privacy Policy <span className="sr-only">(opens in a new tab)</span></Link>
        <Link href="/terms" target="_blank" rel="noreferrer" className="font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-notice-terms">Read Terms &amp; Safety <span className="sr-only">(opens in a new tab)</span></Link>
      </div>
      <button type="button" onClick={onAcknowledge} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2" data-testid="button-acknowledge-policy">I understand and agree to continue</button>
      <p className="mt-3 text-center text-xs leading-5 text-[hsl(var(--muted-foreground))]">Your acknowledgement is saved only on this device. You can review it later in Settings.</p>
    </section>
  </div>;
}


function NextDrivePlanCard({ state, setState, compact = false }: { state: AppState; setState: (next: AppState) => void; compact?: boolean }) {
  const createPlan = useCreateNextDrivePlan();
  const plan = state.nextDrivePlan;
  const generate = () => createPlan.mutate(
    { data: buildNextDrivePlanInput(state) },
    { onSuccess: (result) => setState({ ...state, nextDrivePlan: result }) },
  );
  return <section className={`overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.28)] bg-[hsl(var(--card))] ${compact ? '' : 'soft-shadow'}`} data-testid="next-drive-plan">
    <div className="flex flex-col justify-between gap-4 bg-[hsl(var(--secondary)/.42)] p-5 sm:flex-row sm:items-center md:px-6">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]"><Sparkles size={15} />Next supervised drive</div><h2 className="mt-1 font-display text-2xl">{plan ? 'One focused plan, ready when you are.' : 'Turn recent progress into a simple plan.'}</h2></div>
      <ActionButton onClick={generate} disabled={createPlan.isPending} variant={plan ? 'outline' : 'primary'} testId="button-generate-next-drive-plan">
        {createPlan.isPending ? 'Planning…' : plan ? 'Refresh plan' : 'Create my plan'}
      </ActionButton>
    </div>
    {plan ? <div className="grid gap-px bg-[hsl(var(--border))] sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-[hsl(var(--card))] p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Skill focus</div><p className="mt-2 text-sm font-extrabold leading-5" data-testid="text-next-plan-focus">{plan.skillFocus}</p></div>
      <div className="bg-[hsl(var(--card))] p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Suggested time</div><p className="mt-2 font-display text-3xl">{plan.durationMinutes} min</p></div>
      <div className="bg-[hsl(var(--card))] p-5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Calm parent prompt</div><p className="mt-2 text-sm font-semibold leading-5">{plan.parentPrompt}</p></div>
      <div className="bg-[hsl(var(--card))] p-5"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--accent))]"><ShieldCheck size={13} />Safety first</div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{plan.safetyGuidance}</p></div>
    </div> : <div className="p-5 text-xs leading-5 text-[hsl(var(--muted-foreground))] md:px-6"><strong className="text-[hsl(var(--foreground))]">Privacy first:</strong> Coastwise sends up to three low-mastery topic summaries, unfinished mission titles/categories/times, and three recent drive summaries with duration, night status, selected skills, and prior debrief outcomes. Video, routes, coordinates, identity, family notes, and raw answers stay on this device.</div>}
    {createPlan.isError && <div className="border-t border-[hsl(var(--border))] px-5 py-3 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{plan ? 'A new plan is unavailable right now. Your saved plan is still ready to use.' : 'Coastwise could not create a plan right now. Try again later.'}</div>}
  </section>;
}

function Dashboard({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [selectedGoal, setSelectedGoal] = useState<'permit' | 'driving' | null>(null);
  const totalMinutes = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const permitAnswers = Object.values(state.practiceProgress);
  const permitCoverage = Math.round((permitAnswers.length / questionBank.length) * 100);
  const missedCount = permitAnswers.filter((answer) => !answer.correct).length;
  const nextMission = state.missions.find((mission) => !mission.completed);
  const daysToTest = Math.max(0, Math.ceil((new Date(state.profile.targetTestDate).getTime() - Date.now()) / 86400000));
  const greeting = getTimeOfDayGreeting(new Date().getHours());
  return <div>
    <header className="mx-auto mb-8 max-w-3xl text-center md:mb-10">
      <div className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">{greeting}</div>
      <h1 className="font-display text-4xl leading-[1.05] tracking-[-.035em] md:text-6xl">What are you working on today?</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Choose one goal. Coastwise will show only the tools that help with it.</p>
    </header>
    <section className="grid items-start gap-4 lg:grid-cols-2">
      <div className={`overflow-hidden rounded-[24px] border bg-[hsl(var(--card))] transition-shadow ${selectedGoal === 'permit' ? 'border-[hsl(var(--primary)/.55)] shadow-lg' : 'border-[hsl(var(--border))]'}`}>
        <button type="button" onClick={() => setSelectedGoal(selectedGoal === 'permit' ? null : 'permit')} className="flex w-full items-center gap-4 p-5 text-left md:p-6" aria-expanded={selectedGoal === 'permit'} data-testid="button-goal-permit">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><BookOpen size={23} /></span>
          <span className="min-w-0 flex-1"><span className="block font-display text-xl md:text-2xl">Permit & knowledge test</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">Learn the handbook and prepare for the DMV knowledge test.</span></span>
          <ChevronRight size={20} className={`shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${selectedGoal === 'permit' ? 'rotate-90' : ''}`} />
        </button>
        {selectedGoal === 'permit' && <div className="border-t border-[hsl(var(--border))] px-5 pb-5 pt-4 animate-fade md:px-6 md:pb-6">
          <div className="space-y-3 text-sm font-semibold">
            {['Practice handbook questions', 'Review missed answers', 'Take a DMV-style simulation', 'Study by handbook section'].map((item) => <div key={item} className="flex items-center gap-3"><Check size={16} className="shrink-0 text-[hsl(var(--success))]" />{item}</div>)}
          </div>
          <ActionButton href="/practice" className="mt-6 w-full sm:w-auto" testId="button-open-permit-menu">Open permit menu <ArrowRight size={16} /></ActionButton>
        </div>}
      </div>
      <div className={`overflow-hidden rounded-[24px] border bg-[hsl(var(--card))] transition-shadow ${selectedGoal === 'driving' ? 'border-[hsl(var(--primary)/.55)] shadow-lg' : 'border-[hsl(var(--border))]'}`}>
        <button type="button" onClick={() => setSelectedGoal(selectedGoal === 'driving' ? null : 'driving')} className="flex w-full items-center gap-4 p-5 text-left md:p-6" aria-expanded={selectedGoal === 'driving'} data-testid="button-goal-driving">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><RouteIcon size={23} /></span>
          <span className="min-w-0 flex-1"><span className="block font-display text-xl md:text-2xl">Driving exam</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">Build road skills, log practice, and prepare for the drive test.</span></span>
          <ChevronRight size={20} className={`shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${selectedGoal === 'driving' ? 'rotate-90' : ''}`} />
        </button>
        {selectedGoal === 'driving' && <div className="border-t border-[hsl(var(--border))] px-5 pb-5 pt-4 animate-fade md:px-6 md:pb-6">
          <div className="space-y-3 text-sm font-semibold">
            {['Plan a coached practice drive', 'Practice real-world scenarios', 'Review completed drives', 'Track supervised and night hours'].map((item) => <div key={item} className="flex items-center gap-3"><Check size={16} className="shrink-0 text-[hsl(var(--success))]" />{item}</div>)}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row"><ActionButton href="/drive" testId="button-open-driving-menu">Open driving menu <ArrowRight size={16} /></ActionButton><ActionButton href="/scenarios" variant="outline" testId="button-open-scenarios">Practice scenarios</ActionButton></div>
        </div>}
      </div>
    </section>
    <div className="mt-6"><NextDrivePlanCard state={state} setState={setState} /></div>
    <section className="mt-6 overflow-hidden rounded-[24px] border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--card))] soft-shadow" data-testid="daily-coach-plan">
      <div className="flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-5 sm:flex-row sm:items-center md:px-6">
        <div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]">Today’s Coastwise plan</div><h2 className="mt-1 font-display text-2xl">Three small steps, one clear direction.</h2></div>
        <span className="w-fit rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))]">About 25 minutes</span>
      </div>
      <div className="grid gap-px bg-[hsl(var(--border))] md:grid-cols-3">
        <Link href="/practice" className="group bg-[hsl(var(--card))] p-5 hover:bg-[hsl(var(--secondary)/.35)]"><span className="font-mono-ui text-xs text-[hsl(var(--primary))]">01 · 10 MIN</span><span className="mt-3 block text-sm font-extrabold">{missedCount ? `Review ${Math.min(5, missedCount)} missed question${missedCount === 1 ? '' : 's'}` : 'Practice 10 handbook questions'}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">Keep legal knowledge fresh with one focused session.</span><ArrowRight size={16} className="mt-4 text-[hsl(var(--primary))] transition-transform group-hover:translate-x-1" /></Link>
        <Link href="/scenarios" className="group bg-[hsl(var(--card))] p-5 hover:bg-[hsl(var(--secondary)/.35)]"><span className="font-mono-ui text-xs text-[hsl(var(--primary))]">02 · 5 MIN</span><span className="mt-3 block text-sm font-extrabold">Practice one road decision</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">Build calm judgment before the situation happens.</span><ArrowRight size={16} className="mt-4 text-[hsl(var(--primary))] transition-transform group-hover:translate-x-1" /></Link>
        <Link href="/drive" className="group bg-[hsl(var(--card))] p-5 hover:bg-[hsl(var(--secondary)/.35)]"><span className="font-mono-ui text-xs text-[hsl(var(--primary))]">03 · NEXT DRIVE</span><span className="mt-3 block text-sm font-extrabold">{nextMission?.title ?? 'Repeat a completed driving skill'}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{nextMission?.detail ?? 'Choose one calm, repeatable goal for the next supervised drive.'}</span><ArrowRight size={16} className="mt-4 text-[hsl(var(--primary))] transition-transform group-hover:translate-x-1" /></Link>
      </div>
    </section>
    <section className="mt-8 grid grid-cols-3 gap-2 border-t border-[hsl(var(--border))] pt-6 sm:gap-4">
      <div><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Permit covered</div><div className="mt-1 font-display text-2xl">{permitCoverage}%</div></div>
      <div><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Driving logged</div><div className="mt-1 font-display text-2xl">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div></div>
      <div><div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Test target</div><div className="mt-1 font-display text-2xl">{daysToTest > 0 ? `${daysToTest} days` : 'Today'}</div></div>
    </section>
    <div className="mt-8"><SafetyNote /></div>
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
        <div className="mt-7 space-y-3">{question[index].options.map((option, optionIndex) => { const isSelected = chosen !== undefined && optionIndex === question[index].answer; const isWrong = chosen !== undefined && optionIndex !== question[index].answer && state.answers[index] === false; return <button key={option} onClick={() => choose(optionIndex)} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm font-semibold ${isSelected ? 'border-[hsl(var(--success)/.55)] bg-[hsl(var(--success)/.09)] text-[hsl(var(--success))]' : isWrong ? 'border-[hsl(var(--warning)/.65)] bg-[hsl(var(--warning)/.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.4)]'}`} data-testid={`button-answer-${index}-${optionIndex}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono-ui text-[11px] ${isSelected ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white' : 'border-[hsl(var(--border))]'}`}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>{isSelected && <Check size={16} className="ml-auto shrink-0" />}</button>; })}</div>
        {chosen !== undefined && <div className="mt-6 rounded-2xl bg-[hsl(var(--secondary)/.65)] p-5 animate-fade"><div className={`flex items-center gap-2 text-sm font-extrabold ${chosen ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning-foreground))]'}`}>{chosen ? <CheckCircle2 size={18} className="text-[hsl(var(--success))]" /> : <CircleHelp size={18} className="text-[hsl(var(--warning))]" />} {chosen ? 'Good call.' : 'Not quite — this is a useful one to remember.'}</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{question[index].explanation}</p></div>}
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
    <div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 soft-shadow md:p-9"><div className="flex items-center justify-between"><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">SCENARIO {String(index + 1).padStart(2, '0')} / 03</span><div className="flex gap-1.5">{state.scenarios.map((_, itemIndex) => <button key={itemIndex} onClick={() => setIndex(itemIndex)} className={`h-2 rounded-full ${itemIndex === index ? 'w-8 bg-[hsl(var(--accent))]' : 'w-2 bg-[hsl(var(--muted))]'}`} aria-label={`Go to scenario ${itemIndex + 1}`} data-testid={`button-scenario-tab-${itemIndex}`} />)}</div></div><div className="mt-10 rounded-2xl bg-[hsl(var(--secondary)/.55)] p-5 md:p-7"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]"><Compass size={15} />Picture this</div><h2 className="font-display text-3xl leading-tight md:text-4xl">{scenario.situation}</h2></div><div className="mt-6 space-y-3">{scenario.choices.map((choice, choiceIndex) => { const correct = chosen !== undefined && choiceIndex === scenario.bestChoice; const wrong = chosen !== undefined && chosen === choiceIndex && !correct; return <button key={choice} onClick={() => choose(choiceIndex)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm font-semibold ${correct ? 'border-[hsl(var(--success)/.55)] bg-[hsl(var(--success)/.09)] text-[hsl(var(--success))]' : wrong ? 'border-[hsl(var(--warning)/.65)] bg-[hsl(var(--warning)/.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-scenario-choice-${index}-${choiceIndex}`}><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{String.fromCharCode(65 + choiceIndex)}</span><span>{choice}</span>{correct && <CheckCircle2 className="ml-auto text-[hsl(var(--success))]" size={18} />}</button>; })}</div>{chosen !== undefined && <div className={`mt-6 border-l-2 ${chosen === scenario.bestChoice ? 'border-[hsl(var(--success))]' : 'border-[hsl(var(--warning))]'} pl-4 animate-fade`}><div className={`text-xs font-bold uppercase tracking-[.15em] ${chosen === scenario.bestChoice ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning-foreground))]'}`}>{chosen === scenario.bestChoice ? 'Coach agrees' : 'Coach perspective'}</div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{scenario.coaching}</p></div>}<div className="mt-7 flex justify-end"><ActionButton onClick={() => setIndex((index + 1) % state.scenarios.length)} disabled={chosen === undefined} testId="button-next-scenario">Next scenario <ArrowRight size={16} /></ActionButton></div></section><aside className="space-y-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><LifeBuoy size={15} />The calm rule</div><p className="font-display text-2xl leading-snug">When in doubt, make the situation simpler.</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Slow down. Look farther ahead. Create space. Good judgment is often less about a clever move and more about removing urgency.</p></div><SafetyNote /></aside></div>
  </div>;
}

function Drive({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const reviewFixture = useMemo(() => getDriveReviewBrowserFixture(), []);
  const [showForm, setShowForm] = useState(false);
  const [transientDebriefs, setTransientDebriefs] = useState<Record<string, NonNullable<DriveSession['review']>['aiDebrief']>>({});
  const createDriveDebrief = useCreateDriveDebrief();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), minutes: '30', night: false, notes: '' });
  const [routeOptions, setRouteOptions] = useState<{ durationMinutes: 20 | 35 | 50; difficulty: 'beginner' | 'intermediate' | 'advanced'; skills: Array<'turns' | 'lane-changes' | 'intersections' | 'parking' | 'speed-control'> }>({ durationMinutes: 35, difficulty: 'beginner', skills: ['turns', 'intersections'] });
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceMiles, setDistanceMiles] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(reviewFixture?.recordedVideoUrl ?? '');
  const [recordedVideoType, setRecordedVideoType] = useState(reviewFixture?.recordedVideoType ?? 'video/webm');
  const [cueIndex, setCueIndex] = useState(0);
  const [routeMinutes, setRouteMinutes] = useState(15);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(reviewFixture?.plannedRoute ?? null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<RouteCoordinate | null>(null);
  const [currentCue, setCurrentCue] = useState('Route ready. Start only when the supervising adult says it is safe.');
  const [coachEvents, setCoachEvents] = useState<CoachEvent[]>(reviewFixture?.coachEvents ?? []);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(reviewFixture?.coachEvents[0]?.id ?? null);
  const [openReviewId, setOpenReviewId] = useState<string | null>(reviewFixture?.reviewId ?? null);
  const [reviewError, setReviewError] = useState('');
  const [reviewPlaybackError, setReviewPlaybackError] = useState('');
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [preflightChecks, setPreflightChecks] = useState({ parked: false, adult: false, mounted: false, reviewed: false });
  const [shareStatus, setShareStatus] = useState('');
  const watchId = useRef<number | null>(null);
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const lastPositionAt = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const currentPositionRef = useRef<RouteCoordinate | null>(null);
  const currentSpeedRef = useRef<number | null>(null);
  const cameraPreview = useRef<HTMLVideoElement | null>(null);
  const reviewVideo = useRef<HTMLVideoElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const videoChunks = useRef<Blob[]>([]);
  const coachAudio = useRef<HTMLAudioElement | null>(null);
  const routeRef = useRef<PlannedRoute | null>(null);
  const activeStepRef = useRef(0);
  const preparedStepRef = useRef(-1);
  const finalStepRef = useRef(-1);
  const offRouteSince = useRef<number | null>(null);
  const rerouting = useRef(false);
  const recordingClockStartedAt = useRef<number | null>(null);
  const finalElapsedSecondsRef = useRef(0);
  const eventSequence = useRef(0);
  const coachEventsRef = useRef<CoachEvent[]>(reviewFixture?.coachEvents ?? []);
  const createRoute = useCreatePracticeRoute();

  const activeReviewSession = state.sessions.find((session) => session.review?.id === openReviewId);
  const currentDebrief = activeReviewSession?.review?.aiDebrief ?? (openReviewId ? transientDebriefs[openReviewId] : null) ?? null;
  const handleGenerateDebrief = () => {
    if (!openReviewId) return;
    const reviewId = openReviewId;
    const input = buildDriveDebriefInput({
      session: activeReviewSession,
      elapsedSeconds,
      distanceMiles,
      plannedSkills: plannedRoute?.skills ?? [],
      events: coachEvents,
      topics: state.topics,
    });
    createDriveDebrief.mutate(
      { data: input },
      {
        onSuccess: (result) => {
          setTransientDebriefs((current) => ({ ...current, [reviewId]: result }));
          setState({
            ...state,
            sessions: state.sessions.map((session) => session.review?.id === reviewId
              ? { ...session, review: { ...session.review, aiDebrief: result } }
              : session),
          });
        },
      }
    );
  };

  const total = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const night = state.sessions.filter((session) => session.night).reduce((sum, session) => sum + session.minutes, 0);
  const completed = state.missions.filter((mission) => mission.completed).length;
  const averageSpeed = elapsedSeconds > 0 ? distanceMiles / (elapsedSeconds / 3600) : 0;
  const reviewDistance = activeReviewSession?.distanceMiles ?? distanceMiles;
  const nextDriveFocus = coachEvents.some((event) => event.title === 'Route updated')
    ? 'Look farther ahead and prepare earlier so the route stays easier to follow.'
    : coachEvents.some((event) => event.kind === 'maneuver')
      ? 'Repeat the same route focus and prepare for each maneuver a little earlier.'
      : 'Choose one simple skill and repeat it on the next supervised drive.';
  const preflightReady = Object.values(preflightChecks).every(Boolean);
  const skillLabels: Record<string, string> = { turns: 'Turns', 'lane-changes': 'Lane changes', intersections: 'Intersections', parking: 'Parking', 'speed-control': 'Speed control' };
  const coaching: Record<string, string> = {
    turns: 'Coach cue: slow before the turn, scan the crosswalk, and look through the turn.',
    'lane-changes': 'Coach cue: mirror, signal, shoulder check, then move when the space is clear.',
    intersections: 'Coach cue: cover the brake and scan left, right, then left again.',
    parking: 'Coach cue: confirm a legal, safe practice space, then move slowly and check all around the vehicle.',
    'speed-control': 'Coach cue: keep a steady speed with enough space to stop smoothly.',
  };
  const refreshStorageEstimate = async () => {
    if (!navigator.storage?.estimate) return;
    try {
      const estimate = await navigator.storage.estimate();
      if (!estimate.quota) return;
      const usage = estimate.usage ?? 0;
      setStorageEstimate({
        usage,
        quota: estimate.quota,
        available: Math.max(0, estimate.quota - usage),
      });
    } catch {
      // Storage estimates are optional; recording still has explicit save errors.
    }
  };
  useEffect(() => {
    void refreshStorageEstimate();
  }, []);
  const speak = (message: string) => {
    setCurrentCue(message);
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };
  const playCoach = (src: string) => {
    coachAudio.current?.pause();
    const audio = new Audio(src);
    coachAudio.current = audio;
    void audio.play().catch(() => undefined);
  };
  const recordCoachEvent = ({ kind, title, detail, distanceToNext = null, stepIndex = null }: { kind: CoachEventKind; title: string; detail: string; distanceToNext?: number | null; stepIndex?: number | null }) => {
    const clockStart = recordingClockStartedAt.current;
    if (clockStart === null) return;
    const event: CoachEvent = {
      id: `coach-event-${eventSequence.current}`,
      timestamp: Number(Math.max(0, (performance.now() - clockStart) / 1000).toFixed(1)),
      kind,
      title,
      detail,
      speedMph: currentSpeedRef.current === null ? null : Number(currentSpeedRef.current.toFixed(0)),
      position: currentPositionRef.current,
      distanceToNext,
      stepIndex,
    };
    eventSequence.current += 1;
    const nextEvents = appendCoachEvent(coachEventsRef.current, event);
    if (nextEvents === coachEventsRef.current) return;
    coachEventsRef.current = nextEvents;
    setCoachEvents(nextEvents);
  };
  const buildRoute = () => {
    if (!navigator.onLine) {
      setRouteError('Connect to the internet before building a new route. Saved practice and drive reviews still work offline.');
      return;
    }
    if (!navigator.geolocation) {
      setRouteError('GPS is not available in this browser.');
      return;
    }
    setRouteLoading(true);
    setRouteError('');
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const route = await requestPracticeLoop(position.coords.latitude, position.coords.longitude, routeMinutes);
        setPlannedRoute(route);
        setCurrentCue('Route ready. Review it with the supervising adult before starting.');
        routeRef.current = route;
        const originPosition: RouteCoordinate = [position.coords.longitude, position.coords.latitude];
        currentPositionRef.current = originPosition;
        setCurrentPosition(originPosition);
        setActiveStep(0);
        activeStepRef.current = 0;
        preparedStepRef.current = -1;
        finalStepRef.current = -1;
      } catch {
        setRouteError('I could not create a safe local loop right now. Check your connection and try again.');
      } finally {
        setRouteLoading(false);
      }
    }, () => {
      setRouteError('Allow location access so Coastwise can build a route from where you are.');
      setRouteLoading(false);
    }, { enableHighAccuracy: true, timeout: 12000 });
  };
  const buildSkillRoute = () => {
    if (!navigator.onLine) {
      setRouteError('Connect to the internet before building a new coached route.');
      return;
    }
    if (!navigator.geolocation) {
      setRouteError('GPS is not available in this browser.');
      return;
    }
    setRouteLoading(true);
    setRouteError('');
    navigator.geolocation.getCurrentPosition((position) => {
      createRoute.mutate({ data: { latitude: position.coords.latitude, longitude: position.coords.longitude, ...routeOptions } }, {
        onSuccess: (route) => {
          const convertedRoute = convertApiRoute(route);
          setPlannedRoute(convertedRoute);
          routeRef.current = convertedRoute;
          const originPosition: RouteCoordinate = [position.coords.longitude, position.coords.latitude];
          currentPositionRef.current = originPosition;
          setCurrentPosition(originPosition);
          setActiveStep(0);
          activeStepRef.current = 0;
          preparedStepRef.current = -1;
          finalStepRef.current = -1;
          setCurrentCue(`Route ready. ${route.skills.map((skill) => skillLabels[skill] ?? skill).join(', ')} practice is queued.`);
        },
        onError: () => setRouteError('A coached route could not be created right now. Check your connection and try again.'),
      });
      setRouteLoading(false);
    }, () => {
      setRouteError('Allow location access so Coastwise can build a route from where you are.');
      setRouteLoading(false);
    }, { enableHighAccuracy: true, timeout: 12000 });
  };
  const playDirection = (modifier: string, preparing: boolean) => {
    if (modifier.includes('left')) playCoach(preparing ? coachVoice.prepareLeft : coachVoice.turnLeft);
    else if (modifier.includes('right')) playCoach(preparing ? coachVoice.prepareRight : coachVoice.turnRight);
    else if (!preparing) playCoach(coachVoice.straight);
  };
  const updateRouteProgress = (latitude: number, longitude: number, metersPerSecond: number) => {
    const route = routeRef.current;
    if (!route || route.steps.length === 0) return;
    const position: RouteCoordinate = [longitude, latitude];
    currentPositionRef.current = position;
    currentSpeedRef.current = Number.isFinite(metersPerSecond) ? metersPerSecond * 2.236936 : null;
    setCurrentPosition(position);
    const stepIndex = activeStepRef.current;
    const step = route.steps[Math.min(stepIndex, route.steps.length - 1)];
    const metersAway = distanceBetween(latitude, longitude, step.location[1], step.location[0]);
    setDistanceToNext(metersAway);
    const prepareDistance = Math.max(110, metersPerSecond * 13);
    const maneuverDistance = Math.max(28, metersPerSecond * 3.5);
    if (metersAway <= prepareDistance && preparedStepRef.current !== stepIndex) {
      preparedStepRef.current = stepIndex;
      playDirection(step.modifier, true);
      speak(`Prepare for ${step.instruction.toLowerCase()}`);
      recordCoachEvent({
        kind: 'prompt',
        title: 'Prepare for maneuver',
        detail: step.instruction,
        distanceToNext: metersAway,
        stepIndex,
      });
    }
    if (metersAway <= maneuverDistance && finalStepRef.current !== stepIndex) {
      finalStepRef.current = stepIndex;
      if (stepIndex >= route.steps.length - 1) {
        playCoach(coachVoice.arrived);
        speak('You have arrived back in the starting area.');
        recordCoachEvent({
          kind: 'maneuver',
          title: 'Arrived',
          detail: 'Return to the starting area',
          distanceToNext: metersAway,
          stepIndex,
        });
      } else {
        playDirection(step.modifier, false);
        speak(step.instruction);
        recordCoachEvent({
          kind: 'maneuver',
          title: 'Maneuver announced',
          detail: step.instruction,
          distanceToNext: metersAway,
          stepIndex,
        });
        activeStepRef.current = stepIndex + 1;
        setActiveStep(stepIndex + 1);
      }
    }
    const stride = Math.max(1, Math.floor(route.coordinates.length / 120));
    let nearest = Number.POSITIVE_INFINITY;
    for (let index = 0; index < route.coordinates.length; index += stride) {
      const coordinate = route.coordinates[index];
      nearest = Math.min(nearest, distanceBetween(latitude, longitude, coordinate[1], coordinate[0]));
    }
    if (nearest > 90) {
      offRouteSince.current ??= Date.now();
      if (Date.now() - offRouteSince.current > 10000 && !rerouting.current) {
        rerouting.current = true;
        playCoach(coachVoice.updated);
        recordCoachEvent({
          kind: 'prompt',
          title: 'Route updated',
          detail: 'A safer return route is being calculated.',
        });
        void requestReturnRoute(latitude, longitude, route.origin).then((nextRoute) => {
          routeRef.current = nextRoute;
          setPlannedRoute(nextRoute);
          activeStepRef.current = 0;
          setActiveStep(0);
          preparedStepRef.current = -1;
          finalStepRef.current = -1;
          offRouteSince.current = null;
        }).catch(() => {
          setTrackingError('You are off the planned route. Continue safely; automatic rerouting is temporarily unavailable.');
        }).finally(() => {
          rerouting.current = false;
        });
      }
    } else {
      offRouteSince.current = null;
    }
  };
  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    window.speechSynthesis?.cancel();
    coachAudio.current?.pause();
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    const finalElapsedSeconds = recordingClockStartedAt.current === null
      ? elapsedSeconds
      : Math.max(0, Math.floor((performance.now() - recordingClockStartedAt.current) / 1000));
    const minutes = Math.max(1, Math.round(finalElapsedSeconds / 60));
    finalElapsedSecondsRef.current = finalElapsedSeconds;
    const hasActiveRecording = mediaRecorder.current?.state === 'recording';
    if (hasActiveRecording) {
      mediaRecorder.current?.stop();
    } else if (routeRef.current && recordingClockStartedAt.current !== null) {
      setState({
        ...state,
        sessions: [{
          id: createDriveSessionId(),
          date: new Date(startedAt ?? Date.now()).toISOString().slice(0, 10),
          minutes,
          night: false,
          notes: `Coached route · ${distanceMiles.toFixed(1)} miles tracked · no video`,
          distanceMiles,
          routeTitle: 'Coached practice route',
        }, ...state.sessions],
      });
    }
    setElapsedSeconds(finalElapsedSeconds);
    setSelectedEventId(coachEventsRef.current[0]?.id ?? null);
    recordingClockStartedAt.current = null;
    setCurrentSpeed(0);
    currentSpeedRef.current = null;
    setTracking(false);
    setPaused(false);
    pausedRef.current = false;
  };
  const startGuidanceWithoutCamera = (message: string) => {
    if (!plannedRoute) return;
    mediaRecorder.current = null;
    setTrackingError(message);
    setDistanceMiles(0);
    setCurrentSpeed(0);
    currentSpeedRef.current = null;
    setElapsedSeconds(0);
    lastPosition.current = null;
    lastPositionAt.current = null;
    coachEventsRef.current = [];
    setCoachEvents([]);
    setSelectedEventId(null);
    setPaused(false);
    pausedRef.current = false;
    setStartedAt(Date.now());
    recordingClockStartedAt.current = performance.now();
    eventSequence.current = 0;
    setCueIndex(1);
    routeRef.current = plannedRoute;
    activeStepRef.current = 0;
    setActiveStep(0);
    preparedStepRef.current = -1;
    finalStepRef.current = -1;
    setTracking(true);
    playCoach(coachVoice.started);
    speak(`Coached route started. ${coaching[plannedRoute.steps[0]?.modifier === 'left' ? 'turns' : 'speed-control']}`);
    recordCoachEvent({
      kind: 'start',
      title: 'Drive started',
      detail: 'Route coaching is active without video recording.',
    });
    if (navigator.geolocation) {
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
        const speedMph = Number.isFinite(metersPerSecond) ? metersPerSecond * 2.236936 : 0;
        currentSpeedRef.current = Number.isFinite(metersPerSecond) ? speedMph : null;
        setCurrentSpeed(speedMph);
        updateRouteProgress(position.coords.latitude, position.coords.longitude, Number.isFinite(metersPerSecond) ? metersPerSecond : 0);
        lastPosition.current = position;
        lastPositionAt.current = now;
      }, () => {
        setTrackingError('Route coaching started, but live GPS is unavailable. Check location permission before driving.');
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
    }
  };
  const startTracking = async () => {
    if (!plannedRoute) {
      setTrackingError('Build and review a practice route before starting the camera.');
      return;
    }
    setShowPreflight(false);
    if (storageEstimate && storageEstimate.available < criticalRecordingStorageBytes) {
      startGuidanceWithoutCamera(`Only ${formatStorageBytes(storageEstimate.available)} of browser storage is available. Route coaching has started without video so this drive does not fill the device.`);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      startGuidanceWithoutCamera('Camera recording is unavailable. Route coaching has started without video.');
      return;
    }
    setTrackingError('');
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl('');
    setDistanceMiles(0);
    setCurrentSpeed(0);
    currentSpeedRef.current = null;
    setElapsedSeconds(0);
    lastPosition.current = null;
    lastPositionAt.current = null;
    coachEventsRef.current = [];
    setCoachEvents([]);
    setSelectedEventId(null);
    setPaused(false);
    pausedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      videoChunks.current = [];
      const preferredType = chooseRecordingMimeType((mimeType) => MediaRecorder.isTypeSupported(mimeType), getRecordingBrowser(navigator.userAgent));
      if (!preferredType) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setTrackingError('This browser can access the camera, but it cannot create a review video in a supported format. You can still log a drive manually.');
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType: preferredType });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) videoChunks.current.push(event.data); };
      recorder.onstop = () => {
        const videoType = recorder.mimeType || preferredType;
        const blob = new Blob(videoChunks.current, { type: videoType });
        setRecordedVideoType(videoType);
        if (blob.size > 0 && routeRef.current) {
          const reviewId = `drive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const reviewEvents = coachEventsRef.current;
          const reviewRoute = routeRef.current;
          const durationSeconds = finalElapsedSecondsRef.current;
          setRecordedVideoUrl(URL.createObjectURL(blob));
          setOpenReviewId(reviewId);
          void saveDriveRecording(reviewId, blob).then(() => {
            setState({
              ...state,
              sessions: [{
                id: createDriveSessionId(),
                date: new Date(startedAt ?? Date.now()).toISOString().slice(0, 10),
                minutes: Math.max(1, Math.round(durationSeconds / 60)),
                night: false,
                notes: `Coached drive · ${distanceMiles.toFixed(1)} miles tracked`,
                distanceMiles,
                review: { id: reviewId, durationSeconds, eventCount: reviewEvents.length, events: reviewEvents, route: reviewRoute, videoType },
              }, ...state.sessions],
            });
            void refreshStorageEstimate();
          }).catch(() => setReviewError('The review could not be saved in this browser. Download it before leaving this page.'));
        }
        videoChunks.current = [];
      };
      recorder.start(1000);
      setStartedAt(Date.now());
      recordingClockStartedAt.current = performance.now();
      eventSequence.current = 0;
      setCueIndex(1);
      routeRef.current = plannedRoute;
      activeStepRef.current = 0;
      setActiveStep(0);
      preparedStepRef.current = -1;
      finalStepRef.current = -1;
      setTracking(true);
      playCoach(coachVoice.started);
      speak(`Coached route started. ${coaching[plannedRoute.steps[0]?.modifier === 'left' ? 'turns' : 'speed-control']}`);
      recordCoachEvent({
        kind: 'start',
        title: 'Drive started',
        detail: 'Dashcam recording and route coaching are active.',
      });
      if (navigator.geolocation) {
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
          const speedMph = Number.isFinite(metersPerSecond) ? metersPerSecond * 2.236936 : 0;
          currentSpeedRef.current = Number.isFinite(metersPerSecond) ? speedMph : null;
          setCurrentSpeed(speedMph);
          updateRouteProgress(position.coords.latitude, position.coords.longitude, Number.isFinite(metersPerSecond) ? metersPerSecond : 0);
          lastPosition.current = position;
          lastPositionAt.current = now;
        }, () => {
          setTrackingError('The road camera is recording, but GPS is unavailable. Check location permission for speed and distance.');
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
      } else {
        setTrackingError('The road camera is recording, but GPS tracking is not available in this browser.');
      }
    } catch {
      cameraStream?.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      startGuidanceWithoutCamera('Camera access was not available. Route coaching has started without video.');
    }
  };
  useEffect(() => {
    if (cameraPreview.current) cameraPreview.current.srcObject = cameraStream;
  }, [cameraStream]);
  useEffect(() => {
    if (!tracking || !startedAt) return;
    const timer = window.setInterval(() => {
      if (recordingClockStartedAt.current !== null) {
        setElapsedSeconds(Math.max(0, Math.floor((performance.now() - recordingClockStartedAt.current) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tracking, startedAt]);
  useEffect(() => {
    if (!tracking || elapsedSeconds === 0 || elapsedSeconds % 60 !== 0) return;
    const isDistanceCue = cueIndex % 2 === 0;
    playCoach(isDistanceCue ? coachVoice.distance : coachVoice.scan);
    speak(isDistanceCue ? 'Leave enough space to stop smoothly.' : 'Scan left, right, and left again before moving.');
    recordCoachEvent({
      kind: 'safety',
      title: isDistanceCue ? 'Following distance reminder' : 'Intersection scan reminder',
      detail: isDistanceCue ? 'Leave enough space to stop smoothly.' : 'Scan left, right, and left again before moving.',
    });
    setCueIndex((value) => value + 1);
  }, [elapsedSeconds, tracking]);
  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    cameraStream?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    coachAudio.current?.pause();
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
  }, [cameraStream, recordedVideoUrl]);
  const selectedEvent = coachEvents.find((event) => event.id === selectedEventId) ?? coachEvents[0] ?? null;
  const selectReviewEvent = (event: CoachEvent) => {
    setSelectedEventId(event.id);
    if (!reviewVideo.current) return;
    const wasPlaying = !reviewVideo.current.paused;
    seekReviewVideo(reviewVideo.current, event);
    if (wasPlaying) void reviewVideo.current.play().catch(() => undefined);
  };
  const followReviewPlayback = () => {
    if (!reviewVideo.current || coachEvents.length === 0) return;
    const currentTime = reviewVideo.current.currentTime;
    const latest = eventAtPlaybackTime(coachEvents, currentTime);
    if (latest && latest.id !== selectedEventId) setSelectedEventId(latest.id);
  };
  const deleteReviewEvent = (eventId: string) => {
    const next = deleteCoachEvent({ recordedVideoUrl, coachEvents: coachEventsRef.current, selectedEventId }, eventId);
    coachEventsRef.current = next.coachEvents;
    setCoachEvents(next.coachEvents);
    setSelectedEventId(next.selectedEventId);
    if (openReviewId) {
      setState({
        ...state,
        sessions: state.sessions.map((session) => {
          if (session.review?.id !== openReviewId) return session;
          const { aiDebrief: _staleDebrief, ...review } = session.review;
          return { ...session, review: { ...review, events: next.coachEvents, eventCount: next.coachEvents.length } };
        }),
      });
    }
  };
  const deleteRecording = () => {
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    if (openReviewId) {
      void deleteSavedDriveRecording(openReviewId);
      setState({ ...state, sessions: state.sessions.filter((session) => session.review?.id !== openReviewId) });
    }
    const cleared = deleteDriveRecording();
    setRecordedVideoUrl(cleared.recordedVideoUrl);
    setOpenReviewId(null);
    coachEventsRef.current = cleared.coachEvents;
    setCoachEvents(cleared.coachEvents);
    setSelectedEventId(cleared.selectedEventId);
  };
  const openSavedReview = async (session: DriveSession) => {
    if (!session.review) return;
    setReviewError('');
    try {
      const blob = await loadDriveRecording(session.review.id);
      if (!blob) {
        setReviewError('This local recording is no longer available on this device.');
        return;
      }
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(URL.createObjectURL(blob));
      setRecordedVideoType(session.review.videoType);
      setReviewPlaybackError('');
      setOpenReviewId(session.review.id);
      setElapsedSeconds(session.review.durationSeconds);
      setPlannedRoute(session.review.route);
      routeRef.current = session.review.route;
      coachEventsRef.current = session.review.events;
      setCoachEvents(session.review.events);
      setSelectedEventId(session.review.events[0]?.id ?? null);
      window.requestAnimationFrame(() => document.querySelector('[data-testid="video-drive-review"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch {
      setReviewError('This local recording could not be opened. Try again in this browser.');
    }
  };
  const handleReviewVideoError = () => {
    setReviewPlaybackError(`This recording uses ${describeRecordingFormat(recordedVideoType)}, which this browser cannot play. Download it to review it in the browser that recorded the drive.`);
  };
  const handleReviewVideoMetadata = () => {
    if (!reviewVideo.current || !canPlayRecording(recordedVideoType, (mimeType) => reviewVideo.current?.canPlayType(mimeType) ?? '')) {
      handleReviewVideoError();
      return;
    }
    setReviewPlaybackError('');
  };
  useEffect(() => {
    if (!recordedVideoUrl || !reviewVideo.current) return;
    if (!canPlayRecording(recordedVideoType, (mimeType) => reviewVideo.current?.canPlayType(mimeType) ?? '')) {
      handleReviewVideoError();
    }
  }, [recordedVideoType, recordedVideoUrl]);
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    window.speechSynthesis?.cancel();
    coachAudio.current?.pause();
    if (!next) speak('Route coaching resumed.');
  };
  const addSession = (event: React.FormEvent) => { event.preventDefault(); const minutes = Number(form.minutes); if (!minutes || minutes < 1) return; setState({ ...state, sessions: [{ id: createDriveSessionId(), date: form.date, minutes, night: form.night, notes: form.notes || 'Practice drive' }, ...state.sessions] }); setForm({ date: new Date().toISOString().slice(0, 10), minutes: '30', night: false, notes: '' }); setShowForm(false); };
  const requestDriveStart = () => {
    if (!plannedRoute) {
      setTrackingError('Build and review a practice route before starting.');
      return;
    }
    setTrackingError('');
    setShareStatus('');
    setShowPreflight(true);
  };
  const shareDriveSummary = async () => {
    const summary = [
      'Coastwise drive review',
      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      `${Math.max(1, Math.round(elapsedSeconds / 60))} minutes · ${reviewDistance.toFixed(1)} miles`,
      `${coachEvents.length} coached ${coachEvents.length === 1 ? 'moment' : 'moments'}`,
      `Next focus: ${currentDebrief ? currentDebrief.nextStep : nextDriveFocus}`,
      ...(currentDebrief ? [
        '',
        'AI Debrief:',
        `Win: ${currentDebrief.win}`,
        `Growth: ${currentDebrief.improvement}`,
        `Parent: ${currentDebrief.parentPrompt}`
      ] : []),
      '',
      'Completed with an attentive supervising adult.',
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Coastwise drive review', text: summary });
        setShareStatus('Drive summary shared.');
      } else {
        await navigator.clipboard.writeText(summary);
        setShareStatus('Drive summary copied to the clipboard.');
      }
    } catch {
      setShareStatus('The summary was not shared. You can try again.');
    }
  };
  return <div><PageHeader eyebrow="Behind the wheel" title="Every drive is a building block." copy="Choose one mission, drive with an adult, and log the time while it is fresh. Progress here is measured in minutes, not pressure." action={<ActionButton onClick={() => setShowForm(!showForm)} variant="secondary" testId="button-toggle-drive-log"><Plus size={17} />Log drive</ActionButton>} />
    {!tracking && <div className="mb-6"><NextDrivePlanCard state={state} setState={setState} compact /></div>}
    {!tracking && <section className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 soft-shadow md:p-6">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><RouteIcon size={16} />GPS practice route</div><h2 className="mt-2 font-display text-3xl">Build a loop from where you are.</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Choose a target length. Coastwise maps nearby roads, returns to your starting area, and automatically speaks every upcoming maneuver.</p></div>
        <div className="flex flex-wrap gap-2">{[10, 15, 25, 35].map((minutes) => <button key={minutes} onClick={() => { setRouteMinutes(minutes); setPlannedRoute(null); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${routeMinutes === minutes ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`} data-testid={`button-route-${minutes}`}>{minutes === 10 ? 'Around the block' : `${minutes} min`}</button>)}</div>
      </div>
       <fieldset className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.25)] p-4">
         <legend className="px-1 text-xs font-bold">Optional coached skills</legend>
         <div className="mt-2 grid gap-3 sm:grid-cols-[.7fr_1.3fr]">
           <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Length<select value={routeOptions.durationMinutes} onChange={(event) => setRouteOptions({ ...routeOptions, durationMinutes: Number(event.target.value) as 20 | 35 | 50 })} className="mt-2 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-xs" data-testid="select-route-duration"><option value="20">20 min</option><option value="35">35 min</option><option value="50">50 min</option></select></label><label className="text-xs font-bold">Difficulty<select value={routeOptions.difficulty} onChange={(event) => setRouteOptions({ ...routeOptions, difficulty: event.target.value as typeof routeOptions.difficulty })} className="mt-2 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-xs" data-testid="select-route-difficulty"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
           <div><div className="text-xs font-bold">Practice focus</div><div className="mt-2 flex flex-wrap gap-2">{Object.entries(skillLabels).map(([value, label]) => { const selected = routeOptions.skills.includes(value as typeof routeOptions.skills[number]); return <button key={value} type="button" onClick={() => setRouteOptions({ ...routeOptions, skills: selected ? routeOptions.skills.filter((skill) => skill !== value) : [...routeOptions.skills, value as typeof routeOptions.skills[number]] })} className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]'}`} data-testid={`button-skill-${value}`}>{selected && <Check size={11} className="mr-1 inline" />}{label}</button>; })}</div></div>
         </div>
       </fieldset>
       <div className="mt-5 flex flex-wrap gap-3"><ActionButton onClick={buildRoute} disabled={routeLoading} testId="button-build-practice-route"><Compass size={16} />{routeLoading ? 'Mapping nearby roads…' : plannedRoute ? 'Rebuild route' : 'Map my practice route'}</ActionButton><ActionButton onClick={buildSkillRoute} disabled={routeLoading || createRoute.isPending || routeOptions.skills.length === 0} variant="secondary" testId="button-create-practice-route"><RouteIcon size={16} />{createRoute.isPending ? 'Building coached route…' : 'Create coached skill route'}</ActionButton></div>
      {routeError && <div className="mt-4 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{routeError}</div>}
       {plannedRoute && <div className="mt-6 grid gap-5 border-t border-[hsl(var(--border))] pt-5 lg:grid-cols-[1.25fr_.75fr]"><RouteMap route={plannedRoute} currentPosition={currentPosition} /><div className="flex flex-col justify-center"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Route ready</div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-4"><div className="font-display text-3xl">{(plannedRoute.distanceMeters / 1609.344).toFixed(1)}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">miles</div></div><div className="rounded-xl bg-[hsl(var(--secondary)/.55)] p-4"><div className="font-display text-3xl">{Math.max(1, Math.round(plannedRoute.durationSeconds / 60))}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">estimated min</div></div></div><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Review the route while parked. Starting confirms parent or guardian consent to voice guidance. If video is unavailable, GPS and spoken coaching can still continue.</p><ActionButton onClick={requestDriveStart} className="mt-5 w-full" testId="button-start-ready-route"><Play size={16} />Start this route</ActionButton></div></div>}
    </section>}
    {showPreflight && !tracking && <section className="mb-6 rounded-2xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card))] p-5 soft-shadow md:p-6" data-testid="preflight-checklist">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]"><ShieldCheck size={16} />Pre-drive safety check</div><h2 className="mt-2 font-display text-3xl">Start only when everyone is ready.</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">The supervising adult should complete this while the vehicle is parked.</p></div><button onClick={() => setShowPreflight(false)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Close safety check"><X size={19} /></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{[
        ['parked', 'The vehicle is parked in a safe place.'],
        ['adult', 'An attentive, licensed adult is supervising.'],
        ['mounted', 'The phone is mounted and does not block the driver’s view.'],
        ['reviewed', 'We reviewed the route and current conditions together.'],
      ].map(([key, label]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm font-semibold"><input type="checkbox" checked={preflightChecks[key as keyof typeof preflightChecks]} onChange={(event) => setPreflightChecks({ ...preflightChecks, [key]: event.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--primary))]" />{label}</label>)}</div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ActionButton onClick={() => setShowPreflight(false)} variant="quiet" testId="button-cancel-preflight">Cancel</ActionButton><ActionButton onClick={() => void startTracking()} disabled={!preflightReady} testId="button-confirm-preflight"><Check size={16} />Confirm & start coaching</ActionButton></div>
    </section>}
    <section className={`mb-6 overflow-hidden rounded-2xl border ${tracking ? 'border-[hsl(var(--accent)/.45)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'} p-5 md:p-6`}>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tracking ? 'bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]'}`}><Camera size={21} /></div>
          <div><div className={`text-xs font-bold uppercase tracking-[.15em] ${tracking ? 'text-[hsl(var(--sidebar-primary))]' : 'text-[hsl(var(--accent))]'}`}>{tracking ? 'Dashcam recording' : 'Dashcam coach mode'}</div><h2 className="mt-1 font-display text-2xl">{tracking ? 'Eyes on the road. Coastwise is recording.' : 'Record the road. Review the drive.'}</h2><p className={`mt-2 max-w-2xl text-xs leading-5 ${tracking ? 'text-white/65' : 'text-[hsl(var(--muted-foreground))]'}`}>{tracking ? 'Keep the phone mounted facing forward. Only the supervising adult should operate the screen.' : 'Coastwise records the road ahead while tracking GPS speed, miles, and time. It also gives occasional hands-free coaching cues.'}</p></div>
        </div>
         {!tracking ? <ActionButton onClick={requestDriveStart} disabled={!plannedRoute} variant="primary" testId="button-start-gps-drive"><Video size={15} />Start coached drive</ActionButton> : <div className="flex gap-2"><ActionButton onClick={togglePause} variant="outline" className="border-white/20 bg-white/10 text-white" testId="button-pause-route">{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</ActionButton><ActionButton onClick={stopTracking} variant="secondary" testId="button-stop-gps-drive"><Square size={14} />Stop & review</ActionButton></div>}
      </div>
      {trackingError && <div className="mt-4 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{trackingError}</div>}
      {storageEstimate && storageEstimate.available < lowRecordingStorageBytes && <div className="mt-4 flex gap-3 rounded-xl border border-[hsl(var(--warning)/.4)] bg-[hsl(var(--warning)/.1)] p-4 text-xs leading-5" role="status" data-testid="drive-storage-warning"><HardDrive size={17} className="mt-0.5 shrink-0 text-[hsl(var(--warning-foreground))]" /><div><strong>{formatStorageBytes(storageEstimate.available)} available for this browser.</strong> Download or delete older drive recordings before starting another long recording. Below {formatStorageBytes(criticalRecordingStorageBytes)}, Coastwise continues without video.</div></div>}
       {tracking && <div className="mt-6 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-[1.1fr_.9fr]"><div className="relative overflow-hidden rounded-2xl bg-black/40"><video ref={cameraPreview} autoPlay muted playsInline className="aspect-video w-full object-cover" /><div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[.12em] text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Road camera</div></div><div><div className="grid grid-cols-2 gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Current speed</div><div className="mt-2 font-display text-3xl">{currentSpeed.toFixed(0)} <span className="font-sans text-sm font-bold text-white/55">mph</span></div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Miles tracked</div><div className="mt-2 font-display text-3xl">{distanceMiles.toFixed(1)} <span className="font-sans text-sm font-bold text-white/55">mi</span></div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Drive time</div><div className="mt-2 font-display text-3xl">{formatElapsed(elapsedSeconds)}</div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-white/50">Average speed</div><div className="mt-2 font-display text-3xl">{averageSpeed.toFixed(0)} <span className="font-sans text-sm font-bold text-white/55">mph</span></div></div></div><div className="mt-5 flex items-start gap-2 rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-xs text-white"><Volume2 size={16} className="mt-0.5 shrink-0" /><span><span className="block font-bold">{paused ? 'Coaching paused' : 'Natural coach is speaking automatically'}</span><span className="mt-1 block text-white/70" data-testid="text-current-voice-cue">{currentCue}</span></span></div></div></div>}
    </section>
    {tracking && plannedRoute && <section className="mb-6 grid gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-6 lg:grid-cols-[.7fr_1.3fr]"><div className="flex flex-col justify-center"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Next instruction · automatic</div><h2 className="mt-3 font-display text-3xl">{plannedRoute.steps[Math.min(activeStep, plannedRoute.steps.length - 1)]?.instruction ?? 'Continue safely'}</h2><div className="mt-4 font-mono-ui text-sm font-medium text-[hsl(var(--primary))]">{distanceToNext > 0 ? `${distanceToNext * 3.28084 >= 500 ? Math.round(distanceToNext * 3.28084 / 50) * 50 : Math.round(distanceToNext * 3.28084)} feet` : 'Acquiring GPS position'}</div><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">No taps are needed. Coastwise prepares the driver, announces the maneuver, advances to the next step, and calmly recalculates after a missed turn.</p></div><RouteMap route={plannedRoute} currentPosition={currentPosition} /></section>}
     {reviewError && <div className="mb-6 rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]" role="alert">{reviewError}</div>}
      {recordedVideoUrl && <section className="mb-6 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--card))] p-5 md:p-6 animate-fade">
       <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
         <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]"><CheckCircle2 size={15} />Drive ready to review</div><h2 className="mt-2 font-display text-3xl">Replay the moments that mattered.</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Select a turn or safety prompt to jump the recording to that moment. The annotations and video stay local to this browser.</p></div>
         <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[hsl(var(--secondary)/.6)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><MapPin size={15} />{coachEvents.length} coached moments</div>
       </div>
        <div className="mb-6 grid gap-3 rounded-2xl bg-[hsl(var(--secondary)/.45)] p-4 sm:grid-cols-[auto_auto_1fr_auto]" data-testid="drive-debrief">
          <div><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Time</div><div className="mt-1 font-display text-2xl">{Math.max(1, Math.round(elapsedSeconds / 60))} min</div></div>
          <div><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Distance</div><div className="mt-1 font-display text-2xl">{reviewDistance.toFixed(1)} mi</div></div>
          <div className="sm:border-l sm:border-[hsl(var(--border))] sm:pl-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Next drive focus</div><div className="mt-1 text-sm font-bold leading-5" data-testid="text-next-drive-focus">{currentDebrief ? currentDebrief.nextStep : nextDriveFocus}</div></div>
          <div className="flex items-center"><ActionButton onClick={() => void shareDriveSummary()} variant="outline" testId="button-share-drive-summary"><Upload size={15} />Share summary</ActionButton></div>
        </div>

        <div className="mb-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden soft-shadow" data-testid="ai-drive-debrief-container">
          {currentDebrief ? (
            <div className="p-5 md:p-6 animate-fade bg-gradient-to-br from-[hsl(var(--secondary)/.5)] to-transparent">
              <div className="flex items-center justify-between gap-4 mb-5 border-b border-[hsl(var(--border))] pb-5">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))] mb-1"><Sparkles size={14} /> AI Debrief</div>
                  <h3 className="font-display text-2xl" data-testid="text-ai-debrief-headline">{currentDebrief.headline}</h3>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 soft-shadow shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--success))] mb-2 flex items-center gap-1.5"><Award size={14}/> Big Win</div>
                  <p className="text-sm font-semibold leading-relaxed" data-testid="text-ai-debrief-win">{currentDebrief.win}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 soft-shadow shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--warning))] mb-2 flex items-center gap-1.5"><Target size={14}/> Room to Grow</div>
                  <p className="text-sm font-semibold leading-relaxed" data-testid="text-ai-debrief-improvement">{currentDebrief.improvement}</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 soft-shadow shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--accent))] mb-2 flex items-center gap-1.5"><HeartHandshake size={14}/> Parent Prompt</div>
                  <p className="text-sm font-semibold leading-relaxed" data-testid="text-ai-debrief-parent-prompt">{currentDebrief.parentPrompt}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-5 items-center justify-between p-5 md:p-6 bg-[hsl(var(--secondary)/.3)] hover:bg-[hsl(var(--secondary)/.4)] transition-colors">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]"><Sparkles size={16} /> AI Drive Debrief</div>
                <h3 className="mt-1 font-display text-2xl">Get personalized coaching insights.</h3>
                <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))] max-w-xl"><strong className="text-[hsl(var(--foreground))]">Privacy first:</strong> Coastwise sends duration, distance, night-driving status, selected skills, coach-event titles and descriptions, and your three lowest mastery topics. Video, notes, route maps, precise locations, and identity stay on this device.</p>
              </div>
              <div className="flex shrink-0">
                <ActionButton onClick={handleGenerateDebrief} disabled={createDriveDebrief.isPending} testId="button-generate-ai-debrief">
                  {createDriveDebrief.isPending ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"/> Analyzing...</span> : <span className="flex items-center gap-2"><Sparkles size={16} /> Generate debrief</span>}
                </ActionButton>
              </div>
            </div>
          )}
          {createDriveDebrief.isError && !currentDebrief && (
            <div className="border-t border-[hsl(var(--border))] px-5 py-4 md:px-6">
              <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[hsl(var(--destructive))]" role="alert">
                <div className="flex items-center gap-2"><AlertTriangle size={16} /> Coastwise could not generate the AI debrief right now.</div>
                <ActionButton onClick={handleGenerateDebrief} variant="quiet" className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)]" testId="button-retry-ai-debrief">Retry</ActionButton>
              </div>
            </div>
          )}
        </div>
        {shareStatus && <p className="mb-5 text-xs font-semibold text-[hsl(var(--primary))]" role="status">{shareStatus}</p>}
       <div className="grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
         <div>
            {reviewPlaybackError ? <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] p-6 text-center text-sm font-semibold text-[hsl(var(--destructive))]" role="alert" data-testid="review-playback-error">{reviewPlaybackError}</div> : <video ref={reviewVideo} src={recordedVideoUrl} controls playsInline onError={handleReviewVideoError} onLoadedMetadata={handleReviewVideoMetadata} onTimeUpdate={followReviewPlayback} className="aspect-video w-full rounded-xl bg-black object-cover" data-testid="video-drive-review" />}
            <div className="mt-3 flex items-center gap-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]" data-testid="text-drive-review-format"><Video size={14} className="shrink-0 text-[hsl(var(--primary))]" />Recorded as {describeRecordingFormat(recordedVideoType)}. Playback is supported when the browser can decode this format.</div>
            <div className="mt-3 flex items-center gap-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><LockKeyhole size={14} className="shrink-0 text-[hsl(var(--primary))]" />Stored only in this browser on this device. Deleting removes the recording and all annotations together.</div>
         </div>
         <div className="min-w-0">
           <div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Coached moments</div><h3 className="mt-1 font-display text-2xl">Follow the route in order.</h3></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{formatElapsed(elapsedSeconds)}</span></div>
           {coachEvents.length > 0 ? <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">{coachEvents.map((event) => {
             const selected = event.id === selectedEvent?.id;
             const EventIcon = event.kind === 'safety' ? ShieldCheck : event.kind === 'maneuver' ? RouteIcon : event.kind === 'start' ? Video : Volume2;
             const eventType = event.kind === 'maneuver' ? 'Route maneuver' : event.kind === 'safety' ? 'Safety prompt' : event.kind === 'start' ? 'Drive start' : 'Coach prompt';
             return <div key={event.id} className={`flex items-stretch overflow-hidden rounded-xl border ${selected ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--secondary)/.55)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}>
               <button onClick={() => selectReviewEvent(event)} className="flex min-h-[68px] min-w-0 flex-1 items-start gap-3 p-3 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--primary))]" data-testid={`button-review-event-${event.id}`}>
                 <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--primary))]'}`}><EventIcon size={15} /></span>
                 <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-mono-ui text-xs font-medium text-[hsl(var(--primary))]">{formatElapsed(Math.floor(event.timestamp))}</span><span className="truncate text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{eventType}</span></span><span className="mt-1 block text-sm font-extrabold">{event.title}</span><span className="mt-0.5 block truncate text-xs text-[hsl(var(--muted-foreground))]">{event.detail}</span></span>
               </button>
               <button onClick={() => deleteReviewEvent(event.id)} className="flex w-11 shrink-0 items-center justify-center border-l border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/.1)] hover:text-[hsl(var(--accent))] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[hsl(var(--accent))]" aria-label={`Delete ${event.title}`} data-testid={`button-delete-review-event-${event.id}`}><Trash2 size={15} /></button>
             </div>;
           })}</div> : <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">No coached moments remain. The recording is still available.</div>}
           {selectedEvent && plannedRoute && <div className="mt-4 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)]">
             <div className="p-4" data-testid="review-selected-event"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Selected moment</div><div className="mt-1 flex items-center justify-between gap-3"><h4 className="font-display text-2xl">{selectedEvent.title}</h4><span className="font-mono-ui text-xs text-[hsl(var(--primary))]">{formatElapsed(Math.floor(selectedEvent.timestamp))}</span></div><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{selectedEvent.detail}</p></div>
             <div className="grid grid-cols-2 gap-px border-y border-[hsl(var(--border))] bg-[hsl(var(--border))]"><div className="bg-[hsl(var(--card))] p-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Speed</div><div className="mt-1 font-display text-2xl">{selectedEvent.speedMph === null ? '—' : selectedEvent.speedMph} <span className="font-sans text-xs font-bold text-[hsl(var(--muted-foreground))]">{selectedEvent.speedMph === null ? 'unavailable' : 'mph'}</span></div></div><div className="bg-[hsl(var(--card))] p-4"><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Route position</div><div className="mt-1 font-display text-2xl">{routeProgressPercent(plannedRoute, selectedEvent.position) === null ? '—' : `${routeProgressPercent(plannedRoute, selectedEvent.position)}%`} <span className="font-sans text-xs font-bold text-[hsl(var(--muted-foreground))]">{selectedEvent.position ? 'of route' : 'unavailable'}</span></div></div></div>
             <RouteMap route={plannedRoute} currentPosition={selectedEvent.position} />
             <div className="flex items-center gap-2 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]"><MapPin size={14} className="text-[hsl(var(--primary))]" />{selectedEvent.position ? `Captured at ${selectedEvent.position[1].toFixed(4)}, ${selectedEvent.position[0].toFixed(4)}` : 'GPS position was unavailable for this moment.'}</div>
           </div>}
         </div>
       </div>
       <div className="mt-6 flex flex-wrap gap-3 border-t border-[hsl(var(--border))] pt-5"><a href={recordedVideoUrl} download={`coastwise-drive-${new Date().toISOString().slice(0, 10)}.${recordedVideoType.includes('mp4') ? 'mp4' : 'webm'}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-download-drive"><Download size={16} />Download drive</a><ActionButton onClick={deleteRecording} variant="outline" testId="button-delete-drive-video"><Trash2 size={16} />Delete recording & annotations</ActionButton></div>
     </section>}
    {showForm && <form onSubmit={addSession} className="mb-6 grid gap-4 rounded-2xl border border-[hsl(var(--accent)/.35)] bg-[hsl(var(--secondary)/.4)] p-5 md:grid-cols-4 md:items-end animate-fade"><label className="text-xs font-bold">Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" data-testid="input-drive-date" /></label><label className="text-xs font-bold">Minutes<input type="number" min="1" value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} className="mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" data-testid="input-drive-minutes" /></label><label className="flex items-center gap-2 pb-2 text-sm font-semibold"><input type="checkbox" checked={form.night} onChange={(event) => setForm({ ...form, night: event.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid="input-drive-night" />Night practice</label><ActionButton type="submit" testId="button-save-drive-log"><Check size={16} />Save session</ActionButton><label className="md:col-span-4 text-xs font-bold">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} placeholder="What felt different today?" className="mt-2 w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-normal" data-testid="input-drive-notes" /></label></form>}
    <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="text-xs font-bold uppercase tracking-[.14em] text-white/55">Total logged</div><div className="mt-3 font-display text-4xl">{Math.floor(total / 60)}h {total % 60}m</div><ProgressBar value={(total / 3000) * 100} color="bg-[hsl(var(--sidebar-primary))]" /><div className="mt-2 text-xs text-white/60">of 50 supervised hours</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Night practice</div><div className="mt-3 font-display text-4xl">{Math.floor(night / 60)}h {night % 60}m</div><ProgressBar value={(night / 600) * 100} color="bg-[hsl(var(--accent))]" /><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">of 10 required hours</div></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Missions</div><div className="mt-3 font-display text-4xl">{completed}<span className="text-2xl text-[hsl(var(--muted-foreground))]">/5</span></div><div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">small skills, repeated</div></div></section>
     <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section><div className="mb-4 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">The mission board</div><h2 className="mt-1 font-display text-3xl">Pick one for the next drive.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{completed} complete</span></div><div className="space-y-3">{state.missions.map((mission, index) => <button key={mission.title} onClick={() => setState({ ...state, missions: state.missions.map((item, itemIndex) => itemIndex === index ? { ...item, completed: !item.completed } : item) })} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${mission.completed ? 'border-[hsl(var(--success)/.25)] bg-[hsl(var(--success)/.08)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-mission-${index}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mission.completed ? 'bg-[hsl(var(--success))] text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{mission.completed ? <Check size={19} /> : <RouteIcon size={19} />}</span><span className="min-w-0 flex-1"><span className={`block text-sm font-extrabold ${mission.completed ? 'line-through opacity-60' : ''}`}>{mission.title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{mission.detail}</span></span><span className="hidden text-right sm:block"><span className="block font-mono-ui text-xs">{mission.minutes}m</span><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{mission.category}</span></span></button>)}</div></section><section><div className="mb-4"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Local drive log</div><h2 className="mt-1 font-display text-3xl">Your road so far.</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Completed reviews stay only in this browser on this device.</p></div><div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{state.sessions.map((session, index) => <div key={session.review?.id ?? `${session.date}-${index}`} className="flex items-start gap-3 border-b border-[hsl(var(--border))] p-4 last:border-0"><div className="mt-1 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-xs font-bold"><span>{new Date(`${session.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="font-mono-ui text-[hsl(var(--primary))]">{session.minutes}m {session.night && '· night'}</span></div><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{session.notes}</p>{session.review && <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">{session.review.eventCount} coached {session.review.eventCount === 1 ? 'moment' : 'moments'}</span><button onClick={() => void openSavedReview(session)} className="inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`button-open-drive-review-${session.review.id}`}><Play size={13} />Open review</button></div>}</div></div>)}</div><div className="mt-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">Local-only:</strong> recordings are not synced to another browser or device. Deleting a review removes its recording and annotations together.</div></section></div>
  </div>;
}

function Parent({ state, setState }: { state: AppState; setState: (next: AppState) => void }) {
  const [familyShareStatus, setFamilyShareStatus] = useState('');
  const total = state.sessions.reduce((sum, session) => sum + session.minutes, 0);
  const night = state.sessions.filter((session) => session.night).reduce((sum, session) => sum + session.minutes, 0);
  const permitAnswered = Object.values(state.practiceProgress);
  const permitCorrect = permitAnswered.filter((answer) => answer.correct).length;
  const permitReadiness = permitAnswered.length ? Math.round(((permitAnswered.length / questionBank.length) * 0.45 + (permitCorrect / permitAnswered.length) * 0.55) * 100) : 0;
  const donePrompts = state.prompts.filter((prompt) => prompt.done).length;
  const completedMissions = state.missions.filter((mission) => mission.completed).length;
  const togglePrompt = (index: number) => setState({ ...state, prompts: state.prompts.map((prompt, promptIndex) => promptIndex === index ? { ...prompt, done: !prompt.done } : prompt) });
  const shareFamilySummary = async () => {
    const nextMission = state.missions.find((mission) => !mission.completed)?.title ?? 'Repeat one completed driving skill';
    const summary = [
      'Coastwise family progress',
      `Permit readiness: ${permitAnswered.length ? `${permitReadiness}%` : 'Not started'}`,
      `Supervised driving: ${Math.floor(total / 60)}h ${total % 60}m of 50h`,
      `Night driving: ${Math.floor(night / 60)}h ${night % 60}m of 10h`,
      `Driving missions: ${completedMissions} of ${state.missions.length}`,
      `Next drive focus: ${nextMission}`,
      `Target test: ${new Date(`${state.profile.targetTestDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    ].join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Coastwise family progress', text: summary });
        setFamilyShareStatus('Family progress shared.');
      } else {
        await navigator.clipboard.writeText(summary);
        setFamilyShareStatus('Family progress copied to the clipboard.');
      }
    } catch {
      setFamilyShareStatus('The progress summary was not shared. You can try again.');
    }
  };
  const journey = [
    { title: 'Know the rules', value: permitAnswered.length ? `${permitReadiness}%` : 'Start', complete: permitReadiness >= 80 },
    { title: 'Build road skills', value: `${completedMissions}/${state.missions.length}`, complete: completedMissions === state.missions.length },
    { title: 'Practice 50 hours', value: `${Math.floor(total / 60)}h`, complete: total >= 3000 },
    { title: 'Practice 10 at night', value: `${Math.floor(night / 60)}h`, complete: night >= 600 },
  ];
  return <div><PageHeader eyebrow="Parent view" title="Coach the process, not just the result." copy="A quick read on what is going well, what is next, and how to make practice feel calm in the passenger seat." action={<ActionButton onClick={() => void shareFamilySummary()} variant="secondary" testId="button-share-family-progress"><HeartHandshake size={16} />Share progress</ActionButton>} />
     <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]"><div className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><UserRound size={15} />{state.profile.name}'s permit readiness</div><div className="mt-5 font-display text-4xl">{permitAnswered.length ? `${permitReadiness}%` : 'Ready to start'}</div><p className="mt-3 text-xs leading-5 text-white/60">{permitAnswered.length ? `${permitAnswered.length} of ${questionBank.length} handbook questions covered · ${permitCorrect} currently correct.` : 'Begin a recommended practice session to create a useful readiness picture.'}</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Practice hours</div><div className="mt-4 font-display text-4xl">{Math.floor(total / 60)}h <span className="text-xl text-[hsl(var(--muted-foreground))]">of 50</span></div><ProgressBar value={(total / 3000) * 100} color="bg-[hsl(var(--primary))]" /><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{Math.floor(night / 60)}h {night % 60}m at night · 6 professional hours separate</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Permit timeline</div><div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]"><LockKeyhole size={18} className="text-[hsl(var(--primary))]" /></div><div><div className="text-sm font-extrabold">6 month hold</div><div className="text-xs text-[hsl(var(--muted-foreground))]">before the drive test</div></div></div><p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Target test: <strong className="text-[hsl(var(--foreground))]">{new Date(`${state.profile.targetTestDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p></div></div>
    {familyShareStatus && <p className="mt-4 text-xs font-semibold text-[hsl(var(--primary))]" role="status">{familyShareStatus}</p>}
    <section className="mt-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 md:p-6" data-testid="progress-journey"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Road to test day</div><h2 className="mt-1 font-display text-3xl">Progress that the whole family can read.</h2></div><span className="text-xs text-[hsl(var(--muted-foreground))]">Milestones update automatically</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{journey.map((item, index) => <div key={item.title} className={`rounded-xl border p-4 ${item.complete ? 'border-[hsl(var(--success)/.35)] bg-[hsl(var(--success)/.07)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}><div className="flex items-center justify-between"><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, '0')}</span>{item.complete ? <CheckCircle2 size={17} className="text-[hsl(var(--success))]" /> : <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary)/.35)]" />}</div><div className="mt-4 font-display text-3xl">{item.value}</div><div className="mt-1 text-xs font-bold">{item.title}</div></div>)}</div></section>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section><div className="mb-4 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Coaching prompts</div><h2 className="mt-1 font-display text-3xl">Helpful words for the next drive.</h2></div><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{donePrompts}/{state.prompts.length} tried</span></div><div className="space-y-3">{state.prompts.map((prompt, index) => <button key={prompt.title} onClick={() => togglePrompt(index)} className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left ${prompt.done ? 'border-[hsl(var(--success)/.25)] bg-[hsl(var(--success)/.08)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-parent-prompt-${index}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${prompt.done ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white' : 'border-[hsl(var(--border))]'}`}>{prompt.done && <Check size={14} />}</span><span><span className={`block text-sm font-extrabold ${prompt.done ? 'line-through opacity-60' : ''}`}>{prompt.title}</span><span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">{prompt.copy}</span></span></button>)}</div></section><aside><div className="mb-4 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">The adult seat</div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.5)] p-6"><SunMedium size={22} className="text-[hsl(var(--accent))]" /><h3 className="mt-4 font-display text-2xl">Your calm is part of the lesson.</h3><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Give directions early, keep your voice level, and save the debrief for a safe stop. The goal is a driver who can think clearly when something changes.</p><div className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-xs font-semibold text-[hsl(var(--primary))]">Try asking: “What did you notice?”</div></div><div className="mt-4"><SafetyNote /></div></aside></div>
  </div>;
}


import { useSyncManager } from '@/lib/use-sync-manager';

import { AppClerkProvider } from '@/components/clerk-provider-with-routes';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import LegalPage from '@/pages/legal';
import PolicyUpdatesPage from '@/pages/policy-updates';

function Router() {
  const [state, setState] = useState<AppState>(getStoredState);
  const syncManager = useSyncManager(state, setState);
  const [policyAcknowledgements, setPolicyAcknowledgements] = useState(getPolicyAcknowledgements);
  const [location] = useLocation();
  const isPolicyRoute = location === '/privacy' || location === '/terms' || location === '/policy-updates';

  const [persistenceWarning, setPersistenceWarning] = useState('');
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setPersistenceWarning('');
    } catch {
      setPersistenceWarning('This browser is blocking or has run out of local storage. Keep this tab open and download a backup from Settings before leaving.');
    }
  }, [state]);
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || (event.storageArea && event.storageArea !== window.localStorage)) return;
      setState(parseStoredState(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  useEffect(() => {
    const handlePolicyStorage = (event: StorageEvent) => {
      if (event.key !== policyAcknowledgementStorageKey || (event.storageArea && event.storageArea !== window.localStorage)) return;
      setPolicyAcknowledgements(getPolicyAcknowledgements());
    };
    window.addEventListener('storage', handlePolicyStorage);
    return () => window.removeEventListener('storage', handlePolicyStorage);
  }, []);
  useEffect(() => {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    const applyAppearance = () => {
      const dark = state.settings.appearance === 'dark' || (state.settings.appearance === 'system' && Boolean(media?.matches));
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    applyAppearance();
    if (state.settings.appearance !== 'system' || !media) return;
    media.addEventListener('change', applyAppearance);
    return () => media.removeEventListener('change', applyAppearance);
  }, [state.settings.appearance]);

  return (
    <Switch>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route>
        <Shell state={state} setState={setState} persistenceWarning={persistenceWarning}>
          <Switch>
            <Route path="/"><Dashboard state={state} setState={setState} /></Route>
            <Route path="/practice"><Practice state={state} setState={setState} /></Route>
            <Route path="/scenarios"><Scenarios state={state} setState={setState} /></Route>
            <Route path="/drive"><Drive state={state} setState={setState} /></Route>
            <Route path="/parent"><Parent state={state} setState={setState} /></Route>
            <Route path="/settings"><SettingsPage state={state} setState={setState} syncManager={syncManager} policyAcknowledgements={policyAcknowledgements} /></Route>
            <Route path="/privacy"><LegalPage kind="privacy" /></Route>
            <Route path="/terms"><LegalPage kind="terms" /></Route>
            <Route path="/policy-updates"><PolicyUpdatesPage /></Route>
            <Route component={NotFound} />
          </Switch>
        </Shell>
        {!isPolicyRoute && requiresCurrentPolicyAcknowledgement(policyAcknowledgements) && <MaterialPolicyNoticeDialog onAcknowledge={() => {
          try {
            setPolicyAcknowledgements(saveCurrentPolicyAcknowledgement());
          } catch {
            setPersistenceWarning('This browser could not save your privacy and safety acknowledgement. Check browser storage settings before continuing.');
          }
        }} />}
      </Route>
    </Switch>
  );
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><AppClerkProvider><Router /></AppClerkProvider></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;

function convertApiRoute(route: PracticeRoute): PlannedRoute {
  return {
    coordinates: route.geometry.map(({ longitude, latitude }) => [longitude, latitude]),
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    origin: route.geometry[0] ? [route.geometry[0].longitude, route.geometry[0].latitude] : [0, 0],
    steps: route.steps.map((step) => ({
      instruction: step.instruction,
      modifier: step.maneuverType.includes('left') ? 'left' : step.maneuverType.includes('right') ? 'right' : 'straight',
      name: '',
      distance: step.distanceMeters,
      location: [step.coordinate.longitude, step.coordinate.latitude],
    })),
    skills: route.skills,
  };
}

const coachVoice = {
  started: new URL('./assets/coach-voice/drive-started.mp3', import.meta.url).href,
  prepareLeft: new URL('./assets/coach-voice/prepare-left.mp3', import.meta.url).href,
  prepareRight: new URL('./assets/coach-voice/prepare-right.mp3', import.meta.url).href,
  turnLeft: new URL('./assets/coach-voice/turn-left.mp3', import.meta.url).href,
  turnRight: new URL('./assets/coach-voice/turn-right.mp3', import.meta.url).href,
  straight: new URL('./assets/coach-voice/continue-straight.mp3', import.meta.url).href,
  updated: new URL('./assets/coach-voice/route-updated.mp3', import.meta.url).href,
  arrived: new URL('./assets/coach-voice/arrived.mp3', import.meta.url).href,
  distance: new URL('./assets/coach-voice/following-distance.mp3', import.meta.url).href,
  scan: new URL('./assets/coach-voice/intersection-scan.mp3', import.meta.url).href,
};
