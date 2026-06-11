import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { users } from "@/server/db/schema";
import { ensureUser } from "@/lib/auth";

export const userRouter = createTRPCRouter({
  /** The signed-in user's DB profile (handle/avatar/email shown across the app). */
  getMe: protectedProcedure.query(async ({ ctx }) => {
    // Guarantee the row exists even for a user who hasn't done a write yet.
    await ensureUser(ctx.userId);
    return ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      columns: { username: true, imageUrl: true, email: true },
    });
  }),

  updateUsername: protectedProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores.")
          .transform((v) => v.toLowerCase()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const taken = await ctx.db.query.users.findFirst({
        where: eq(users.username, input.username),
        columns: { id: true },
      });
      if (taken && taken.id !== ctx.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That username is taken.",
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ username: input.username, updatedAt: new Date() })
        .where(eq(users.id, ctx.userId))
        .returning({ username: users.username });
      return updated;
    }),

  /** Pull the latest avatar/email from Clerk into the DB (after an avatar change). */
  syncFromClerk: protectedProcedure.mutation(async ({ ctx }) => {
    const clerkUser = await currentUser();
    if (!clerkUser) return { synced: false };

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    await ctx.db
      .update(users)
      .set({ imageUrl: clerkUser.imageUrl, email, updatedAt: new Date() })
      .where(eq(users.id, ctx.userId));
    return { synced: true };
  }),

  /** Permanently delete the account: DB row (cascades to lists) then the Clerk user. */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(users).where(eq(users.id, ctx.userId));
    const client = await clerkClient();
    await client.users.deleteUser(ctx.userId);
    return { deleted: true };
  }),
});
