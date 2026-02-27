import { createTRPCRouter } from "@/server/trpc/trpc";
import { tierListRouter } from "@/server/trpc/routers/tierList";
import { itemRouter } from "@/server/trpc/routers/item";

export const appRouter = createTRPCRouter({
  tierList: tierListRouter,
  item: itemRouter,
});

export type AppRouter = typeof appRouter;
