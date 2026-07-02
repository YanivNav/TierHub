import { getServerUserId } from "@/server/auth";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/server/db";
import { tierLists } from "@/server/db/schema";
import { getThumbnailImages } from "@/server/db/discover";
import { Button } from "@/components/ui/button";
import DeleteListButton from "@/components/delete-list-button";
import TierListCard from "@/components/tier-list-card";

export default async function DashboardPage() {
  const userId = await getServerUserId();
  if (!userId) redirect("/sign-in");

  const lists = await db
    .select()
    .from(tierLists)
    .where(eq(tierLists.userId, userId))
    .orderBy(desc(tierLists.createdAt));

  // Collage thumbnails: up to 4 item images per list, one batched query.
  // Shared with the Discover feeds so the grouping logic stays in one place.
  const imagesByList = await getThumbnailImages(lists.map((l) => l.id));

  return (
    <main className="flex-1 bg-background p-8 text-foreground">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Tier Lists</h1>
          <Button asChild className="bg-blue-600 hover:bg-blue-500">
            <Link href="/dashboard/new">+ New List</Link>
          </Button>
        </div>

        {lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-24 text-center">
            <p className="text-muted-foreground">No tier lists yet.</p>
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
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${list.isPublic ? "bg-blue-600 text-white" : "bg-muted text-foreground"}`}>
                    {list.isPublic ? "Public" : "Private"}
                  </span>
                }
                actions={
                  <>
                    <DeleteListButton id={list.id} title={list.title} />
                    <Button asChild size="sm" variant="ghost" className="flex-1 text-muted-foreground hover:text-foreground">
                      <Link href={`/tier-lists/${list.id}`}>View</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1 border-border text-foreground hover:text-foreground">
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
