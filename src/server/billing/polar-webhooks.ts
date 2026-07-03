import "server-only";
import { setUserPlan } from "@/server/billing/subscription";
import { addPurchasedCredits } from "@/server/billing/credits";
import { creditsForProduct } from "@/server/billing/polar-products";

/**
 * Handlers passed to the Polar `webhooks()` plugin. The Polar customer is created
 * at sign-up with `externalId = user.id`, so every payload's customer carries our
 * user id back to us.
 */

function externalId(customer: { externalId?: string | null } | undefined | null): string | null {
  return customer?.externalId ?? null;
}

export const polarWebhookHandlers = {
  // A subscription became (or stayed) active → grant Pro.
  onSubscriptionActive: async (payload: {
    data: {
      customer?: { externalId?: string | null } | null;
      status?: string | null;
      currentPeriodEnd?: Date | null;
    };
  }) => {
    const userId = externalId(payload.data.customer);
    if (!userId) return;
    await setUserPlan(userId, {
      plan: "pro",
      subscriptionStatus: payload.data.status ?? "active",
      currentPeriodEnd: payload.data.currentPeriodEnd ?? null,
    });
  },

  // Subscription ended (period elapsed after cancel, or revoked) → back to Free.
  onSubscriptionRevoked: async (payload: {
    data: { customer?: { externalId?: string | null } | null };
  }) => {
    const userId = externalId(payload.data.customer);
    if (!userId) return;
    await setUserPlan(userId, { plan: "free", subscriptionStatus: "revoked" });
  },

  // One-time payment settled → if it's a credit pack, top up the balance.
  onOrderPaid: async (payload: {
    data: {
      customer?: { externalId?: string | null } | null;
      productId?: string | null;
    };
  }) => {
    const userId = externalId(payload.data.customer);
    if (!userId) return;
    const credits = creditsForProduct(payload.data.productId);
    if (credits > 0) await addPurchasedCredits(userId, credits, "pack");
  },
};
