import Link from "next/link";
import { getThumbnailImages, searchPublicLists } from "@/server/db/discover";
import DiscoverListCard from "@/components/discover-list-card";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 100);

  const lists = term ? await searchPublicLists(term, 30) : [];
  const thumbs = await getThumbnailImages(lists.map((l) => l.id));

  return (
    <main className="flex-1 bg-background p-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold">
          {term ? (
            <>
              Results for{" "}
              <span className="text-blue-400">&ldquo;{term}&rdquo;</span>
            </>
          ) : (
            "Search tier lists"
          )}
        </h1>

        {!term ? (
          <p className="text-muted-foreground">
            Type a query in the search bar to find public tier lists.
          </p>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-24 text-center">
            <p className="text-muted-foreground">
              No public tier lists match &ldquo;{term}&rdquo;.
            </p>
            <Link
              href="/"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              ← Back to discover
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <DiscoverListCard
                key={list.id}
                list={list}
                images={thumbs.get(list.id) ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
