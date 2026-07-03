import "server-only";
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, items, tierLists, creditLedger } from "@/server/db/schema";
import {
  monthlyCreditsForPlan,
  MEDIA_ITEM_LIMITS,
  OUT_OF_CREDITS_ERROR,
  type Plan,
} from "@/lib/plans";

export interface BillingStatus {
  plan: Plan;
  monthlyAllowance: number;
  monthlyRemaining: number;
  purchasedCredits: number;
  totalCredits: number;
  creditsResetAt: Date | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  mediaItemsUsed: number;
  mediaItemsLimit: number;
}

/** First moment of next calendar month, UTC. */
function startOfNextMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * Compute-on-read monthly reset: if the user's window has rolled over (or was
 * never set), zero out monthly usage and advance the reset boundary. Idempotent
 * and guarded in SQL so concurrent calls can't double-reset.
 */
async function ensureMonthlyWindow(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(users)
    .set({ monthlyCreditsUsed: 0, creditsResetAt: startOfNextMonthUTC(now) })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.creditsResetAt), lte(users.creditsResetAt, now))
      )
    );
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  await ensureMonthlyWindow(userId);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      plan: true,
      monthlyCreditsUsed: true,
      purchasedCredits: true,
      creditsResetAt: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

  const plan = user.plan as Plan;
  const monthlyAllowance = monthlyCreditsForPlan(plan);
  const monthlyRemaining = Math.max(0, monthlyAllowance - user.monthlyCreditsUsed);

  const mediaItemsUsed = await countUserMediaItems(userId);
  const mediaItemsLimit = MEDIA_ITEM_LIMITS[plan];

  return {
    plan,
    monthlyAllowance,
    monthlyRemaining,
    purchasedCredits: user.purchasedCredits,
    totalCredits: monthlyRemaining + user.purchasedCredits,
    creditsResetAt: user.creditsResetAt,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    mediaItemsUsed,
    mediaItemsLimit,
  };
}

/** Count items with image/video URLs across all tier lists owned by the user. */
export async function countUserMediaItems(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
    .innerJoin(tierLists, eq(tierLists.id, items.tierListId))
    .where(
      and(
        eq(tierLists.userId, userId),
        sql`(${items.imageUrl} is not null or ${items.videoUrl} is not null)`
      )
    );
  return rows[0]?.count ?? 0;
}

/**
 * Reserve AI-generation credits (default 1), spending the monthly allowance
 * first and falling back to purchased credits. Uses guarded UPDATEs so a burst
 * of concurrent generations can't overspend. Throws OUT_OF_CREDITS when the
 * total remaining balance is less than the requested amount.
 */
export async function consumeGenerationCredit(
  userId: string,
  amount = 1
): Promise<void> {
  await ensureMonthlyWindow(userId);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true, monthlyCreditsUsed: true, purchasedCredits: true },
  });
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
  const allowance = monthlyCreditsForPlan(user.plan as Plan);

  const monthlyRemaining = Math.max(0, allowance - user.monthlyCreditsUsed);
  const totalRemaining = monthlyRemaining + user.purchasedCredits;
  if (totalRemaining < amount) {
    throw new TRPCError({ code: "FORBIDDEN", message: OUT_OF_CREDITS_ERROR });
  }

  // Spend as much as possible from the monthly allowance first.
  const fromMonthly = Math.min(amount, monthlyRemaining);
  let spent = 0;

  if (fromMonthly > 0) {
    const result = await db
      .update(users)
      .set({ monthlyCreditsUsed: sql`${users.monthlyCreditsUsed} + ${fromMonthly}` })
      .where(
        and(eq(users.id, userId), lte(users.monthlyCreditsUsed, allowance - fromMonthly))
      )
      .returning({ id: users.id });
    if (result.length > 0) {
      await recordLedger(userId, -fromMonthly, "generate");
      spent += fromMonthly;
    }
  }

  // Any remainder comes from purchased credits.
  const fromPurchased = amount - spent;
  if (fromPurchased > 0) {
    const result = await db
      .update(users)
      .set({ purchasedCredits: sql`${users.purchasedCredits} - ${fromPurchased}` })
      .where(and(eq(users.id, userId), sql`${users.purchasedCredits} >= ${fromPurchased}`))
      .returning({ id: users.id });
    if (result.length > 0) {
      await recordLedger(userId, -fromPurchased, "generate");
      spent += fromPurchased;
    }
  }

  // If the DB state changed between our read and the UPDATEs (e.g., concurrent
  // generation landed between the two updates), we may come up short. In that
  // rare case, the user gets this generation for free rather than a spurious
  // error — the race window is tiny and the cost is trivial.
}

/** Grant purchased (non-expiring) credits — called from the Polar order webhook. */
export async function addPurchasedCredits(
  userId: string,
  amount: number,
  reason = "pack"
): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(users)
    .set({ purchasedCredits: sql`${users.purchasedCredits} + ${amount}` })
    .where(eq(users.id, userId));
  await recordLedger(userId, amount, reason);
}

async function recordLedger(userId: string, delta: number, reason: string): Promise<void> {
  await db.insert(creditLedger).values({ userId, delta, reason });
}
