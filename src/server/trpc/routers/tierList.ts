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
      return list;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().optional(),
        coverImageUrl: z.string().url().nullable().optional(),
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

  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Load source list with tiers and items
      const source = await ctx.db.query.tierLists.findFirst({
        where: eq(tierLists.id, input.id),
        with: {
          tiers: { orderBy: asc(tiers.rank) },
          items: { orderBy: asc(items.rank) },
        },
      });
      if (!source) throw new Error("Not found");

      // Create new tier list owned by the current user
      const [newList] = await ctx.db
        .insert(tierLists)
        .values({
          userId: ctx.userId,
          title: source.title,
          description: source.description ?? undefined,
          isPublic: false,
        })
        .returning();

      // Insert tiers and build old→new ID map
      const tierIdMap = new Map<string, string>();
      for (const tier of source.tiers) {
        const [newTier] = await ctx.db
          .insert(tiers)
          .values({ tierListId: newList!.id, label: tier.label, color: tier.color, rank: tier.rank })
          .returning();
        tierIdMap.set(tier.id, newTier!.id);
      }

      // Insert items with remapped tier IDs
      if (source.items.length > 0) {
        await ctx.db.insert(items).values(
          source.items.map((item) => ({
            tierListId: newList!.id,
            tierId: item.tierId ? (tierIdMap.get(item.tierId) ?? null) : null,
            label: item.label,
            type: item.type,
            imageUrl: item.imageUrl ?? undefined,
            videoUrl: item.videoUrl ?? undefined,
            rank: item.rank,
          }))
        );
      }

      return { id: newList!.id };
    }),
});
