"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";

/**
 * Records a view of a public tier list, once per browser session. Renders
 * nothing. Skips the owner (passed as `isOwner`) and dedupes via sessionStorage
 * so refreshes and React Strict-Mode double-effects don't inflate the count.
 */
export default function ViewTracker({
  listId,
  isOwner,
}: {
  listId: string;
  isOwner: boolean;
}) {
  const recordView = trpc.tierList.recordView.useMutation();

  useEffect(() => {
    if (isOwner) return;
    const key = `viewed:${listId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1"); // set before firing to guard double-runs
    recordView.mutate({ id: listId });
    // recordView is a stable tRPC mutation handle; intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, isOwner]);

  return null;
}
