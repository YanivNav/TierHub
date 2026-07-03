import "server-only";
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { users, creditLedger } from "@/server/db/schema";
import {
  monthlyCreditsForPlan,
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
  return {
    plan,
    monthlyAllowance,
    monthlyRemaining,
    purchasedCredits: user.purchasedCredits,
    totalCredits: monthlyRemaining + user.purchasedCredits,
    creditsResetAt: user.creditsResetAt,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
  };
}

/**
 * Reserve one AI-generation credit, spending the monthly allowance first and
 * falling back to purchased credits. Throws OUT_OF_CREDITS when none remain.
 * Both branches use guarded UPDATEs so a burst of concurrent generations can't
 * overspend.
 */
export async function consumeGenerationCredit(userId: string): Promise<void> {
  await ensureMonthlyWindow(userId);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { plan: true },
  });
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
  const allowance = monthlyCreditsForPlan(user.plan as Plan);

  // 1. Try to spend from the monthly allowance.
  const monthly = await db
    .update(users)
    .set({ monthlyCreditsUsed: sql`${users.monthlyCreditsUsed} + 1` })
    .where(and(eq(users.id, userId), lte(users.monthlyCreditsUsed, allowance - 1)))
    .returning({ id: users.id });
  if (monthly.length > 0) {
    await recordLedger(userId, -1, "generate");
    return;
  }

  // 2. Fall back to purchased credits.
  const purchased = await db
    .update(users)
    .set({ purchasedCredits: sql`${users.purchasedCredits} - 1` })
    .where(and(eq(users.id, userId), sql`${users.purchasedCredits} > 0`))
    .returning({ id: users.id });
  if (purchased.length > 0) {
    await recordLedger(userId, -1, "generate");
    return;
  }

  throw new TRPCError({ code: "FORBIDDEN", message: OUT_OF_CREDITS_ERROR });
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
