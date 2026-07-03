import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { getBillingStatus } from "@/server/billing/credits";

export const billingRouter = createTRPCRouter({
  /** Plan, credit balance, and subscription state for the billing UI. */
  getStatus: protectedProcedure.query(({ ctx }) => getBillingStatus(ctx.userId)),
});
