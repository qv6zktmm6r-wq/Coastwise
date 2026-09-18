import { ReactNode } from 'react';
import { Link } from 'wouter';
import { Info } from 'lucide-react';

export function ActionButton({ children, onClick, href, variant = 'primary', className = '', disabled = false, type = 'button', testId }: { children: ReactNode; onClick?: () => void; href?: string; variant?: 'primary' | 'secondary' | 'quiet' | 'outline'; className?: string; disabled?: boolean; type?: 'button' | 'submit'; testId?: string }) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 ${variant === 'primary' ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm hover:shadow-md' : variant === 'secondary' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.75)]' : variant === 'outline' ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--secondary)/.35)]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'} ${className}`;
  if (href) return <Link href={href} className={classes} data-testid={testId}>{children}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled} className={classes} data-testid={testId}>{children}</button>;
}

export function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
    <div className="max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]"><span className="h-px w-7 bg-[hsl(var(--accent))]" />{eyebrow}</div>
      <h1 className="font-display text-4xl leading-[1.05] tracking-[-.03em] text-[hsl(var(--foreground))] md:text-5xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p>
    </div>
    {action}
  </header>;
}

export function SafetyNote() {
  return <div className="flex gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.45)] p-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><Info size={17} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><p><strong className="text-[hsl(var(--foreground))]">A note on safety.</strong> Coastwise is educational and is not the DMV. It never replaces a licensed instructor, the California Driver’s Handbook, or an attentive supervising adult.</p></div>;
}
