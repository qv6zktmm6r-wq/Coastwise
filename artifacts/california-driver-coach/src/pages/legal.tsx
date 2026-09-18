import { Link } from 'wouter';
import { Camera, ExternalLink, FileText, HardDrive, LockKeyhole, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader as LegacyPageHeader, SafetyNote } from '@/components/shared';
import { useEffect, type ReactNode } from 'react';
import { PageHeader } from '../components/shared';

const updatedDate = 'September 17, 2026';

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7"><h2 className="font-display text-2xl">{title}</h2><div className="mt-3 space-y-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{children}</div></section>;
}

function LegalLinks() {
  return <nav className="flex flex-wrap gap-3 text-sm font-bold" aria-label="Legal pages"><Link href="/privacy" className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 hover:border-[hsl(var(--primary))]">Privacy</Link><Link href="/terms" className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 hover:border-[hsl(var(--primary))]">Terms & safety</Link><Link href="/settings" className="rounded-xl px-4 py-2.5 text-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary))]">Settings</Link></nav>;
}

export function PrivacyPage() {
  return <div data-testid="privacy-page"><LegacyPageHeader eyebrow="Privacy" title="Your driving progress is private by default." copy={`Last updated ${updatedDate}. This notice explains what Coastwise stores, when information leaves your device, and the choices available to you.`} action={<LegalLinks />} />
    <div className="mb-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><HardDrive size={20} /><div className="mt-3 text-sm font-extrabold">Local first</div><p className="mt-1 text-xs leading-5 text-white/70">Core progress works without an account and stays in this browser.</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><LockKeyhole size={20} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-sm font-extrabold">Optional family sync</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Signing in is optional and only needed to share selected progress across devices.</p></div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><Camera size={20} className="text-[hsl(var(--primary))]" /><div className="mt-3 text-sm font-extrabold">Videos stay local</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Drive recordings are not uploaded by Coastwise.</p></div></div>
    <div className="space-y-4">
      <LegalSection title="Information stored on your device"><p>Coastwise stores the student profile name, permit and target dates, handbook answers, practice history, settings, driving missions, supervised-drive logs, coaching annotations, and recorded drive videos in browser storage on the device you use.</p><p>No account is required for these features. You can download a progress backup, restore it later, or reset local progress from Settings.</p></LegalSection>
      <LegalSection title="Camera and location permissions"><p><Camera size={16} className="mr-2 inline text-[hsl(var(--primary))]" />Camera access is used only when you choose to record the road for a local drive review.</p><p><MapPin size={16} className="mr-2 inline text-[hsl(var(--primary))]" />Location access is used to build a route, show route progress, estimate speed and distance, and help return to the starting area. Location is sent to the routing service only when a route is requested.</p><p>You can deny or revoke either permission in device or browser settings. Permit practice and previously saved local content remain available without these permissions.</p></LegalSection>
      <LegalSection title="Optional accounts and family sharing"><p>If you choose family sharing, Coastwise uses an authentication provider to identify members of the family plan. Practice results, goals, settings, and drive-log summaries such as date, duration, notes, and skills may sync to Coastwise cloud storage and become visible to authorized family members.</p><p>Family sharing is optional. Precise drive routes, coaching-event positions, annotations, recording formats, and drive video files remain on the recording device and are not included in cloud sync. A parent can remove other family members from Settings.</p></LegalSection>
      <LegalSection title="Services Coastwise contacts"><p>Route requests are sent to an external routing service and may include approximate starting coordinates and generated waypoints. Optional sign-in uses Clerk authentication. Hosting and application infrastructure may process standard technical data needed to deliver requests, such as IP address, browser type, timestamps, and error logs.</p><p>Coastwise does not sell personal information or use local drive recordings for advertising.</p></LegalSection>
      <LegalSection title="Retention, backup, and deletion"><p><Trash2 size={16} className="mr-2 inline text-[hsl(var(--destructive))]" />Use “Reset local progress” to remove local progress and saved videos from the current device. Clearing browser data or uninstalling can also remove local information. Download a backup first if you want to keep progress.</p><p>Resetting a device unlinks it from sync but does not delete the family’s existing cloud progress. Signing out stops account access on that device. A family parent can remove other members. Coastwise does not currently provide self-service deletion of the shared family record, so do not enable optional sync if you require that control.</p></LegalSection>
      <LegalSection title="Teen and guardian expectations"><p>Coastwise is intended to be used with the knowledge and supervision of a parent, guardian, or other responsible adult. The supervising adult should review permissions, family access, and recording choices with the teen driver.</p></LegalSection>
      <LegalSection title="Questions"><p>For questions, contact the person or organization that provided your Coastwise access. Do not send drive videos or precise route details in a support message.</p></LegalSection>
    </div>
    <div className="mt-6"><SafetyNote /></div>
  </div>;
}

