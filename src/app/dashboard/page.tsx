import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db";
import { items, tierLists } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import DeleteListButton from "@/components/delete-list-button";
import TierListCard from "@/components/tier-list-card";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const lists = await db
    .select()
    .from(tierLists)
    .where(eq(tierLists.userId, userId))
    .orderBy(desc(tierLists.createdAt));

  // Fetch item images for all lists in one query, then group — used to build a
  // collage thumbnail at render time (no stored/generated thumbnail needed).
  const listIds = lists.map((l) => l.id);
  const imageRows = listIds.length
    ? await db
        .select({ tierListId: items.tierListId, imageUrl: items.imageUrl })
        .from(items)
        .where(and(inArray(items.tierListId, listIds), isNotNull(items.imageUrl)))
        .orderBy(asc(items.rank), asc(items.createdAt))
    : [];

  const imagesByList = new Map<string, string[]>();
  for (const row of imageRows) {
    if (!row.imageUrl) continue;
    const arr = imagesByList.get(row.tierListId) ?? [];
    if (arr.length < 4) {
      arr.push(row.imageUrl);
      imagesByList.set(row.tierListId, arr);
    }
  }

  return (
    <main className="flex-1 bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Tier Lists</h1>
          <Button asChild className="bg-blue-600 hover:bg-blue-500">
            <Link href="/dashboard/new">+ New List</Link>
          </Button>
        </div>

        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-zinc-700 py-24 text-center">
            <p className="text-zinc-400">No tier lists yet.</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-500">
              <Link href="/dashboard/new">Create your first one</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {lists.map((list) => (
              <TierListCard
                key={list.id}
                id={list.id}
                title={list.title}
                createdAt={list.createdAt}
                coverImageUrl={list.coverImageUrl}
                images={imagesByList.get(list.id) ?? []}
                badge={
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${list.isPublic ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>
                    {list.isPublic ? "Public" : "Private"}
                  </span>
                }
                actions={
                  <>
                    <DeleteListButton id={list.id} title={list.title} />
                    <Button asChild size="sm" variant="ghost" className="flex-1 text-zinc-400 hover:text-white">
                      <Link href={`/tier-lists/${list.id}`}>View</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:text-white">
                      <Link href={`/dashboard/${list.id}`}>Edit</Link>
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
