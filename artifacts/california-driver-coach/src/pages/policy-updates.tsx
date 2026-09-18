import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { PageHeader } from '../components/shared';
import { materialPolicyNotices } from '../lib/policy-notice';

export default function PolicyUpdatesPage() {
  useEffect(() => {
    document.title = 'Privacy & safety update archive — Coastwise';
  }, []);

  return <div>
    <Link href="/settings" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-back-to-settings">
      <ArrowLeft size={17} />Back to Settings
    </Link>
    <PageHeader eyebrow="Privacy & safety" title="Material update archive" copy="Review the summaries Coastwise showed when privacy, recording, permissions, or safety responsibilities materially changed." />
    <div className="space-y-4">
      {materialPolicyNotices.map((notice) => <article id={`policy-update-${notice.version}`} key={notice.version} className="scroll-mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-7" data-testid={`archived-policy-update-${notice.version}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{notice.title}</h2>
          <span className="font-mono-ui text-[11px] text-[hsl(var(--muted-foreground))]">Effective {notice.effectiveDate}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{notice.summary}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[hsl(var(--foreground))]">
          {notice.changes.map((change) => <li key={change}>{change}</li>)}
        </ul>
      </article>)}
    </div>
  </div>;
}