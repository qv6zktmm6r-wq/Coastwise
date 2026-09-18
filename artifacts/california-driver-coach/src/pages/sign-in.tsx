import { SignIn } from '@clerk/react';
import coastwiseLogo from '@/assets/coastwise-logo.svg';
import { Link } from 'wouter';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--background))]">
      <header className="flex h-[76px] items-center px-5 md:px-10 border-b border-[hsl(var(--border))]">
        <Link href="/" className="flex items-center gap-3">
          <img src={coastwiseLogo} alt="" aria-hidden="true" className="h-10 w-10" />
          <div>
            <div className="font-display text-[17px] leading-none">Coastwise</div>
            <div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
              driver coach
            </div>
          </div>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </main>
    </div>
  );
}
