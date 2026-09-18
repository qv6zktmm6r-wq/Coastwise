import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/react';
import { AppState, Appearance, isRecord, parseStoredState, storageKey } from '../lib/state';
import { ActionButton, PageHeader, SafetyNote } from '../components/shared';
import { useCreateFamilyInvite, useGetFamilyMembership, useRevokeFamilyMember, useAcceptFamilyInvite, getGetFamilyMembershipQueryKey } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { mergeStates } from '../lib/sync';
import { clearDriveRecordings } from '../lib/route-coach';
import { Settings, SunMedium, Moon, HardDrive, Download, Upload, ShieldCheck, LockKeyhole, Pencil, Check, RefreshCw, AlertTriangle, Link as LinkIcon, Trash2, ChevronRight } from 'lucide-react';
import { materialPolicyNotices, type PolicyAcknowledgement } from '../lib/policy-notice';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function InstallCoastwise() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);
  if (installed) return <p className="text-xs font-semibold text-[hsl(var(--success))]" role="status">Coastwise is installed on this device.</p>;
  if (!installPrompt) return <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">On iPhone or iPad, use Share → Add to Home Screen. On Android or desktop, use the browser’s Install option.</p>;
  const install = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  return <ActionButton onClick={() => void install()} variant="secondary" testId="button-install-coastwise"><Download size={16} />Install Coastwise</ActionButton>;
}

