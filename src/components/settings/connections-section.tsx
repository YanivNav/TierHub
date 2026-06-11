"use client";

import { useState } from "react";
import { useUser, useReverification } from "@clerk/nextjs";
import type { ExternalAccountResource, OAuthStrategy } from "@clerk/types";
import { trpc } from "@/lib/trpc/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { PROVIDERS } from "@/lib/oauth-providers";
import { Button } from "@/components/ui/button";

/** Clerk reports providers without the `oauth_` prefix (e.g. "google"). */
const providerKey = (strategy: OAuthStrategy) => strategy.replace("oauth_", "");

export default function ConnectionsSection() {
  const { user, isLoaded } = useUser();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState<OAuthStrategy | null>(null);
  const [error, setError] = useState("");

  // Disconnecting an account is sensitive — wrap it so Clerk can require a
  // recent sign-in (step-up) if the instance is configured for it.
  const destroyAccount = useReverification((account: ExternalAccountResource) =>
    account.destroy()
  );

  if (!isLoaded || !user) {
    return <div className="h-24 animate-pulse rounded-lg bg-zinc-800/60" />;
  }

  const accountFor = (strategy: OAuthStrategy) =>
    user.externalAccounts.find((a) => a.provider === providerKey(strategy));

  const connect = async (strategy: OAuthStrategy) => {
    setError("");
    setBusy(strategy);
    try {
      const account = await user.createExternalAccount({
        strategy,
        redirectUrl: window.location.href,
      });
      const url = account.verification?.externalVerificationRedirectURL;
      if (url) {
        window.location.href = url.toString();
        return;
      }
      await user.reload();
    } catch (err) {
      setError(getAuthErrorMessage(err, "oauth"));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (account: ExternalAccountResource, strategy: OAuthStrategy) => {
    setError("");
    setBusy(strategy);
    try {
      await destroyAccount(account);
      await user.reload();
      await utils.user.getMe.invalidate();
    } catch (err) {
      setError(getAuthErrorMessage(err, "profile"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-zinc-300">
        Connected accounts
      </h2>
      <p className="mb-4 text-xs text-zinc-500">
        Connect a provider to sign in with it.
      </p>

      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
        {PROVIDERS.map((p) => {
          const account = accountFor(p.strategy);
          const identifier = account?.emailAddress || account?.username;
          const isBusy = busy === p.strategy;
          return (
            <li
              key={p.strategy}
              className="flex items-center justify-between gap-3 bg-zinc-900 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0">{p.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm text-white">{p.label}</p>
                  {account && identifier && (
                    <p className="truncate text-xs text-zinc-500">
                      {identifier}
                    </p>
                  )}
                </div>
              </div>
              {account ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => disconnect(account, p.strategy)}
                  className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {isBusy ? "Removing…" : "Disconnect"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => connect(p.strategy)}
                  className="shrink-0 border-zinc-700 text-zinc-200 hover:text-white"
                >
                  {isBusy ? "Connecting…" : "Connect"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
