import { getServerUserId } from "@/server/auth";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/server/db";
import { items, tierLists, tiers, users } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import TierBoard from "@/components/tier-board";
import { toCookielessThumbnailUrl } from "@/lib/youtube";
import ViewTracker from "@/components/view-tracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const list = await db.query.tierLists.findFirst({
    where: eq(tierLists.id, id),
    columns: { title: true, description: true, coverImageUrl: true, isPublic: true },
  });

  if (!list || !list.isPublic) return { title: "Tier List" };

  return {
    title: list.title,
    description: list.description ?? `A tier list ranking on TierHub`,
    openGraph: {
      title: list.title,
      description: list.description ?? undefined,
      images: list.coverImageUrl ? [list.coverImageUrl] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: list.title,
      description: list.description ?? undefined,
      images: list.coverImageUrl ? [list.coverImageUrl] : undefined,
    },
  };
}

export default async function TierListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getServerUserId();

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

  // Determine whether screenshots should carry the watermark — gated on the
  // tier list owner's plan, not the viewer's.
  const owner = await db.query.users.findFirst({
    where: eq(users.id, list.userId),
    columns: { plan: true },
  });
  const ownerPlan: "free" | "pro" = (owner?.plan as "free" | "pro") ?? "free";

  return (
    <main className="flex-1 bg-background p-6 text-foreground">
      <ViewTracker listId={list.id} isOwner={isOwner} />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{list.title}</h1>
            {list.description && (
              <p className="mt-1 text-muted-foreground">{list.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isOwner && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border text-foreground hover:text-foreground"
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
            imageUrl: item.imageUrl ? toCookielessThumbnailUrl(item.imageUrl) : null,
            videoUrl: item.videoUrl ?? null,
          }))}
          isOwner={isOwner}
          ownerPlan={ownerPlan}
        />
      </div>
    </main>
  );
}
