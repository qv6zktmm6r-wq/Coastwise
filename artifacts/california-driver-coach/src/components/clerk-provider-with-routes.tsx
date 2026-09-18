import { useEffect, useRef } from "react";
import { ClerkProvider, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useLocation } from 'wouter';
import { useQueryClient } from "@tanstack/react-query";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(211 100% 50%)",
    colorForeground: "hsl(214 28% 16%)",       
    colorMutedForeground: "hsl(215 14% 45%)",  
    colorDanger: "hsl(4 78% 52%)",
    colorBackground: "hsl(0 0% 100%)",       
    colorInput: "hsl(214 18% 78%)",            
    colorInputForeground: "hsl(214 28% 16%)",  
    colorNeutral: "hsl(214 18% 87%)",          
  },
  elements: {
    cardBox: "w-[440px] max-w-full shadow-lg rounded-2xl border border-[hsl(var(--border))]",
    card: "!bg-[hsl(var(--card))]",
    footer: "!bg-[hsl(var(--secondary))]",
  },
};

// Helps user's webview stay up-to-date when the signed-in user changes by invalidating the QueryClient cache.
export function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

export function AppClerkProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to manage your family sharing",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start sharing progress today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}
