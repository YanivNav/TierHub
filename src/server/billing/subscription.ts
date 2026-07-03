import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import type { Plan } from "@/lib/plans";

/** Persist subscription/plan state from a Polar webhook onto the user row. */
export async function setUserPlan(
  userId: string,
  data: {
    plan: Plan;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: Date | null;
    polarCustomerId?: string | null;
  }
): Promise<void> {
  await db
    .update(users)
    .set({
      plan: data.plan,
      subscriptionStatus: data.subscriptionStatus ?? null,
      currentPeriodEnd: data.currentPeriodEnd ?? null,
      ...(data.polarCustomerId ? { polarCustomerId: data.polarCustomerId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
