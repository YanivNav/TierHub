import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export async function createTRPCContext(opts: FetchCreateContextFnOptions) {
  const { userId } = await auth();
  return {
    db,
    userId,
    ...opts,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
