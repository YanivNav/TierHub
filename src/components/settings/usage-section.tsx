"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PRO_PRICING, CREDIT_PACKS } from "@/lib/plans";

export default function UsageSection() {
  const status = trpc.billing.getStatus.useQuery();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const startCheckout = async (slug: string) => {
    setError("");
    setBusy(slug);
    try {
      await authClient.checkout({ slug });
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setError("");
    setBusy("portal");
    try {
      await authClient.customer.portal();
    } catch {
      setError("Couldn't open the billing portal. Please try again.");
      setBusy(null);
    }
  };

  const s = status.data;
  const isPro = s?.plan === "pro";

  const pct =
    s && s.monthlyAllowance > 0
      ? Math.round((s.monthlyRemaining / s.monthlyAllowance) * 100)
      : 0;
  const barColor =
    pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="space-y-8">
      {/* Monthly credits progress */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Credits
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          {s && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Monthly usage
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {s.monthlyRemaining} / {s.monthlyAllowance} remaining
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </div>
              {s.purchasedCredits > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  +{s.purchasedCredits} purchased credit
                  {s.purchasedCredits === 1 ? "" : "s"} (never expire)
                </p>
              )}
              {s.creditsResetAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Monthly allowance resets{" "}
                  {new Date(s.creditsResetAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Plan */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Plan</h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-semibold text-foreground">
                {isPro ? "Pro" : "Free"}
              </span>
              {s?.subscriptionStatus && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({s.subscriptionStatus})
                </span>
              )}
            </div>
            {isPro && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={openPortal}
              >
                Manage subscription
              </Button>
            )}
          </div>
          {isPro && s?.currentPeriodEnd && (
            <p className="mt-1 text-xs text-muted-foreground">
              {s.subscriptionStatus === "revoked" ? "Ends" : "Renews"}{" "}
              {new Date(s.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      </section>

      {/* Upgrade (free only) */}
      {!isPro && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Upgrade to Pro</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy !== null}
              onClick={() => startCheckout(PRO_PRICING.monthly.slug)}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {PRO_PRICING.monthly.priceLabel}
              {PRO_PRICING.monthly.period}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => startCheckout(PRO_PRICING.annual.slug)}
            >
              {PRO_PRICING.annual.priceLabel}
              {PRO_PRICING.annual.period} · {PRO_PRICING.annual.note}
            </Button>
          </div>
        </section>
      )}

      {/* Credit packs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Buy credits</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          One-time top-ups. Purchased credits never expire.
        </p>
        <div className="flex flex-wrap gap-2">
          {CREDIT_PACKS.map((pack) => (
            <Button
              key={pack.slug}
              variant="outline"
              disabled={busy !== null}
              onClick={() => startCheckout(pack.slug)}
            >
              {pack.credits} credits · {pack.priceLabel}
            </Button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
