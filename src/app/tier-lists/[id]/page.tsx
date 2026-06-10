import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db";
import { items, tierLists, tiers } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import TierBoard from "@/components/tier-board";
import ViewTracker from "@/components/view-tracker";

export default async function TierListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  const list = await db.query.tierLists.findFirst({
    where: eq(tierLists.id, id),
    with: {
      tiers: { orderBy: asc(tiers.rank) },
      items: { orderBy: asc(items.rank) },
    },
  });

  if (!list) notFound();
  if (!list.isPublic && list.userId !== userId) notFound();

  const isOwner = userId === list.userId;

  return (
    <main className="flex-1 bg-zinc-950 p-6 text-white">
      <ViewTracker listId={list.id} isOwner={isOwner} />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{list.title}</h1>
            {list.description && (
              <p className="mt-1 text-zinc-400">{list.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOwner && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                <Link href={`/dashboard/${list.id}`}>Edit</Link>
              </Button>
            )}
          </div>
        </div>

        <TierBoard
          tierListId={list.id}
          tiers={list.tiers}
          items={list.items.map((item) => ({
            id: item.id,
            type: item.type,
            label: item.label,
            tierId: item.tierId ?? null,
            rank: item.rank ?? 0,
            imageUrl: item.imageUrl ?? null,
            videoUrl: item.videoUrl ?? null,
          }))}
          isOwner={isOwner}
        />
      </div>
    </main>
  );
}
