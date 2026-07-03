import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getServerUserId } from "@/server/auth";
import { CheckoutButton } from "@/components/pricing-actions";
import {
  PLAN_FEATURES,
  PRO_PRICING,
  CREDIT_PACKS,
  CHECKOUT_SLUGS,
} from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Pricing plans for TierHub. Start free, upgrade to Pro for more AI generations.",
};

export default async function PricingPage() {
  const userId = await getServerUserId();
  const isAuthed = userId !== null;

  return (
    <main className="flex-1 bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-4 py-12 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          TierHub Plans
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Build and share tier lists for free. Upgrade when you want more AI
          generations and higher limits.
        </p>

        <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Free</h2>
            <p className="mt-1 text-3xl font-bold">
              $0<span className="text-base font-normal text-muted-foreground">/mo</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {PLAN_FEATURES.free.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {isAuthed ? (
                <span className="text-sm text-muted-foreground">Your current plan</span>
              ) : (
                <Link
                  href="/sign-up"
                  className="text-sm font-medium text-blue-500 hover:text-blue-400"
                >
                  Get started free →
                </Link>
              )}
            </div>
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-xl border-2 border-blue-600 bg-card p-6">
            <h2 className="text-lg font-semibold">Pro</h2>
            <p className="mt-1 text-3xl font-bold">
              {PRO_PRICING.monthly.priceLabel}
              <span className="text-base font-normal text-muted-foreground">
                {PRO_PRICING.monthly.period}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or {PRO_PRICING.annual.priceLabel}
              {PRO_PRICING.annual.period} ({PRO_PRICING.annual.note})
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {PLAN_FEATURES.pro.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <CheckoutButton
                slug={CHECKOUT_SLUGS.proMonthly}
                label={`Go Pro — ${PRO_PRICING.monthly.priceLabel}${PRO_PRICING.monthly.period}`}
                isAuthed={isAuthed}
              />
              <CheckoutButton
                slug={CHECKOUT_SLUGS.proAnnual}
                label={`Annual — ${PRO_PRICING.annual.priceLabel}${PRO_PRICING.annual.period}`}
                isAuthed={isAuthed}
                variant="outline"
              />
            </div>
          </div>
        </div>

        {/* Credit packs */}
        <div className="mt-10 rounded-xl border border-border bg-card p-6 text-left">
          <h2 className="text-lg font-semibold">Credit packs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prefer not to subscribe? Buy a one-time pack — purchased credits never
            expire.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CREDIT_PACKS.map((pack) => (
              <CheckoutButton
                key={pack.slug}
                slug={pack.slug}
                label={`${pack.credits} credits · ${pack.priceLabel}`}
                isAuthed={isAuthed}
                variant="outline"
              />
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Prices in USD. Tax is calculated at checkout. Cancel anytime.
        </p>
      </section>
    </main>
  );
}
