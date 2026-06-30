import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { items, tierLists, tiers } from "@/server/db/schema";
import TierListForm from "@/components/tier-list-form";
import DeleteListButton from "@/components/delete-list-button";

export default async function EditTierListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;

  const list = await db.query.tierLists.findFirst({
    where: and(eq(tierLists.id, id), eq(tierLists.userId, userId)),
    with: {
      tiers: { orderBy: asc(tiers.rank) },
      items: { orderBy: asc(items.rank) },
    },
  });

  if (!list) notFound();

  return (
    <main className="flex-1 bg-background p-8 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Edit Tier List</h1>
          <DeleteListButton
            id={list.id}
            title={list.title}
            label="Delete list"
            redirectTo="/dashboard"
          />
        </div>

        <TierListForm
          mode="edit"
          tierListId={list.id}
          initialTitle={list.title}
          initialDescription={list.description ?? ""}
          initialIsPublic={list.isPublic}
          initialCoverImageUrl={list.coverImageUrl}
          initialTiers={list.tiers}
          initialItems={list.items.map((item) => ({
            id: item.id,
            type: item.type,
            label: item.label,
            imageUrl: item.imageUrl,
            videoUrl: item.videoUrl,
          }))}
        />
      </div>
    </main>
  );
}
