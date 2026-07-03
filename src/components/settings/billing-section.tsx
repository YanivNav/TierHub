"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PRO_PRICING, CREDIT_PACKS } from "@/lib/plans";

export default function BillingSection() {
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

  return (
    <div className="space-y-8">
      {/* Plan + credits */}
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

          {s && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{s.totalCredits}</span>{" "}
              AI generations left
              {" — "}
              {s.monthlyRemaining}/{s.monthlyAllowance} monthly
              {s.purchasedCredits > 0 && <> + {s.purchasedCredits} purchased</>}
              {s.creditsResetAt && (
                <> · resets {new Date(s.creditsResetAt).toLocaleDateString()}</>
              )}
            </p>
          )}
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
