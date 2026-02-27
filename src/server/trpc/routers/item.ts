import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { items, tierLists } from "@/server/db/schema";

export const itemRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        tierListId: z.string().uuid(),
        label: z.string().min(1).max(200),
        type: z.enum(["text", "image", "video"]).default("text"),
        imageUrl: z.string().url().optional(),
        videoUrl: z.string().url().optional(),
        tierId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const list = await ctx.db.query.tierLists.findFirst({
        where: and(
          eq(tierLists.id, input.tierListId),
          eq(tierLists.userId, ctx.userId)
        ),
      });
      if (!list) throw new Error("Unauthorized");
      const [item] = await ctx.db.insert(items).values(input).returning();
      return item;
    }),

  updateTier: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tierId: z.string().uuid().nullable(),
        rank: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.items.findFirst({
        where: eq(items.id, input.id),
        with: { tierList: true },
      });
      if (!item || item.tierList.userId !== ctx.userId) throw new Error("Unauthorized");
      const [updated] = await ctx.db
        .update(items)
        .set({ tierId: input.tierId, rank: input.rank, updatedAt: new Date() })
        .where(eq(items.id, input.id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.items.findFirst({
        where: eq(items.id, input.id),
        with: { tierList: true },
      });
      if (!item || item.tierList.userId !== ctx.userId) throw new Error("Unauthorized");
      await ctx.db.delete(items).where(eq(items.id, input.id));
    }),
});