export default function SettingsPage({ state, setState, syncManager, policyAcknowledgements }: { state: AppState; setState: (next: AppState) => void; syncManager: any; policyAcknowledgements: PolicyAcknowledgement[] }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  
  const [name, setName] = useState(state.profile.name);
  const [backupMessage, setBackupMessage] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: membership, refetch: refetchMembership } = useGetFamilyMembership({
    query: { enabled: !!isSignedIn, queryKey: getGetFamilyMembershipQueryKey() }
  });

  const createInvite = useCreateFamilyInvite();
  const revokeMember = useRevokeFamilyMember();
  const acceptInvite = useAcceptFamilyInvite();

  const handleCreateInvite = async (role: 'parent' | 'student') => {
    try {
      const invite = await createInvite.mutateAsync({ data: { role } });
      setInviteToken(invite.token);
      setBackupMessage(`Family ready. Share the ${role} invite below.`);
      await refetchMembership();
    } catch (e) {
      setBackupMessage('Could not create that invite. Please try again.');
    }
  };

  const handleRevokeMember = async (memberId: string) => {
    try {
      await revokeMember.mutateAsync({ memberId });
      refetchMembership();
    } catch (e) {
      setBackupMessage('Could not remove that family member. Please try again.');
    }
  };

  const handleAcceptInvite = async (token: string) => {
    if (!token) return;
    try {
      await acceptInvite.mutateAsync({ token });
      setJoinToken('');
      await refetchMembership();
      await syncManager.refetch();
    } catch (e) {
      console.error(e);
      setBackupMessage('Could not accept invite. It may be invalid or expired.');
    }
  };

  // Check for inviteToken in URL hash or search (wouter doesn't have useSearchParams easily accessible, so parse window.location)
  useEffect(() => {
    if (isSignedIn) {
      const searchParams = new URLSearchParams(window.location.search);
      const urlToken = searchParams.get('inviteToken');
      if (urlToken) {
        handleAcceptInvite(urlToken);
        // remove token from url
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [isSignedIn]);

  const saveProfile = (event: React.FormEvent) => { event.preventDefault(); if (name.trim()) setState({ ...state, profile: { ...state.profile, name: name.trim() } }); };
  const toggle = (key: 'parentMode' | 'reminders' | 'sounds') => setState({ ...state, settings: { ...state.settings, [key]: !state.settings[key] } });
  const resetProgress = async () => {
    setResetting(true);
    try {
      await clearDriveRecordings();
      window.localStorage.removeItem(storageKey);
      const freshState = parseStoredState(null);
      syncManager.unlinkDevice();
      setState(freshState);
      setName(freshState.profile.name);
      setBackupMessage('Local progress and saved videos were reset. Cloud family progress was not deleted.');
      setResetConfirming(false);
    } catch {
      setBackupMessage('Progress could not be fully reset. Try again.');
    } finally {
      setResetting(false);
    }
  };
  
  const exportProgress = () => {
    const exportableState: AppState = {
      ...state,
      sessions: state.sessions.map((session) => session.review ? {
          id: session.id,
        date: session.date,
        minutes: session.minutes,
        night: session.night,
        notes: session.notes,
        distanceMiles: session.distanceMiles,
        skills: session.skills,
        routeTitle: session.routeTitle,
      } : session),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportableState, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `coastwise-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBackupMessage('Progress backup downloaded. Drive videos are not included.');
  };
  
  const importProgress = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const contents = await file.text();
      const candidate: unknown = JSON.parse(contents);
      if (!isRecord(candidate) || !isRecord(candidate.profile) || !Array.isArray(candidate.sessions) || !Array.isArray(candidate.topics)) {
        throw new Error('Invalid Coastwise backup');
      }
      const restored = parseStoredState(contents);
      const restoredWithoutVideos: AppState = {
        ...restored,
        sessions: restored.sessions.map((session) => session.review ? {
          id: session.id,
          date: session.date,
          minutes: session.minutes,
          night: session.night,
          notes: session.notes,
          distanceMiles: session.distanceMiles,
          skills: session.skills,
          routeTitle: session.routeTitle,
        } : session),
      };
      const merged = mergeStates(state, restoredWithoutVideos as any);
      setState(merged);
      setName(merged.profile.name);
      setBackupMessage('Progress merged with this device. Existing newer cloud data was not overwritten, and drive videos were not imported.');
    } catch {
      setBackupMessage('That file could not be restored. Choose a Coastwise progress backup.');
    }
  };

  const appearanceChoices: { value: Appearance; title: string; copy: string; icon: any }[] = [
    { value: 'system', title: 'Device', copy: 'Match this phone or computer.', icon: Settings },
    { value: 'light', title: 'Light', copy: 'Use bright, calm surfaces.', icon: SunMedium },
    { value: 'dark', title: 'Dark', copy: 'Reduce glare in low light.', icon: Moon },
  ];

  return <div><PageHeader eyebrow="Settings" title="Make the plan yours." copy="Adjust your profile, family sharing, and how Coastwise supports practice." />
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="space-y-5">
        <section className="grid gap-5 sm:grid-cols-2" aria-label="App ownership and local data">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6" data-testid="install-settings-card"><h2 className="font-display text-2xl">Install Coastwise</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Use local coaching without an account, or sign in for family sync.</p><div className="my-5 border-y border-[hsl(var(--border))] py-4" data-testid="legal-links-card"><p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">Before installing, review how Coastwise uses camera and location access, stores recordings locally, and optionally syncs family progress.</p><div className="mt-3 flex flex-wrap gap-2"><Link href="/privacy" className="text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-privacy">Privacy Policy</Link><span aria-hidden="true" className="text-[hsl(var(--border))]">•</span><Link href="/terms" className="text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-terms">Terms & safety</Link></div></div><InstallCoastwise /></div>
          <div className="rounded-2xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.04)] p-6" data-testid="reset-progress-card"><h2 className="font-display text-2xl">Reset this device</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Delete local progress, annotations, and saved videos. Cloud family progress is not deleted.</p>{!resetConfirming ? <ActionButton onClick={() => setResetConfirming(true)} variant="outline" className="mt-5" testId="button-reset-progress">Reset local progress</ActionButton> : <div className="mt-5"><p className="text-sm font-bold">This cannot be undone without a backup.</p><div className="mt-3 flex flex-wrap gap-2"><ActionButton onClick={() => void resetProgress()} disabled={resetting} testId="button-confirm-reset">{resetting ? 'Resetting…' : 'Yes, reset this device'}</ActionButton><ActionButton onClick={() => setResetConfirming(false)} variant="quiet" testId="button-cancel-reset">Cancel</ActionButton></div></div>}</div>
        </section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7" aria-labelledby="privacy-safety-heading">
          <div className="mb-5">
            <h2 id="privacy-safety-heading" className="font-display text-2xl">Privacy and safety</h2>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Review how Coastwise uses permissions, keeps local data, and supports supervised practice.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/privacy" className="flex min-h-11 items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.35)]" data-testid="link-settings-privacy">Privacy Policy<ChevronRight size={17} /></Link>
            <Link href="/terms" className="flex min-h-11 items-center justify-between rounded-xl border border-[hsl(var(--border))] px-4 py-3 text-sm font-bold hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.35)]" data-testid="link-settings-terms">Terms &amp; Safety<ChevronRight size={17} /></Link>
          </div>
          <div className="mt-5" data-testid="policy-acknowledgement-history">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold">Material update history</h3>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Acknowledgements are kept only in this browser. They are not synced or included in progress backups.</p>
              </div>
            </div>
            <ol className="space-y-3">
              {materialPolicyNotices.map((notice, index) => {
                const acknowledgement = policyAcknowledgements.find((record) => record.version === notice.version);
                return <li id={`policy-update-${notice.version}`} key={notice.version} className="rounded-xl bg-[hsl(var(--secondary)/.45)] p-4" data-testid={`policy-update-${notice.version}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold">{index === 0 ? 'Latest: ' : ''}{notice.title}</h4>
                    <span className="font-mono-ui text-[11px] text-[hsl(var(--muted-foreground))]">Effective {notice.effectiveDate}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{notice.summary}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                    {notice.changes.map((change) => <li key={change}>{change}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs font-bold ${acknowledgement ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`} data-testid={`status-policy-acknowledgement-${notice.version}`}>
                      {acknowledgement
                        ? `Acknowledged on ${new Date(acknowledgement.acknowledgedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} on this device`
                        : index === 0 ? 'Acknowledgement required on this device' : 'Not acknowledged on this device'}
                    </p>
                    {index === 0
                      ? <div className="flex gap-3">
                          <Link href="/privacy" className="text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`link-policy-privacy-${notice.version}`}>Privacy text</Link>
                          <Link href="/terms" className="text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`link-policy-terms-${notice.version}`}>Safety terms</Link>
                        </div>
                      : <Link href={`/policy-updates#policy-update-${notice.version}`} className="text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`link-policy-archive-${notice.version}`}>Review archived summary</Link>}
                  </div>
                </li>;
              })}
            </ol>
          </div>
        </section>
        
        {/* Account and Family Section */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7">
          <div className="mb-5">
            <h2 className="font-display text-2xl">Family sharing</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Share practice progress safely across devices.</p>
          </div>
          
          {isLoaded && !isSignedIn && (
            <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-5 text-center">
              <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Sign in to connect devices and share progress with your family.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <ActionButton href="/sign-in" variant="primary">Sign in</ActionButton>
                <ActionButton href="/sign-up" variant="outline">Create account</ActionButton>
              </div>
            </div>
          )}

          {isLoaded && isSignedIn && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-5">
                <div>
                  <div className="font-bold text-sm">{user?.primaryEmailAddress?.emailAddress}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Signed in</div>
                </div>
                <ActionButton variant="outline" onClick={() => signOut({ redirectUrl: '/' })}>Sign out</ActionButton>
              </div>

              {membership && (
                <div>
                  <h3 className="font-bold text-sm mb-3">Family members</h3>
                  <div className="space-y-3">
                    {membership.members.map((m: any) => (
                      <div key={m.memberId} className="flex items-center justify-between rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                        <div>
                          <div className="font-bold text-sm">{m.role === 'parent' ? 'Parent / Coach' : 'Student Driver'}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.memberId === membership.memberId ? '(You)' : 'Family member'}</div>
                        </div>
                        {membership.role === 'parent' && m.memberId !== membership.memberId && (
                          <button onClick={() => handleRevokeMember(m.memberId)} className="p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] rounded-lg" aria-label="Remove member">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {membership.role === 'parent' && (
                    <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                      <h4 className="text-xs font-bold mb-2">Invite a member</h4>
                      <div className="flex gap-2">
                        <ActionButton variant="secondary" onClick={() => handleCreateInvite('student')}>Invite Student</ActionButton>
                        <ActionButton variant="secondary" onClick={() => handleCreateInvite('parent')}>Invite Parent</ActionButton>
                      </div>
                      {inviteToken && (
                        <div className="mt-3 p-3 bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] rounded-xl text-xs break-all border border-[hsl(var(--primary)/.2)]">
                          <strong>Invite token:</strong> {inviteToken}
                          <p className="mt-1 text-[hsl(var(--primary)/.7)]">Share this token. They can paste it in their settings after signing in.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!membership && (
                <div className="rounded-xl border border-[hsl(var(--border))] p-4 mt-2">
                  <h4 className="text-xs font-bold mb-2">Start or join a family</h4>
                  <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">A supervising adult can start a family and invite a student. If someone already invited you, paste their token instead.</p>
                  <ActionButton variant="secondary" onClick={() => handleCreateInvite('student')} disabled={createInvite.isPending}>
                    {createInvite.isPending ? 'Starting family…' : 'Start family as parent'}
                  </ActionButton>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Paste invite token..." 
                      value={joinToken} 
                      onChange={(e) => setJoinToken(e.target.value)} 
                      className="flex-1 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm" 
                    />
                    <ActionButton variant="primary" onClick={() => handleAcceptInvite(joinToken)} disabled={!joinToken}>Join</ActionButton>
                  </div>
                </div>
              )}

              {/* Sync Status & Conflict Resolution */}
              {syncManager.conflict && (
                <div className="rounded-xl border border-[hsl(var(--warning)/.5)] bg-[hsl(var(--warning)/.1)] p-5">
                  <div className="flex items-center gap-2 text-[hsl(var(--warning))] font-bold mb-2">
                    <AlertTriangle size={18} /> Sync Conflict
                  </div>
                  <p className="text-xs text-[hsl(var(--warning-foreground))] mb-4">
                    The cloud has newer or different progress than this device.
                  </p>
                  <div className="flex flex-col gap-2">
                    <ActionButton variant="secondary" onClick={syncManager.mergeAndSave}>
                      Merge device & cloud
                    </ActionButton>
                    <ActionButton variant="secondary" onClick={syncManager.useCloudOnly}>
                      Use cloud data only
                    </ActionButton>
                  </div>
                </div>
              )}

              {membership && <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <RefreshCw size={14} className={syncManager.syncStatus === 'syncing' ? 'animate-spin' : ''} />
                {syncManager.syncStatus === 'syncing' ? 'Syncing...' : 
                 syncManager.syncStatus === 'error' ? 'Sync error. Retrying soon.' : 
                  syncManager.syncStatus === 'conflict' ? 'Review the conflict before more device changes sync.' :
                 'Progress synced to family cloud.'}
              </div>}
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7">
          <div className="mb-5"><h2 className="font-display text-2xl">Profile</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Personalize the dashboard.</p></div>
          <form onSubmit={saveProfile} className="flex gap-3">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--foreground))]" aria-label="First name" data-testid="input-first-name" />
            <ActionButton type="submit" disabled={name.trim() === state.profile.name || !name.trim()} testId="button-save-profile">Save</ActionButton>
          </form>
        </div>

        {/* Appearance Section */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7">
          <div className="mb-5"><h2 className="font-display text-2xl">Appearance</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Choose what feels comfortable. Device follows your system setting automatically.</p></div>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Appearance">
            {appearanceChoices.map((choice) => {
              const Icon = choice.icon;
              const selected = state.settings.appearance === choice.value;
              return <button key={choice.value} type="button" role="radio" aria-checked={selected} onClick={() => setState({ ...state, settings: { ...state.settings, appearance: choice.value } })} className={`flex flex-col items-center gap-3 rounded-xl border p-4 transition-all ${selected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.04)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground)/.3)] hover:bg-[hsl(var(--secondary)/.35)]'}`} data-testid={`button-appearance-${choice.value}`}><Icon size={24} className={selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'} /><span className="text-xs font-bold text-[hsl(var(--foreground))]">{choice.title}</span></button>;
            })}
          </div>
        </div>

        {/* Local Backup Section */}
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]"><HardDrive size={19} className="text-[hsl(var(--primary))]" /></div>
            <div><h2 className="font-display text-2xl">Progress backup</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Move permit progress manually if offline.</p></div>
          </div>
          <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">Backups include your profile, practice answers, settings, and drive log. Private drive videos stay only in the browser that recorded them.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton onClick={exportProgress} testId="button-export-progress"><Download size={16} />Download backup</ActionButton>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-bold hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.35)]">
              <Upload size={16} />Restore backup
              <input type="file" accept="application/json,.json" onChange={(event) => void importProgress(event)} className="sr-only" data-testid="input-import-progress" />
            </label>
            {isLoaded && isSignedIn && membership && (syncManager.conflict || !syncManager.isLinked) && (
              <ActionButton variant="outline" onClick={syncManager.uploadLocal}>
                <Upload size={16} />{syncManager.conflict ? 'Force local to cloud' : 'Sync this device to family cloud'}
              </ActionButton>
            )}
          </div>
          {backupMessage && <p className="mt-4 text-xs font-semibold text-[hsl(var(--primary))]" role="status" data-testid="progress-backup-status">{backupMessage}</p>}
        </div>
      </section>

      <aside className="space-y-5">
        <div className="rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--sidebar-primary))]"><ShieldCheck size={15} />Built for safe progress</div>
          <h3 className="mt-4 font-display text-3xl">Private by default.</h3>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--primary-foreground)/.68)]">Your drive review videos, precise routes, and coaching-event positions stay local and are never uploaded to the cloud. Only practice results, goals, settings, and drive-log summaries sync across your family's devices.</p>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary-foreground)/.78)]"><LockKeyhole size={14} />Local-only videos</div>
        </div>
        <SafetyNote />
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold"><Pencil size={16} className="text-[hsl(var(--accent))]" />California essentials</div>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />Permit held at least 6 months before the drive test.</li>
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />50 supervised practice hours, including 10 at night.</li>
            <li className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />6 hours of professional driver instruction.</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>;
}
