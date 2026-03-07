import { createTRPCRouter } from "@/server/trpc/trpc";
import { tierListRouter } from "@/server/trpc/routers/tierList";
import { itemRouter } from "@/server/trpc/routers/item";
import { tierRouter } from "@/server/trpc/routers/tier";
import { aiRouter } from "@/server/trpc/routers/ai";

export const appRouter = createTRPCRouter({
  tierList: tierListRouter,
  item: itemRouter,
  tier: tierRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
