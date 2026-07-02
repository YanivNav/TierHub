import "server-only";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/trpc/root";
import { headers } from "next/headers";

export const api = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ('https://' + process.env.VERCEL_URL)}/api/trpc`,
      async headers() {
        const heads = await headers();
        const headersList = new Headers(heads);
        headersList.set("x-trpc-source", "rsc");
        return Object.fromEntries(headersList);
      },
    }),
  ],
});
