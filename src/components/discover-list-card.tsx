import Link from "next/link";
import { Button } from "@/components/ui/button";
import TierListCard from "@/components/tier-list-card";
import type { DiscoverList } from "@/server/db/discover";

/** Public-facing tier list card (thumbnail, title, author, View) — no owner actions. */
export default function DiscoverListCard({
  list,
  images,
}: {
  list: DiscoverList;
  images: string[];
}) {
  return (
    <TierListCard
      id={list.id}
      title={list.title}
      createdAt={list.createdAt}
      coverImageUrl={list.coverImageUrl}
      images={images}
      author={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {list.authorImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={list.authorImageUrl}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full"
            />
          )}
          <span className="truncate">@{list.authorUsername}</span>
        </div>
      }
      actions={
        <Button asChild size="sm" variant="ghost" className="flex-1 text-muted-foreground hover:text-foreground">
          <Link href={`/tier-lists/${list.id}`}>View</Link>
        </Button>
      }
    />
  );
}
