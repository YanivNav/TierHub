/**
 * Plan, credit, and pricing definitions shared by client and server.
 *
 * Contains NO secrets. Checkout is driven by *slugs* (configured against real
 * Polar product IDs server-side in `src/server/billing/polar-products.ts`), so
 * the client only ever references the slugs below.
 */

export type Plan = "free" | "pro";

/**
 * Sentinel thrown (as a TRPCError message) when a generation is blocked for lack
 * of credits, so the client can show an upgrade CTA instead of a generic error.
 */
export const OUT_OF_CREDITS_ERROR = "OUT_OF_CREDITS";

/** AI generation credits granted per calendar month, by plan. */
export const MONTHLY_CREDITS: Record<Plan, number> = {
  free: 15,
  pro: 500,
};

export function monthlyCreditsForPlan(plan: Plan): number {
  return MONTHLY_CREDITS[plan];
}

/** Per-user storage cap (bytes) for uploaded item/cover images, by plan. */
export const STORAGE_LIMIT_BYTES: Record<Plan, number> = {
  free: 100 * 1024 * 1024, // 100 MB
  pro: 2 * 1024 * 1024 * 1024, // 2 GB
};

// ── Checkout slugs (the client ⇄ server contract) ────────────────────────────

export const CHECKOUT_SLUGS = {
  proMonthly: "pro-monthly",
  proAnnual: "pro-annual",
  credits100: "credits-100",
} as const;

export type CheckoutSlug = (typeof CHECKOUT_SLUGS)[keyof typeof CHECKOUT_SLUGS];

// ── Pricing (display only — source of truth for amounts is Polar) ────────────

export const PRO_PRICING = {
  monthly: { slug: CHECKOUT_SLUGS.proMonthly, priceLabel: "$6", period: "/mo" },
  annual: { slug: CHECKOUT_SLUGS.proAnnual, priceLabel: "$48", period: "/yr", note: "2 months free" },
} as const;

/** One-time credit packs. `credits` must match the Polar product's grant. */
export const CREDIT_PACKS = [
  { slug: CHECKOUT_SLUGS.credits100, credits: 100, priceLabel: "$5" },
] as const;

/** Feature bullets rendered on the pricing page / billing section. */
export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "Unlimited tier lists",
    `${MONTHLY_CREDITS.free} AI generations / month`,
    "Public sharing & discovery",
    "PNG export",
    "100 MB storage",
  ],
  pro: [
    "Everything in Free",
    `${MONTHLY_CREDITS.pro} AI generations / month`,
    "Higher rate limits",
    "No export watermark",
    "2 GB storage",
  ],
};
