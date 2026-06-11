"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { PROVIDERS } from "@/lib/oauth-providers";
import type { OAuthStrategy } from "@clerk/types";

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
      setError(getAuthErrorMessage(err, "oauth"));
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
