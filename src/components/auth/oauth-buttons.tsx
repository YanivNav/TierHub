"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { PROVIDERS, type OAuthProviderId } from "@/lib/oauth-providers";

export default function OAuthButtons() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState<OAuthProviderId | null>(null);

  const signInWith = async (provider: OAuthProviderId) => {
    setError("");
    setPending(provider);
    try {
      // Redirects to the provider, then back to /dashboard via the Better Auth
      // callback route. On error the promise resolves without redirecting.
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
      if (error) {
        setPending(null);
        setError(getAuthErrorMessage(error, "oauth"));
      }
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
            key={p.id}
            type="button"
            disabled={pending !== null}
            onClick={() => signInWith(p.id)}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === p.id ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-transparent" />
            ) : (
              p.icon
            )}
            Continue with {p.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-red-400">{error || " "}</p>
    </div>
  );
}
