import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { generateItemsStream, enrichItem, resolveMedia } from "@/server/ai/core";
import { rateLimitAiGenerate, rateLimitAiMedia } from "@/server/ratelimit";
import { consumeGenerationCredit } from "@/server/billing/credits";

export const aiRouter = createTRPCRouter({
  // Streaming: yields each item as the model finalizes it (consume via the
  // vanilla client's async iterable). Rate-limited per user before the stream
  // starts since each call is an LLM request.
  generateItems: protectedProcedure
    .input(
      z.object({
        prompt: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        existingItems: z.array(z.string()).optional(),
      })
    )
    .mutation(async function* ({ ctx, input }) {
      await rateLimitAiGenerate(ctx.userId);
      // One credit per generation run; reserved up front so an aborted stream
      // can't be used to bypass the quota. Throws OUT_OF_CREDITS when empty.
      await consumeGenerationCredit(ctx.userId);
      yield* generateItemsStream(input);
    }),

  enrichItem: protectedProcedure
    .input(
      z.object({
        itemName: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await rateLimitAiGenerate(ctx.userId);
      return enrichItem(input);
    }),

  resolveMedia: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["text", "image", "video"]),
        searchQuery: z.string().nullable().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await rateLimitAiMedia(ctx.userId);
      return resolveMedia(input);
    }),
});
