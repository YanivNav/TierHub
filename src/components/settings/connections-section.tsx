"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { PROVIDERS, type OAuthProviderId } from "@/lib/oauth-providers";
import { Button } from "@/components/ui/button";

export default function ConnectionsSection() {
  const [connected, setConnected] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<OAuthProviderId | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await authClient.listAccounts();
    const ids = (data ?? []).map(
      (a) => (a as { providerId?: string; provider?: string }).providerId ??
        (a as { provider?: string }).provider ?? ""
    );
    setConnected(new Set(ids));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (provider: OAuthProviderId) => {
    setError("");
    setBusy(provider);
    // Redirects to the provider on success; only returns here on error.
    const { error } = await authClient.linkSocial({
      provider,
      callbackURL: "/settings",
    });
    if (error) {
      setError(getAuthErrorMessage(error, "oauth"));
      setBusy(null);
    }
  };

  const disconnect = async (provider: OAuthProviderId) => {
    setError("");
    setBusy(provider);
    const { error } = await authClient.unlinkAccount({ providerId: provider });
    if (error) setError(getAuthErrorMessage(error, "profile"));
    await load();
    setBusy(null);
  };

  if (connected === null) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted/60" />;
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-foreground">
        Connected accounts
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Connect a provider to sign in with it.
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {PROVIDERS.map((p) => {
          const isConnected = connected.has(p.id);
          const isBusy = busy === p.id;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0">{p.icon}</span>
                <p className="text-sm text-foreground">{p.label}</p>
              </div>
              {isConnected ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => disconnect(p.id)}
                  className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {isBusy ? "Removing…" : "Disconnect"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => connect(p.id)}
                  className="shrink-0 border-border text-foreground hover:text-foreground"
                >
                  {isBusy ? "Connecting…" : "Connect"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-sm text-red-400">{error || " "}</p>
    </section>
  );
}
