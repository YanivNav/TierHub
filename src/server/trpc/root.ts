import { createTRPCRouter } from "@/server/trpc/trpc";
import { tierListRouter } from "@/server/trpc/routers/tierList";
import { itemRouter } from "@/server/trpc/routers/item";
import { tierRouter } from "@/server/trpc/routers/tier";
import { aiRouter } from "@/server/trpc/routers/ai";
import { userRouter } from "@/server/trpc/routers/user";
import { billingRouter } from "@/server/trpc/routers/billing";

export const appRouter = createTRPCRouter({
  tierList: tierListRouter,
  item: itemRouter,
  tier: tierRouter,
  ai: aiRouter,
  user: userRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
