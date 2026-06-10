"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import type { OAuthStrategy } from "@clerk/types";

const PROVIDERS: {
  strategy: OAuthStrategy;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    strategy: "oauth_google",
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
      </svg>
    ),
  },
  {
    strategy: "oauth_github",
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.86c-3.06.67-3.71-1.48-3.71-1.48-.5-1.27-1.22-1.61-1.22-1.61-1-.69.08-.67.08-.67 1.1.08 1.68 1.14 1.68 1.14.98 1.69 2.58 1.2 3.21.92.1-.71.38-1.2.69-1.47-2.44-.28-5.01-1.22-5.01-5.44 0-1.2.43-2.18 1.14-2.95-.11-.28-.5-1.4.11-2.92 0 0 .93-.3 3.05 1.13a10.5 10.5 0 0 1 5.56 0c2.12-1.43 3.05-1.13 3.05-1.13.61 1.52.22 2.64.11 2.92.71.77 1.14 1.75 1.14 2.95 0 4.23-2.58 5.16-5.03 5.43.4.34.75 1.01.75 2.04v3.03c0 .3.2.64.76.53A11 11 0 0 0 12 1Z" />
      </svg>
    ),
  },
  {
    strategy: "oauth_discord",
    label: "Discord",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path
          fill="#5865F2"
          d="M20.32 4.91A19.8 19.8 0 0 0 15.4 3.4a13.6 13.6 0 0 0-.63 1.28 18.3 18.3 0 0 0-5.51 0A13.6 13.6 0 0 0 8.62 3.4 19.7 19.7 0 0 0 3.7 4.91 20.3 20.3 0 0 0 .2 18.62a19.9 19.9 0 0 0 6.04 3.04c.49-.66.92-1.36 1.29-2.1-.71-.27-1.39-.6-2.03-.99.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.04 0c.16.13.33.26.5.38-.64.39-1.32.72-2.03.99.37.74.8 1.44 1.29 2.1a19.84 19.84 0 0 0 6.04-3.04 20.27 20.27 0 0 0-3.5-13.71ZM8.02 15.33c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42Zm7.96 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.2 0 2.17 1.1 2.15 2.43 0 1.33-.94 2.42-2.15 2.42Z"
        />
      </svg>
    ),
  },
];

export default function OAuthButtons() {
  const { signIn, isLoaded } = useSignIn();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<OAuthStrategy | null>(null);

  const signInWith = async (strategy: OAuthStrategy) => {
    if (!isLoaded) return;
    setError("");
    setPending(strategy);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setPending(null);
      setError(
        isClerkAPIResponseError(err)
          ? (err.errors[0]?.longMessage ?? err.errors[0]?.message ?? "Could not continue")
          : "Could not continue"
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.strategy}
            type="button"
            disabled={!isLoaded || pending !== null}
            onClick={() => signInWith(p.strategy)}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === p.strategy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
            ) : (
              p.icon
            )}
            Continue with {p.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
