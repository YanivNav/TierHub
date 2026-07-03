import "server-only";
import { CHECKOUT_SLUGS, CREDIT_PACKS } from "@/lib/plans";

/**
 * Maps our checkout slugs to real Polar product IDs (from env) and back again
 * for webhook handling. Product IDs are secrets-ish and never sent to the client
 * — the client only references the slugs in `lib/plans.ts`.
 */

const PRODUCT_ENV: Record<string, string | undefined> = {
  [CHECKOUT_SLUGS.proMonthly]: process.env.POLAR_PRODUCT_PRO_MONTHLY,
  [CHECKOUT_SLUGS.proAnnual]: process.env.POLAR_PRODUCT_PRO_ANNUAL,
  [CHECKOUT_SLUGS.credits100]: process.env.POLAR_PRODUCT_CREDITS_100,
};

/** Checkout products for the Polar Better Auth `checkout()` plugin. */
export function checkoutProducts(): { productId: string; slug: string }[] {
  return Object.entries(PRODUCT_ENV)
    .filter(([, productId]) => Boolean(productId))
    .map(([slug, productId]) => ({ productId: productId as string, slug }));
}

/** True once at least the Pro products + access token are configured. */
export function isPolarConfigured(): boolean {
  return Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_PRODUCT_PRO_MONTHLY);
}

const PRO_PRODUCT_IDS = new Set(
  [process.env.POLAR_PRODUCT_PRO_MONTHLY, process.env.POLAR_PRODUCT_PRO_ANNUAL].filter(
    Boolean
  ) as string[]
);

export function isProSubscriptionProduct(productId: string | undefined | null): boolean {
  return Boolean(productId && PRO_PRODUCT_IDS.has(productId));
}

/** Credits granted by a one-time credit-pack product, or 0 if not a pack. */
export function creditsForProduct(productId: string | undefined | null): number {
  if (!productId) return 0;
  for (const pack of CREDIT_PACKS) {
    if (PRODUCT_ENV[pack.slug] === productId) return pack.credits;
  }
  return 0;
}
