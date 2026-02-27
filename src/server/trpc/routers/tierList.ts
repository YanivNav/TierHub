import { z } from "zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc/trpc";
import { tierLists, tiers, items } from "@/server/db/schema";

export const tierListRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tierLists)
      .where(eq(tierLists.isPublic, true))
      .orderBy(desc(tierLists.createdAt));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const list = await ctx.db.query.tierLists.findFirst({
        where: eq(tierLists.id, input.id),
        with: {
          tiers: { orderBy: asc(tiers.rank) },
          items: { orderBy: asc(items.rank) },
        },
      });
      if (!list) throw new Error("Not found");
      return list;
    }),

  getMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(tierLists)
      .where(eq(tierLists.userId, ctx.userId))
      .orderBy(desc(tierLists.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [list] = await ctx.db
        .insert(tierLists)
        .values({ ...input, userId: ctx.userId })
        .returning();
      // Seed default tiers
      await ctx.db.insert(tiers).values([
        { tierListId: list!.id, label: "S", color: "#ef4444", rank: 0 },
        { tierListId: list!.id, label: "A", color: "#f97316", rank: 1 },
        { tierListId: list!.id, label: "B", color: "#eab308", rank: 2 },
        { tierListId: list!.id, label: "C", color: "#22c55e", rank: 3 },
        { tierListId: list!.id, label: "D", color: "#3b82f6", rank: 4 },
      ]);
      return list;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(tierLists)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(tierLists.id, id), eq(tierLists.userId, ctx.userId)))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(tierLists)
        .where(and(eq(tierLists.id, input.id), eq(tierLists.userId, ctx.userId)));
    }),
});
