import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { TRPCContext } from "./context";
import { ensureUser } from "@/lib/auth";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, type, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // Lazily backfill the `users` row before any write that may hold a foreign
  // key to it (the Clerk webhook can miss localhost in dev or drop events).
  if (type === "mutation") {
    await ensureUser(ctx.userId);
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