export function TermsPage() {
  return <div data-testid="terms-page"><LegacyPageHeader eyebrow="Terms & safety" title="Use Coastwise as a coach—not as the driver." copy={`Last updated ${updatedDate}. By using Coastwise, you agree to these safety and acceptable-use terms.`} action={<LegalLinks />} />
    <div className="space-y-4">
      <LegalSection title="Educational use only"><p>Coastwise provides study, planning, logging, and coaching support. It is not the California DMV, a driving school, a licensed instructor, legal advice, or a substitute for the current California Driver’s Handbook and official DMV materials.</p></LegalSection>
      <LegalSection title="Supervision and attention"><p>A permitted teen driver must follow applicable law and drive only with an eligible supervising adult. The driver must keep eyes and attention on the road. Only a passenger should operate Coastwise while the vehicle is moving.</p><p>Mount the device securely without blocking the driver’s view or vehicle controls. Do not begin or continue a coached drive when conditions, permissions, equipment, or supervision are unsafe.</p></LegalSection>
      <LegalSection title="Routes and spoken coaching"><p>Routes and instructions can be incomplete, delayed, unavailable, or wrong. Road closures, signs, traffic controls, emergency directions, and the supervising adult always take priority. Never make a sudden or illegal maneuver to follow Coastwise.</p><p>If a route fails, continue safely, pull over when appropriate, and use a trusted navigation or emergency service.</p></LegalSection>
      <LegalSection title="Recording responsibly"><p>Record only the road ahead when lawful and appropriate. Do not intentionally record private conversations, homes, faces, license plates, or other sensitive information. Follow local recording and device-mounting laws. Coastwise stores recordings locally, but anyone with access to the unlocked device may be able to view them.</p></LegalSection>
      <LegalSection title="Accounts and family access"><p>An account is not required for local coaching. If you enable optional family sharing, you are responsible for inviting only trusted people, reviewing their access, protecting sign-in methods, and removing access when it is no longer appropriate.</p></LegalSection>
      <LegalSection title="Availability and responsibility"><p>Coastwise may depend on browser storage, device sensors, internet access, and external route services. Features may not work on every device or in every location. Keep required official records separately and maintain backups of progress you need to preserve.</p></LegalSection>
      <LegalSection title="Acceptable use"><p>Do not use Coastwise to break the law, distract a driver, monitor someone without permission, upload malicious content, interfere with the service, or misrepresent practice hours or driving eligibility.</p></LegalSection>
      <LegalSection title="Changes and support"><p>These terms may be updated as Coastwise changes. The current revision date appears above. For questions, contact the person or organization that provided your Coastwise access.</p></LegalSection>
    </div>
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--secondary)/.55)] p-5 text-sm leading-6"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><div><strong>Before every drive:</strong> confirm the vehicle is parked, the supervising adult is ready, the device is mounted, and everyone has reviewed the route and conditions.</div></div>
  </div>;
}

const policyEffectiveDate = 'September 18, 2026';

