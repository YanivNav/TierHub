import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { tiers, tierLists } from "@/server/db/schema";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const tierRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        tierListId: z.string().uuid(),
        label: z.string().min(1).max(30),
        color: colorSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.query.tierLists.findFirst({
        where: and(eq(tierLists.id, input.tierListId), eq(tierLists.userId, ctx.userId)),
        with: { tiers: { orderBy: asc(tiers.rank) } },
      });
      if (!list) throw new TRPCError({ code: "UNAUTHORIZED" });
      const nextRank =
        list.tiers.length > 0 ? Math.max(...list.tiers.map((t) => t.rank)) + 1 : 0;
      const [tier] = await ctx.db
        .insert(tiers)
        .values({ ...input, rank: nextRank })
        .returning();
      return tier!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(30).optional(),
        color: colorSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tier = await ctx.db.query.tiers.findFirst({
        where: eq(tiers.id, input.id),
        with: { tierList: true },
      });
      if (!tier || tier.tierList.userId !== ctx.userId)
        throw new TRPCError({ code: "UNAUTHORIZED" });
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(tiers)
        .set(data)
        .where(eq(tiers.id, id))
        .returning();
      return updated!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tier = await ctx.db.query.tiers.findFirst({
        where: eq(tiers.id, input.id),
        with: { tierList: true },
      });
      if (!tier || tier.tierList.userId !== ctx.userId)
        throw new TRPCError({ code: "UNAUTHORIZED" });
      await ctx.db.delete(tiers).where(eq(tiers.id, input.id));
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        tierListId: z.string().uuid(),
        tiers: z.array(z.object({ id: z.string().uuid(), rank: z.number().int().min(0) })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const list = await ctx.db.query.tierLists.findFirst({
        where: and(eq(tierLists.id, input.tierListId), eq(tierLists.userId, ctx.userId)),
      });
      if (!list) throw new TRPCError({ code: "UNAUTHORIZED" });
      await Promise.all(
        input.tiers.map(({ id, rank }) =>
          ctx.db.update(tiers).set({ rank }).where(eq(tiers.id, id))
        )
      );
    }),
});
