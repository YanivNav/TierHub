import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TierCardThumbnail from "@/components/tier-card-thumbnail";
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
    <Card className="flex flex-col overflow-hidden border-zinc-800 bg-zinc-900 pt-0 text-white">
      <Link href={`/tier-lists/${list.id}`} className="block">
        <TierCardThumbnail
          coverImageUrl={list.coverImageUrl}
          images={images}
          className="border-b border-zinc-800"
        />
      </Link>
      <CardHeader className="flex-1">
        <CardTitle className="text-base leading-snug">
          <Link href={`/tier-lists/${list.id}`} className="hover:text-blue-400">
            {list.title}
          </Link>
        </CardTitle>
        {list.description && (
          <CardDescription className="line-clamp-2 text-zinc-400">
            {list.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardFooter className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
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
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="shrink-0 text-zinc-400 hover:text-white"
        >
          <Link href={`/tier-lists/${list.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