const privacyContact = 'privacy@coastwise.app';

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const privacy = kind === 'privacy';

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    document.title = `${privacy ? 'Privacy Policy' : 'Terms & Safety'} — Coastwise`;
    if (description) {
      description.content = privacy
        ? 'Learn how Coastwise uses camera and GPS permissions, stores family driving data locally, handles backups and sharing, and supports deletion.'
        : 'Read Coastwise terms for supervised teen driving practice, educational-use limits, guardian responsibilities, and essential safety guidance.';
    }
    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.content = previousDescription;
    };
  }, [privacy]);

  return <div className="mx-auto max-w-4xl">
    <PageHeader
      eyebrow={privacy ? 'Privacy Policy' : 'Terms & Safety'}
      title={privacy ? 'Your family’s data stays close.' : 'Practice safely. Keep an adult in charge.'}
      copy={privacy
        ? 'What Coastwise stores, when information leaves your device, and how your family can delete it.'
        : 'The limits of Coastwise’s educational guidance and the responsibilities of teen drivers and supervising adults.'}
      action={<span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">Effective {policyEffectiveDate}</span>}
    />
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-9">
      {privacy ? <>
        <PolicySection title="The short version">
          <p>You can use Coastwise without an account. Your profile, study progress, settings, drive logs, coaching notes, and saved drive recordings are stored in this browser on this device. We do not sell this information.</p>
          <p><strong className="text-[hsl(var(--foreground))]">Drive recordings remain device-local.</strong> They are not included in backups or uploaded by Coastwise. If that behavior changes, this policy will be updated before the new behavior is introduced.</p>
        </PolicySection>
        <PolicySection title="Optional account and family sync">
          <p>If you create an account or sign in, Coastwise’s authentication provider processes your account details, such as your email address, to sign you in. If you join a Coastwise family, profile information, study progress, settings, drive logs, coaching events, and route details are sent to Coastwise’s service and stored so approved family members can use them across devices.</p>
          <p>Drive video and audio files are removed from synced data and stay in the browser where they were recorded. Family members with access may still see synced drive details, routes, and coaching-event notes.</p>
        </PolicySection>
        <PolicySection title="Camera and microphone">
          <p>Coastwise asks for camera and microphone permission only when you choose to record a supervised drive. The browser shows the preview and creates the recording. You may deny permission and use other parts of Coastwise without recording.</p>
          <p>Other people who can use this device or browser profile may be able to open locally saved recordings in Coastwise.</p>
        </PolicySection>
        <PolicySection title="Location and GPS">
          <p>Coastwise asks for location permission when you build or follow a coached route. Current GPS readings support the map, route position, distance, speed estimates, and coaching cues.</p>
          <p>When you request a route, route details derived from your location are sent to Coastwise’s route service to create directions. Coastwise does not use GPS for advertising. You may deny or stop location access, but live route features will not work.</p>
        </PolicySection>
        <PolicySection title="Local storage, backups, and sharing">
          <p>Browser storage holds the student profile, permit answers, preferences, drive logs, annotations, and recordings. Clearing browser data, uninstalling the app, resetting Coastwise, or losing the device may permanently remove that information.</p>
          <p>A downloaded backup contains profile information, study progress, settings, and drive logs. It does not contain drive videos. The file leaves the device only when you download, move, or share it. A family summary or drive review is shared only when you choose a share action; the destination app or person then controls the copy you send.</p>
        </PolicySection>
        <PolicySection title="Deleting your information">
          <p>Open <Link href="/settings" className="font-bold text-[hsl(var(--primary))] underline underline-offset-4">Settings</Link> and choose <strong className="text-[hsl(var(--foreground))]">Reset local progress</strong> to delete Coastwise progress, logs, annotations, and saved drive videos from this browser. A local reset does not delete family progress already synced to Coastwise’s service. Contact us at the address below to ask about deleting cloud family data. Copies you exported or shared must also be deleted separately.</p>
        </PolicySection>
        <PolicySection title="Teens and guardians">
          <p>A parent or legal guardian should review this policy with a minor, decide whether camera and location access are appropriate, and supervise the minor’s use. Do not record passengers or bystanders without any consent required by law.</p>
        </PolicySection>
        <PolicySection title="Questions or privacy requests">
          <p>Email <a href={`mailto:${privacyContact}`} className="font-bold text-[hsl(var(--primary))] underline underline-offset-4">{privacyContact}</a>. We cannot view, recover, or delete information stored only on your device. Include no sensitive driving details in an email unless they are needed for your request.</p>
        </PolicySection>
      </> : <>
        <PolicySection title="Educational use only">
          <p>Coastwise provides study questions, practice planning, progress tracking, and general driving guidance. It is not the California DMV, a licensing authority, a driving school, a licensed driving instructor, legal advice, or a guarantee that anyone will pass a test or drive safely.</p>
          <p>The current California Driver’s Handbook, official DMV instructions, traffic laws, road signs, and directions from law enforcement take priority over Coastwise.</p>
        </PolicySection>
        <PolicySection title="The supervising adult remains responsible">
          <p>A qualified, attentive supervising adult must be present whenever the law requires supervision. That adult—not Coastwise—must decide whether the driver, vehicle, route, weather, traffic, and conditions are safe.</p>
          <p>Mount and set up the device before moving. Never read, tap, aim a camera, or troubleshoot Coastwise while driving. Pull over legally and stop if the app needs attention. Ignore any cue that is unsafe, unclear, late, or conflicts with actual conditions.</p>
        </PolicySection>
        <PolicySection title="Minors and guardian permission">
          <p>A minor may use Coastwise only with permission and oversight from a parent or legal guardian. The guardian should review permissions, local recordings, exported backups, and anything the family chooses to share. Families are responsible for following recording, privacy, learner-permit, and supervision laws.</p>
        </PolicySection>
        <PolicySection title="GPS, camera, and availability">
          <p>GPS, maps, speed estimates, route guidance, camera recording, audio, storage, and notifications may be delayed, inaccurate, interrupted, or unavailable. Coastwise is not an emergency service and must not be relied on to prevent a collision, locate a person, preserve evidence, or contact help.</p>
          <p>In an emergency, stop when safe and contact local emergency services. Do not continue a practice drive because Coastwise says a route or session is ready.</p>
        </PolicySection>
        <PolicySection title="Your content and acceptable use">
          <p>Your family is responsible for profile details, notes, recordings, backups, and shared summaries created with Coastwise. Use the app only for lawful, supervised driver education. Do not use it to secretly record people, distract a driver, violate privacy, or encourage unsafe or illegal driving.</p>
        </PolicySection>
        <PolicySection title="Changes and questions">
          <p>When material changes affect privacy, permissions, recordings, or safety responsibilities, Coastwise will update the effective date and provide updated notice in the app.</p>
          <p>Questions can be sent to <a href={`mailto:${privacyContact}`} className="font-bold text-[hsl(var(--primary))] underline underline-offset-4">{privacyContact}</a>.</p>
        </PolicySection>
      </>}
    </div>
  </div>;
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-[hsl(var(--border))] py-7 first:border-0 first:pt-0">
    <h2 className="font-display text-2xl">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{children}</div>
  </section>;
}
